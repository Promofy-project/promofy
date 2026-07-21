/**
 * Testes de fluxo da Fase 2 (regras de negócio no servidor).
 * Roda contra o stack local seedado (`npm run db:reset` antes).
 *
 * Prova, ponta a ponta pelas RPCs: ativação com limites e validade,
 * validação transacional (status+evento+pontos 1x), idempotência de
 * NPS, isolamento entre estabelecimentos, expiração e dedup de eventos.
 *
 * Saldos são medidos por DELTA (nunca valor absoluto) — o bônus de
 * boas-vindas e execuções anteriores não interferem.
 */
import { config } from "dotenv";
// Alvo padrão = stack local; `--hosted` roda contra o Supabase hospedado
// (.env.hosted.local). ATENÇÃO: esta suite MUTA dados (força expiração,
// consome cupom via service_role) — restaure o hosted após rodar.
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
console.log(`\n[test-fase2] alvo: ${hosted ? "HOSPEDADO (muta dados!)" : "local"} (${new URL(url).host})\n`);
const SENHA = "promofy123";
let passed = 0;
let failed = 0;

function check(nome: string, ok: boolean, detalhe = "") {
  if (ok) { passed++; console.log(`  PASS  ${nome}`); }
  else { failed++; console.log(`  FAIL  ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

const svc = createClient(url!, serviceRole!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string): Promise<SupabaseClient> {
  const c = createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

type Jsonb = Record<string, unknown> | null;
const motivo = (r: Jsonb) => (r as { motivo?: string })?.motivo;
const ok = (r: Jsonb) => (r as { ok?: boolean })?.ok === true;

async function saldo(uid: string): Promise<number> {
  const { data } = await svc
    .from("pontos_transacoes")
    .select("pontos")
    .eq("usuario_id", uid);
  return (data ?? []).reduce((s, r) => s + (r.pontos as number), 0);
}
async function metrica(cupom: string, campo: string): Promise<number> {
  const { data } = await svc.from("cupom_metricas").select("*").eq("cupom_id", cupom).maybeSingle();
  return Number((data as Record<string, unknown> | null)?.[campo] ?? 0);
}
async function limparCiclo(uid: string) {
  await svc.from("cupons_usuario").delete().eq("usuario_id", uid);
  await svc.from("cupom_eventos").delete().eq("usuario_id", uid);
  await svc.from("pontos_transacoes").delete().eq("usuario_id", uid).neq("acao", "bonus");
}

async function main() {
  const consumidor = await logar("consumidor@promofy.test");
  const uid = (await consumidor.auth.getUser()).data.user!.id;
  const lojista = await logar("lojista@promofy.test");   // e1
  const lojista2 = await logar("lojista2@promofy.test"); // e2

  await limparCiclo(uid);

  // c01 = e1 (do lojista), validade futura garantida pelo seed relativo.
  console.log("\n[ativação]");
  const visAntes = await metrica("c01", "ativacoes");
  let r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: "c01" })).data as Jsonb;
  const estado = (r as { estado?: { codigo?: string; row_id?: number; expira_em?: string } })?.estado;
  const codigo = estado?.codigo ?? "";
  check("ativar c01 → ok + código PRMF", ok(r) && /^PRMF-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codigo), JSON.stringify(r));
  {
    const dt = estado?.expira_em ? new Date(estado.expira_em).getTime() - Date.now() : 0;
    const horas = dt / 3_600_000;
    check("expira_em ≈ agora + 5h", horas > 4.9 && horas < 5.1, `${horas.toFixed(2)}h`);
  }
  check("ativar gravou evento 'ativacao' (métrica +1)", (await metrica("c01", "ativacoes")) === visAntes + 1);
  {
    r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: "c01" })).data as Jsonb;
    check("reativar vigente é idempotente (ja_ativo, mesmo código)",
      ok(r) && (r as { ja_ativo?: boolean }).ja_ativo === true &&
      (r as { estado?: { codigo?: string } }).estado?.codigo === codigo, JSON.stringify(r));
  }

  console.log("\n[ativação — rejeições]");
  check("ativar cupom inexistente → nao_encontrado",
    motivo((await consumidor.rpc("ativar_cupom", { p_cupom_id: "nao-existe" })).data as Jsonb) === "nao_encontrado");
  check("ativar cupom de estabelecimento suspenso (c11/e6) → indisponivel",
    motivo((await consumidor.rpc("ativar_cupom", { p_cupom_id: "c11" })).data as Jsonb) === "indisponivel");
  check("ativar cupom 'indisponivel' (c04) → indisponivel",
    motivo((await consumidor.rpc("ativar_cupom", { p_cupom_id: "c04" })).data as Jsonb) === "indisponivel");

  console.log("\n[validação — permissão e posse]");
  check("consumidor chama validar_cupom → sem_permissao",
    motivo((await consumidor.rpc("validar_cupom", { p_codigo: codigo })).data as Jsonb) === "sem_permissao");
  check("lojista2 (e2) valida código do e1 → outro_estabelecimento",
    motivo((await lojista2.rpc("validar_cupom", { p_codigo: codigo })).data as Jsonb) === "outro_estabelecimento");
  check("validar código inexistente → nao_encontrado",
    motivo((await lojista.rpc("validar_cupom", { p_codigo: "PRMF-ZZZZ-ZZZZ" })).data as Jsonb) === "nao_encontrado");

  console.log("\n[validação — sucesso transacional]");
  const saldoAntes = await saldo(uid);
  const resgAntes = await metrica("c01", "resgates");
  const { data: cfg } = await svc.from("config_pontos").select("pontos").eq("acao", "resgate").single();
  const ptsResgate = cfg!.pontos as number;
  r = (await lojista.rpc("validar_cupom", { p_codigo: codigo })).data as Jsonb;
  const dados = (r as { dados?: { cliente_cpf?: string; titulo?: string } })?.dados;
  check("lojista valida → ok", ok(r), JSON.stringify(r));
  check("retorno traz CPF MASCARADO (123.***.***-09)", /^\d{3}\.\*{3}\.\*{3}-\d{2}$/.test(dados?.cliente_cpf ?? ""), dados?.cliente_cpf);
  check("saldo += pontos de resgate (config_pontos)", (await saldo(uid)) === saldoAntes + ptsResgate);
  check("evento 'validacao' gravado (resgates +1)", (await metrica("c01", "resgates")) === resgAntes + 1);
  {
    const { data: row } = await svc.from("cupons_usuario").select("status,validado_em").eq("codigo", codigo).single();
    check("linha vira 'validado' com validado_em", row?.status === "validado" && !!row?.validado_em);
  }
  {
    r = (await lojista.rpc("validar_cupom", { p_codigo: codigo })).data as Jsonb;
    check("revalidar → ja_validado (nada muda)", motivo(r) === "ja_validado");
    check("ledger de resgate continua 1 (sem duplicar)", (await saldo(uid)) === saldoAntes + ptsResgate);
  }

  console.log("\n[NPS — idempotente]");
  const { data: rowVal } = await svc.from("cupons_usuario").select("id").eq("codigo", codigo).single();
  const rowId = rowVal!.id as number;
  const saldoPreNps = await saldo(uid);
  const { data: cfgNps } = await svc.from("config_pontos").select("pontos").eq("acao", "nps").single();
  r = (await consumidor.rpc("responder_nps", { p_row_id: rowId, p_nota: 9 })).data as Jsonb;
  check("responder NPS → ok, credita 1x", ok(r) && (r as { ja_respondido?: boolean }).ja_respondido === false);
  check("saldo += pontos de NPS", (await saldo(uid)) === saldoPreNps + (cfgNps!.pontos as number));
  {
    r = (await consumidor.rpc("responder_nps", { p_row_id: rowId, p_nota: 3 })).data as Jsonb;
    check("responder NPS de novo → ja_respondido", ok(r) && (r as { ja_respondido?: boolean }).ja_respondido === true);
    check("saldo NPS não duplica", (await saldo(uid)) === saldoPreNps + (cfgNps!.pontos as number));
  }

  console.log("\n[expiração]");
  await limparCiclo(uid);
  r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: "c02" })).data as Jsonb;
  const codigoC02 = (r as { estado?: { codigo?: string } }).estado?.codigo ?? "";
  // força expiração via service_role (simula passar do prazo)
  await svc.from("cupons_usuario").update({ expira_em: new Date(Date.now() - 60_000).toISOString() }).eq("codigo", codigoC02);
  check("lojista valida código expirado → expirado",
    motivo((await lojista.rpc("validar_cupom", { p_codigo: codigoC02 })).data as Jsonb) === "expirado");
  {
    // após expirar, consumidor pode reativar (limite_por_usuario=1 liberado)
    r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: "c02" })).data as Jsonb;
    check("reativar após expiração é permitido", ok(r) && (r as { ja_ativo?: boolean }).ja_ativo === false, JSON.stringify(r));
  }

  console.log("\n[limite_total — recheck na validação]");
  {
    // c03 (e2): força limite_total=1; dois consumidores ativam; 2ª validação = esgotado
    await svc.from("cupons").update({ limite_total: 1 }).eq("id", "c03");
    const c2 = await logar("consumidor@promofy.test"); // reusa; e um segundo user:
    void c2;
    // usa admin como 2º "consumidor" de teste (tem sessão; RPC funciona p/ qualquer autenticado)
    const admin = await logar("admin@promofy.test");
    const adminId = (await admin.auth.getUser()).data.user!.id;
    await limparCiclo(uid); await limparCiclo(adminId);
    const rA = (await consumidor.rpc("ativar_cupom", { p_cupom_id: "c03" })).data as Jsonb;
    const rB = (await admin.rpc("ativar_cupom", { p_cupom_id: "c03" })).data as Jsonb;
    const codA = (rA as { estado?: { codigo?: string } }).estado?.codigo ?? "";
    const codB = (rB as { estado?: { codigo?: string } }).estado?.codigo ?? "";
    check("dois usuários ativam c03 (limite_total=1 ainda não valida)", ok(rA) && ok(rB));
    const v1 = motivo((await lojista2.rpc("validar_cupom", { p_codigo: codA })).data as Jsonb);
    const v2 = motivo((await lojista2.rpc("validar_cupom", { p_codigo: codB })).data as Jsonb);
    check("1ª validação passa, 2ª → esgotado", v1 === undefined && v2 === "esgotado", `v1=${v1} v2=${v2}`);
    await svc.from("cupons").update({ limite_total: null }).eq("id", "c03");
    await limparCiclo(adminId);
  }

  console.log("\n[eventos do app — dedup]");
  await limparCiclo(uid);
  await consumidor.rpc("registrar_evento_cupom", { p_cupom_id: "c05", p_tipo: "visualizacao" });
  await consumidor.rpc("registrar_evento_cupom", { p_cupom_id: "c05", p_tipo: "visualizacao" });
  {
    const { data } = await svc.from("cupom_eventos").select("id").eq("usuario_id", uid).eq("cupom_id", "c05").eq("tipo", "visualizacao");
    check("visualização dedup 1/dia (2 chamadas → 1 linha)", (data?.length ?? 0) === 1);
  }
  {
    const { error } = await consumidor.rpc("registrar_evento_cupom", { p_cupom_id: "c05", p_tipo: "validacao" });
    check("registrar_evento recusa tipo 'validacao'", !!error);
  }

  await limparCiclo(uid);
  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test-fase2 falhou:", err);
  process.exit(1);
});
