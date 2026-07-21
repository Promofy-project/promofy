/**
 * Testes de fluxo da Fase 3 (moderação admin + economia).
 * Roda contra o stack seedado (`npm run db:reset` antes). Prova:
 *  - moderação (aprovar/rejeitar cupom, aprovar/suspender estabelecimento)
 *    SÓ por admin, via RPC E pelo caminho PostgREST direto (grant de coluna
 *    fecha o auto-approve do lojista — 42501);
 *  - cupom aprovado aparece / rejeitado não aparece no catálogo público;
 *  - suspender estabelecimento remove os cupons do catálogo na hora (C4);
 *  - economia_total_consumidor por usuário (isolada + correta) — D3.
 *
 * Cria o próprio cupom 'pendente' (o seed não tem) e usa try/finally para
 * restaurar e1 a 'ativo' mesmo se uma asserção falhar no meio.
 */
import { config } from "dotenv";
const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  console.error(`Faltam variáveis em ${envFile}.`);
  process.exit(1);
}
console.log(`\n[test-fase3] alvo: ${hosted ? "HOSPEDADO (muta dados!)" : "local"} (${new URL(url).host})\n`);

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

const svc = createClient(url!, serviceRole!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = () =>
  createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function logar(email: string): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

type Jsonb = Record<string, unknown> | null;
const motivo = (r: Jsonb) => (r as { motivo?: string })?.motivo;
const okr = (r: Jsonb) => (r as { ok?: boolean })?.ok === true;
const statusOf = (r: Jsonb) => (r as { status?: string })?.status;

async function limparCiclo(uid: string) {
  await svc.from("cupons_usuario").delete().eq("usuario_id", uid);
  await svc.from("cupom_eventos").delete().eq("usuario_id", uid);
  await svc.from("pontos_transacoes").delete().eq("usuario_id", uid).neq("acao", "bonus");
}

const PEND = "f3-pendente";
const PEND_REJ = "f3-pendente-rej";

async function main() {
  const consumidor = await logar("consumidor@promofy.test");
  const consumidorId = (await consumidor.auth.getUser()).data.user!.id;
  const lojista = await logar("lojista@promofy.test"); // e1
  const lojista2 = await logar("lojista2@promofy.test"); // e2
  const lojista2Id = (await lojista2.auth.getUser()).data.user!.id;
  const admin = await logar("admin@promofy.test");
  const anonC = anon();

  // categoria de e1 (para o cupom de teste respeitar a FK)
  const { data: e1 } = await svc
    .from("estabelecimentos")
    .select("categoria_id")
    .eq("id", "e1")
    .single();
  const catE1 = e1!.categoria_id as string;

  // cria (idempotente) dois cupons 'pendente' em e1
  await svc.from("cupons").delete().in("id", [PEND, PEND_REJ]);
  await svc.from("cupons").insert([
    { id: PEND, estabelecimento_id: "e1", titulo: "F3 Pendente Aprovar", categoria_id: catE1, economia: 25, validade_fim: "2030-12-31", status: "pendente" },
    { id: PEND_REJ, estabelecimento_id: "e1", titulo: "F3 Pendente Rejeitar", categoria_id: catE1, economia: 30, validade_fim: "2030-12-31", status: "pendente" },
  ]);

  try {
    console.log("[moderação — negativos via RPC]");
    check("lojista NÃO aprova cupom (RPC) → sem_permissao",
      motivo((await lojista.rpc("aprovar_cupom", { p_cupom_id: PEND })).data as Jsonb) === "sem_permissao");
    check("consumidor NÃO rejeita cupom (RPC) → sem_permissao",
      motivo((await consumidor.rpc("rejeitar_cupom", { p_cupom_id: PEND })).data as Jsonb) === "sem_permissao");
    check("lojista NÃO suspende estabelecimento (RPC) → sem_permissao",
      motivo((await lojista.rpc("definir_status_estabelecimento", { p_est_id: "e1", p_status: "suspenso" })).data as Jsonb) === "sem_permissao");

    console.log("\n[moderação — negativos via PostgREST DIRETO (grant de coluna)]");
    {
      const up = await lojista.from("cupons").update({ status: "ativo" }).eq("id", PEND).select();
      check("lojista NÃO auto-aprova cupom.status direto → 42501", up.error?.code === "42501", up.error?.code ?? "sem erro");
    }
    {
      const up = await consumidor.from("cupons").update({ status: "ativo" }).eq("id", PEND).select();
      check("consumidor NÃO muda cupom.status direto → 42501", up.error?.code === "42501", up.error?.code ?? "sem erro");
    }
    {
      const up = await lojista.from("estabelecimentos").update({ status: "ativo" }).eq("id", "e1").select();
      check("lojista NÃO muda estabelecimento.status direto → 42501 (regressão)", up.error?.code === "42501", up.error?.code ?? "sem erro");
    }
    {
      const { data } = await svc.from("cupons").select("status").eq("id", PEND).single();
      check("cupom segue 'pendente' após as tentativas diretas", data?.status === "pendente", data?.status);
    }

    console.log("\n[moderação — admin aprova/rejeita]");
    {
      const r = (await admin.rpc("aprovar_cupom", { p_cupom_id: PEND })).data as Jsonb;
      check("admin aprova pendente → ok, status ativo", okr(r) && statusOf(r) === "ativo", JSON.stringify(r));
      const { data } = await anonC.from("cupons").select("id").eq("id", PEND);
      check("cupom aprovado aparece p/ anon (estab ativo)", (data?.length ?? 0) === 1);
    }
    {
      const r = (await admin.rpc("rejeitar_cupom", { p_cupom_id: PEND_REJ })).data as Jsonb;
      check("admin rejeita pendente → ok, status rejeitado", okr(r) && statusOf(r) === "rejeitado", JSON.stringify(r));
      const { data } = await anonC.from("cupons").select("id").eq("id", PEND_REJ);
      check("cupom rejeitado NÃO aparece p/ anon", (data?.length ?? 0) === 0);
    }
    check("aprovar cupom já moderado → nao_encontrado",
      motivo((await admin.rpc("aprovar_cupom", { p_cupom_id: PEND })).data as Jsonb) === "nao_encontrado");

    console.log("\n[C4 — suspender remove do catálogo público]");
    check("status inválido → status_invalido",
      motivo((await admin.rpc("definir_status_estabelecimento", { p_est_id: "e1", p_status: "pendente" })).data as Jsonb) === "status_invalido");
    const antes = (await anonC.from("cupons").select("id").eq("estabelecimento_id", "e1")).data?.length ?? 0;
    check("anon vê cupons de e1 antes de suspender", antes > 0, String(antes));
    {
      const r = (await admin.rpc("definir_status_estabelecimento", { p_est_id: "e1", p_status: "suspenso" })).data as Jsonb;
      check("admin suspende e1 → ok", okr(r));
      const durante = (await anonC.from("cupons").select("id").eq("estabelecimento_id", "e1")).data?.length ?? 0;
      check("anon NÃO vê cupons de e1 suspenso (0)", durante === 0, String(durante));
    }
    {
      const r = (await admin.rpc("definir_status_estabelecimento", { p_est_id: "e1", p_status: "ativo" })).data as Jsonb;
      check("admin reativa e1 → ok", okr(r));
      const depois = (await anonC.from("cupons").select("id").eq("estabelecimento_id", "e1")).data?.length ?? 0;
      check("anon volta a ver cupons de e1 reativado", depois === antes, `${depois} vs ${antes}`);
    }

    console.log("\n[D3 — economia_total_consumidor: isolada + correta]");
    await limparCiclo(consumidorId);
    await limparCiclo(lojista2Id);
    const { data: c01e } = await svc.from("cupons").select("economia").eq("id", "c01").single();
    const { data: c02e } = await svc.from("cupons").select("economia").eq("id", "c02").single();
    const eco01 = Number(c01e!.economia);
    const eco02 = Number(c02e!.economia);
    // consumidor valida c02
    const a2 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: "c02" })).data as Jsonb;
    const cod2 = (a2 as { estado?: { codigo?: string } }).estado?.codigo ?? "";
    await lojista.rpc("validar_cupom", { p_codigo: cod2 });
    // lojista2 (como consumidor) valida c01
    const a1 = (await lojista2.rpc("ativar_cupom", { p_cupom_id: "c01" })).data as Jsonb;
    const cod1 = (a1 as { estado?: { codigo?: string } }).estado?.codigo ?? "";
    await lojista.rpc("validar_cupom", { p_codigo: cod1 });

    const ecoConsumidor = Number((await consumidor.rpc("economia_total_consumidor")).data);
    const ecoLojista2 = Number((await lojista2.rpc("economia_total_consumidor")).data);
    check("economia do consumidor = economia de c02 (só o seu)", ecoConsumidor === eco02, `${ecoConsumidor} vs ${eco02}`);
    check("economia de lojista2 = economia de c01 (isolada, não soma o do outro)", ecoLojista2 === eco01, `${ecoLojista2} vs ${eco01}`);
    check("A não vê a economia de B (isolamento por auth.uid)", ecoConsumidor !== eco01 || eco01 === eco02, `${ecoConsumidor} vs c01=${eco01}`);
    {
      const anonEco = await anonC.rpc("economia_total_consumidor");
      check("anon (sem sessão) NÃO acessa a RPC de economia (execute revogado)", anonEco.error !== null, anonEco.error ? "" : `vazou data=${anonEco.data}`);
    }
  } finally {
    // restauração — mesmo em falha no meio
    await svc.from("cupons").delete().in("id", [PEND, PEND_REJ]);
    await svc.from("estabelecimentos").update({ status: "ativo" }).eq("id", "e1");
    await limparCiclo(consumidorId);
    await limparCiclo(lojista2Id);
  }

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test-fase3 falhou:", err);
  process.exit(1);
});
