/**
 * Suíte de Storage da Fase 7 (C4) — roda contra o projeto de QA descartável.
 *
 * POR QUE ESTA SUÍTE É SEPARADA DA `test:fase7`
 *
 * O gate mediu que o `storage-api` v1.67.8 (o que o CLI 2.111.0 ainda puxa)
 * derruba o stack local, e o `db:reset` é o primeiro passo do `verify`. Então
 * o Storage é validado num projeto Supabase de QA, e esta suíte exige rede —
 * não entra no `verify`. Sem skip silencioso: sem `.env.qa.local`, ela falha.
 *
 * O QUE ELA PROVA, E POR QUE CADA COISA
 *
 * As asserções de policy passam DIRETO pelo PostgREST/Storage API, com sessão
 * real de cada lojista — nunca pela Server Action. É o mesmo raciocínio da
 * migration 20: uma regra escrita só na Action seria contornável por quem fala
 * HTTP, e o lojista fala.
 *
 * E ela assere o PREDICADO das policies, não só a existência. Um
 * `using (true)` reintroduzido por engano passaria por qualquer teste que só
 * conta policies.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase7-storage");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  detectarTipoImagem,
  validarBytesImagem,
  urlPublicaImagem,
  caminhoImagem,
  PATH_IMAGEM_RE,
  TAMANHO_MAX_IMAGEM,
  BUCKET_IMAGENS,
} from "../src/lib/imagem-cupom";
import { encerrar } from "./_qa-conta";

if (alvo.producao) {
  console.error(
    "Esta suíte NÃO roda contra produção. Ela cria e apaga objetos no bucket.\n" +
      "Use: npm run test:fase7:storage (aponta para .env.qa.local).",
  );
  process.exit(1);
}

const SENHA = "promofy123";
let passed = 0;
let failed = 0;

function check(nome: string, ok: boolean, detalhe = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${nome}`);
  } else {
    failed++;
    console.log(`  FAIL  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

// ---------- fixtures de bytes ----------
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
/** RIFF sem WEBP no offset 8 — é WAV/AVI. Aceitar pelo prefixo deixaria passar. */
const RIFF_FALSO = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

function hex32(semente: number): string {
  return semente.toString(16).padStart(2, "0").repeat(16).slice(0, 32);
}

