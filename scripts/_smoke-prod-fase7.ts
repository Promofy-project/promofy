/**
 * Smoke de PRODUÇÃO da Fase 7 — itens (b) e (c) do PASSO 3.
 *
 * Script SEPARADO da suíte de propósito. `test-fase7-storage.ts` tem uma trava
 * que recusa produção, e ela deve continuar lá: rodar suíte contra o banco do
 * cliente é exatamente o que a regra do `qa-*` existe para impedir. Este
 * arquivo é um ato deliberado e pontual, com limpeza no fim.
 *
 * O que ele NÃO faz: não toca `consumidor@`, não apaga nada que já existia,
 * não altera cupom nenhum de forma permanente. Tudo o que cria, remove.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("smoke-prod-fase7");
if (!alvo.producao) {
  console.error("Este smoke é para PRODUÇÃO. Use --hosted.");
  process.exit(1);
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BUCKET_IMAGENS,
  caminhoImagem,
  urlPublicaImagem,
  TAMANHO_MAX_IMAGEM,
} from "../src/lib/imagem-cupom";

const SENHA = "promofy123";
let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${!ok && d ? ` — ${d}` : ""}`);
};

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const NAO_IMAGEM = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
const hex32 = (n: number) => n.toString(16).padStart(2, "0").repeat(16).slice(0, 32);

async function logar(email: string): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main(): Promise<number> {
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const dono = await logar("lojista@promofy.test");   // e1
  const outro = await logar("lojista2@promofy.test"); // e2
  const anon = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const criados: string[] = [];
  const blob = (b: Uint8Array, t = "image/jpeg") => new Blob([b as BlobPart], { type: t });

  try {
    console.log("\n(b) NEGATIVOS PELO CAMINHO DIRETO À API DO STORAGE\n");

    // Positivo de controle: sem ele, um negativo verde pode só significar
    // "nada funciona".
    const bom = caminhoImagem("e1", hex32(0xa1), "jpg");
    const rBom = await dono.storage.from(BUCKET_IMAGENS).upload(bom, blob(JPEG), {
      contentType: "image/jpeg", upsert: false,
    });
    if (!rBom.error) criados.push(bom);
    check("controle: o DONO sobe no próprio estabelecimento", !rBom.error, rBom.error?.message);

    // >2 MiB — a barreira aqui é do BUCKET (file_size_limit), não da Action.
    const grande = new Uint8Array(TAMANHO_MAX_IMAGEM + 1024);
    grande.set(JPEG);
    const pGrande = caminhoImagem("e1", hex32(0xa2), "jpg");
    const rGrande = await dono.storage.from(BUCKET_IMAGENS).upload(pGrande, blob(grande), {
      contentType: "image/jpeg", upsert: false,
    });
    if (!rGrande.error) criados.push(pGrande);
    check("acima de 2 MiB é recusado PELO BUCKET", Boolean(rGrande.error), rGrande.error?.message ?? "SUBIU");

    // Tipo errado: HTML com nome .jpg e Content-Type mentido. O bucket aceita
    // (valida o DECLARADO); quem recusa pelo conteúdo é a Action, via magic
    // bytes. Aqui provo os dois lados.
    const pFake = caminhoImagem("e1", hex32(0xa3), "jpg");
    const rFake = await dono.storage.from(BUCKET_IMAGENS).upload(pFake, blob(NAO_IMAGEM), {
      contentType: "image/jpeg", upsert: false,
    });
    if (!rFake.error) criados.push(pFake);
    check(
      "HTML com Content-Type mentido PASSA pelo bucket (por isso os magic bytes vivem no servidor)",
      !rFake.error,
      rFake.error?.message,
    );
    if (!rFake.error) {
      const r = await fetch(urlPublicaImagem(pFake, "e1", alvo.url)!);
      const ct = r.headers.get("content-type") ?? "";
      check(
        "…e mesmo assim é servido como image/*, nunca como HTML executável",
        ct.startsWith("image/"),
        ct,
      );
    }

    // lojista2 contra a pasta do e1
    const pAlheio = caminhoImagem("e1", hex32(0xb1), "jpg");
    const rAlheio = await outro.storage.from(BUCKET_IMAGENS).upload(pAlheio, blob(JPEG), {
      contentType: "image/jpeg", upsert: false,
    });
    if (!rAlheio.error) criados.push(pAlheio);
    check("lojista2 NÃO sobe em pasta do e1", Boolean(rAlheio.error), rAlheio.error?.message ?? "SUBIU");

    const rTroca = await dono.storage.from(BUCKET_IMAGENS).upload(bom, blob(JPEG), {
      contentType: "image/jpeg", upsert: true,
    });
    check("nem o DONO troca os bytes de objeto existente (sem policy de UPDATE)",
      Boolean(rTroca.error), rTroca.error?.message ?? "SOBRESCREVEU");

    await outro.storage.from(BUCKET_IMAGENS).remove([bom]);
    const aindaLa1 = await svc.storage.from(BUCKET_IMAGENS).list("e1");
    check("lojista2 NÃO apaga imagem do e1",
      (aindaLa1.data ?? []).some((o) => bom.endsWith(o.name)), "o objeto sumiu");

    const lAnon = await anon.storage.from(BUCKET_IMAGENS).list("");
    check("anon não lista a raiz do bucket",
      Boolean(lAnon.error) || (lAnon.data ?? []).length === 0, `${(lAnon.data ?? []).length} itens`);
    const lOutro = await outro.storage.from(BUCKET_IMAGENS).list("e1");
    check("lojista2 não lista a pasta do e1",
      Boolean(lOutro.error) || (lOutro.data ?? []).length === 0, `${(lOutro.data ?? []).length} itens`);

    const pLivre = "e1/qualquer-coisa.bin";
    const rLivre = await dono.storage.from(BUCKET_IMAGENS).upload(pLivre, blob(JPEG), {
      contentType: "image/jpeg", upsert: false,
    });
    if (!rLivre.error) criados.push(pLivre);
    check("nome fora do formato é recusado pelo BANCO (M23)",
      Boolean(rLivre.error), rLivre.error?.message ?? "SUBIU blob arbitrário");

    console.log("\n(c) A BARREIRA DA M23 — DELETE em imagem de cupom moderado\n");

    const ativo = (await svc.from("cupons").select("id, imagem, titulo")
      .eq("estabelecimento_id", "e1").eq("status", "ativo").limit(1)).data?.[0];
    check("há cupom ATIVO no e1", Boolean(ativo));
    if (ativo) {
      const original = ativo.imagem;
      await svc.from("cupons").update({ imagem: bom }).eq("id", ativo.id);

      const rDel = await dono.storage.from(BUCKET_IMAGENS).remove([bom]);
      const aindaLa2 = await svc.storage.from(BUCKET_IMAGENS).list("e1");
      check(
        "DELETE bloqueado em imagem de cupom moderado (teria reprovado a M22)",
        (aindaLa2.data ?? []).some((o) => bom.endsWith(o.name)),
        rDel.error?.message ?? "o objeto sumiu — o furo estaria aberto EM PRODUÇÃO",
      );

      // devolve o cupom ao valor original ANTES de qualquer limpeza
      await svc.from("cupons").update({ imagem: original }).eq("id", ativo.id);
      const rDelLivre = await dono.storage.from(BUCKET_IMAGENS).remove([bom]);
      check("desreferenciada, volta a ser apagável", !rDelLivre.error, rDelLivre.error?.message);
      if (!rDelLivre.error) criados.splice(criados.indexOf(bom), 1);
    }
  } finally {
    // Limpeza: tudo o que este smoke criou sai, com service_role.
    if (criados.length) {
      const { error } = await svc.storage.from(BUCKET_IMAGENS).remove(criados);
      console.log(`\n[limpeza] ${criados.length} objeto(s) removido(s)${error ? " COM ERRO: " + error.message : ""}`);
    }
    const sobrou = await svc.storage.from(BUCKET_IMAGENS).list("e1");
    console.log(`[limpeza] objetos restantes em e1: ${(sobrou.data ?? []).length}`);
  }

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
  return failed > 0 ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