async function logar(email: string): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main(): Promise<number> {
  // ============================================================
  console.log("[1] Módulo puro — sem rede, sem banco");
  // ============================================================
  check("JPEG pelos magic bytes", detectarTipoImagem(JPEG)?.ext === "jpg");
  check("PNG pelos magic bytes", detectarTipoImagem(PNG)?.ext === "png");
  check("WebP exige RIFF **e** WEBP", detectarTipoImagem(WEBP)?.ext === "webp");
  check("RIFF sem WEBP é recusado (WAV/AVI não é imagem)", detectarTipoImagem(RIFF_FALSO) === null);
  check("SVG é recusado (vetor de script)", detectarTipoImagem(SVG) === null);
  check("arquivo vazio é recusado", validarBytesImagem(new Uint8Array(0)).ok === false);

  const grande = new Uint8Array(TAMANHO_MAX_IMAGEM + 1);
  grande.set(JPEG);
  const rGrande = validarBytesImagem(grande);
  check(
    "2 MiB + 1 byte é recusado por TAMANHO (mesmo sendo JPEG válido)",
    !rGrande.ok && rGrande.motivo === "muito_grande",
  );

  const noLimite = new Uint8Array(TAMANHO_MAX_IMAGEM);
  noLimite.set(JPEG);
  check("exatamente 2 MiB passa", validarBytesImagem(noLimite).ok === true);

  const p = caminhoImagem("e1", hex32(0xab), "jpg");
  check("caminho montado casa com o formato", PATH_IMAGEM_RE.test(p), p);
  check(
    "URL pública sai para o caminho do PRÓPRIO estabelecimento",
    urlPublicaImagem(p, "e1", alvo.url)?.includes(`/${BUCKET_IMAGENS}/e1/`) === true,
  );
  check(
    "caminho de OUTRO estabelecimento não vira URL (coluna é escrivível pelo lojista)",
    urlPublicaImagem(p, "e2", alvo.url) === null,
  );
  check(
    "URL externa gravada na coluna não vira URL",
    urlPublicaImagem("https://evil.example/x.jpg", "e1", alvo.url) === null,
  );
  check(
    "caminho morto do seed cai no fallback",
    urlPublicaImagem("/img/cupons/c01.jpg", "e1", alvo.url) === null,
  );
  check(
    "path traversal na coluna não vira URL",
    urlPublicaImagem("e1/../e2/" + hex32(1) + ".jpg", "e1", alvo.url) === null,
  );

  // ============================================================
  console.log("\n[2] Bucket (config declarada no config.toml + migration 22)");
  // ============================================================
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: buckets } = await svc.storage.listBuckets();
  const b = (buckets ?? []).find((x) => x.name === BUCKET_IMAGENS);
  check("bucket cupom-imagens existe", Boolean(b));
  check("é público", b?.public === true);
  check("limite de 2 MiB no servidor", b?.file_size_limit === TAMANHO_MAX_IMAGEM, String(b?.file_size_limit));
  const mimes = (b?.allowed_mime_types ?? []).slice().sort().join(",");
  check(
    "só jpeg/png/webp — SVG fora da whitelist",
    mimes === "image/jpeg,image/png,image/webp",
    mimes,
  );

  // ============================================================
  // As policies são provadas por COMPORTAMENTO, não lendo pg_policies.
  //
  // A intenção original era asserir o texto do predicado (`pg_policies.qual`),
  // para que um `using (true)` reintroduzido não passasse. Isso exige conexão
  // direta ao Postgres, e o endpoint da Supabase — direto e pooler — apresenta
  // certificado de CA própria: ou se desliga a verificação TLS (inaceitável na
  // conexão que carrega a senha do banco) ou se versiona uma CA cuja origem
  // não consegui confirmar (a URL canônica saiu do ar).
  //
  // A troca não enfraquece a suíte, e discutivelmente a fortalece: as seções
  // [4] e [5] provam a PROPRIEDADE em vez do texto. Um `using (true)` faria
  // "anon não lista a raiz" e "lojista2 não lista a pasta do e1" falharem na
  // hora; um UPDATE liberado faria "nem o dono troca os bytes" falhar. O que
  // se perde é distinguir "não existe policy de UPDATE" de "existe uma que
  // nega" — e as duas dão a mesma garantia.
  // ============================================================
  console.log("\n[4] Negativos DIRETOS — lojista2 contra o estabelecimento do lojista1");
  // ============================================================
  const dono = await logar("lojista@promofy.test"); // e1
  const outro = await logar("lojista2@promofy.test"); // e2
  const anon = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const alvoE1 = caminhoImagem("e1", hex32(0x11), "jpg");
  const blob = () => new Blob([JPEG as BlobPart], { type: "image/jpeg" });

  const upDono = await dono.storage.from(BUCKET_IMAGENS).upload(alvoE1, blob(), {
    contentType: "image/jpeg",
    upsert: false,
  });
  check("o DONO sobe no próprio estabelecimento", !upDono.error, upDono.error?.message);

  const upOutro = await outro.storage.from(BUCKET_IMAGENS).upload(
    caminhoImagem("e1", hex32(0x22), "jpg"),
    blob(),
    { contentType: "image/jpeg", upsert: false },
  );
  check("lojista2 NÃO sobe em pasta do e1", Boolean(upOutro.error), upOutro.error?.message ?? "SUBIU!");

  // A policy exige `array_length(foldername, 1) = 1`. Sem isso, um objeto na
  // RAIZ teria dono indefinido (foldername vazio) e subpastas escapariam do
  // predicado. Provado por comportamento, já que o catálogo está fora de
  // alcance (ver nota em [3]).
  const upRaiz = await dono.storage
    .from(BUCKET_IMAGENS)
    .upload(`${hex32(0x33)}.jpg`, blob(), { contentType: "image/jpeg", upsert: false });
  check(
    "objeto na RAIZ do bucket é recusado (dono seria indefinido)",
    Boolean(upRaiz.error),
    upRaiz.error?.message ?? "SUBIU na raiz!",
  );

  const upFundo = await dono.storage
    .from(BUCKET_IMAGENS)
    .upload(`e1/sub/${hex32(0x44)}.jpg`, blob(), { contentType: "image/jpeg", upsert: false });
  check(
    "subpasta é recusada (só <estabelecimento>/<arquivo>)",
    Boolean(upFundo.error),
    upFundo.error?.message ?? "SUBIU em subpasta!",
  );

  const upsertDono = await dono.storage.from(BUCKET_IMAGENS).upload(alvoE1, blob(), {
    contentType: "image/jpeg",
    upsert: true, // vira UPDATE do objeto existente
  });
  check(
    "nem o DONO troca os bytes de um objeto existente (sem policy de UPDATE)",
    Boolean(upsertDono.error),
    upsertDono.error?.message ?? "SOBRESCREVEU — a remoderação de imagem estaria furada",
  );

  const delOutro = await outro.storage.from(BUCKET_IMAGENS).remove([alvoE1]);
  const apagouMesmo = await svc.storage.from(BUCKET_IMAGENS).list("e1");
  check(
    "lojista2 NÃO apaga imagem do e1",
    (apagouMesmo.data ?? []).some((o) => alvoE1.endsWith(o.name)),
    delOutro.error?.message ?? "o objeto sumiu — DELETE alheio passou",
  );

  console.log("\n[5] Listagem — o índice não pode vazar");
  const listAnon = await anon.storage.from(BUCKET_IMAGENS).list("");
  check(
    "anon não lista a raiz do bucket",
    Boolean(listAnon.error) || (listAnon.data ?? []).length === 0,
    `${(listAnon.data ?? []).length} item(ns)`,
  );
  const listOutro = await outro.storage.from(BUCKET_IMAGENS).list("e1");
  check(
    "lojista2 não lista a pasta do e1",
    Boolean(listOutro.error) || (listOutro.data ?? []).length === 0,
    `${(listOutro.data ?? []).length} item(ns)`,
  );
  const listDono = await dono.storage.from(BUCKET_IMAGENS).list("e1");
  check(
    "o dono lista a própria pasta",
    !listDono.error && (listDono.data ?? []).length > 0,
    listDono.error?.message,
  );

  console.log("\n[6] Leitura pública e limpeza");
  const url = urlPublicaImagem(alvoE1, "e1", alvo.url)!;
  const resp = await fetch(url);
  check("a imagem é legível por getPublicUrl (bucket público)", resp.ok, `HTTP ${resp.status}`);
  check(
    "e servida como imagem, não como o que o cliente declarou",
    (resp.headers.get("content-type") ?? "").startsWith("image/"),
    resp.headers.get("content-type") ?? "",
  );

  const delDono = await dono.storage.from(BUCKET_IMAGENS).remove([alvoE1]);
  check("o dono apaga o próprio objeto", !delDono.error, delDono.error?.message);

  return encerrar(passed, failed);
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
