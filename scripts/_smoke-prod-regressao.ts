/**
 * Regressão essencial em PRODUÇÃO — item (e) do smoke da Fase 7.
 *
 * Usa SESSÕES REAIS (anon key + login), nunca service_role: o que se quer
 * provar são as barreiras do servidor como o usuário as encontra. O
 * service_role passa por cima de RLS e do trigger, então provaria nada.
 *
 * `consumidor@` é a RÉGUA e não é tocado. `convidado@` é a conta de
 * demonstração e ganha o rastro (aprovado pelo dono).
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("smoke-prod-regressao");
if (!alvo.producao) { console.error("Use --hosted."); process.exit(1); }

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SENHA = "promofy123";
let passed = 0, failed = 0;
const check = (n: string, ok: boolean, d = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const CAFE = "84e451a7-7cef-485d-9f66-6ccb8760b1b6"; // ilimitado, janela 24h
const C01 = "c01";                                   // Ter-Dom 18:00-23:00
const CONVIDADO = "fc5a668c-6841-4679-bdf3-6ba1b95bc1fb";
const CONSUMIDOR = "56fe747c-cb26-4b5b-94f6-a5be2964fa27";

async function estado(uid: string) {
  const p = await svc.from("pontos_transacoes").select("pontos").eq("usuario_id", uid);
  const l = await svc.from("cupons_usuario").select("id", { count: "exact", head: true }).eq("usuario_id", uid);
  return { pts: (p.data ?? []).reduce((s, r) => s + r.pontos, 0), linhas: l.count ?? 0 };
}

async function main(): Promise<number> {
  const antesConv = await estado(CONVIDADO);
  const antesCons = await estado(CONSUMIDOR);
  console.log(`baseline: convidado@ ${antesConv.pts}/${antesConv.linhas} · consumidor@ ${antesCons.pts}/${antesCons.linhas}\n`);

  const conv = await logar("convidado@promofy.test");
  const dono = await logar("lojista@promofy.test");
  const outro = await logar("lojista2@promofy.test");
  const admin = await logar("admin@promofy.test");

  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = Number(agora.slice(11, 13));
  const diaSem = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" });
  console.log(`agora em BRT: ${agora} (${diaSem}, hora ${hora})\n`);

  // ---------- FLUXO PRINCIPAL ----------
  console.log("FLUXO PRINCIPAL — ativar → validar → NPS → pontos");
  const at = (await conv.rpc("ativar_cupom", { p_cupom_id: CAFE })).data as any;
  check("convidado@ ativa o cupom", at?.ok === true, at?.motivo);
  const codigo = at?.estado?.codigo;
  check("código gerado no formato PRMF-XXXX-XXXX", /^PRMF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo ?? ""), codigo);

  const val = (await dono.rpc("validar_cupom", { p_codigo: codigo })).data as any;
  check("lojista@ valida no balcão", val?.ok === true, val?.motivo);
  check("CPF volta MASCARADO, nunca completo", /^\d{3}\.\*{3}\.\*{3}-\d{2}$/.test(val?.dados?.cliente_cpf ?? ""), val?.dados?.cliente_cpf);

  const rowId = at?.estado?.row_id;
  const nps = (await conv.rpc("responder_nps", { p_row_id: rowId, p_nota: 10 })).data as any;
  check("convidado@ responde NPS e recebe pontos", nps?.ok === true && (nps?.pontos ?? 0) > 0, `pontos=${nps?.pontos}`);

  const depoisFluxo = await estado(CONVIDADO);
  check("pontos creditados (resgate + NPS)", depoisFluxo.pts > antesConv.pts, `${antesConv.pts} → ${depoisFluxo.pts}`);

  // ---------- F5: barreira de janela ----------
  console.log("\nF5 — barreira de janela no servidor");
  const dentroJanela = ["ter.", "qua.", "qui.", "sex.", "sáb.", "dom."].includes(diaSem) && hora >= 18 && hora < 23;
  const j = (await conv.rpc("ativar_cupom", { p_cupom_id: C01 })).data as any;
  if (dentroJanela) {
    check("c01 DENTRO da janela (Ter-Dom 18-23h) → aceita", j?.ok === true || j?.motivo === "limite_atingido", j?.motivo);
    console.log("        (agora está dentro da janela; a recusa por fora_da_janela não é testável neste horário)");
  } else {
    check("c01 FORA da janela → recusado com 'fora_da_janela'", j?.motivo === "fora_da_janela", j?.motivo ?? "aceitou!");
  }

  // ---------- F6: ilimitado e "mais de" ----------
  console.log("\nF6 — ilimitado por usuário e economia variável");
  const est = (await conv.rpc("meu_estado_consumidor")).data as any;
  const usoCafe = (est?.usos ?? []).find((u: any) => u.cupom_id === CAFE);
  check("Café do dia é ilimitado (limite null) e pode_reusar", usoCafe?.limite === null && usoCafe?.pode_reusar === true, JSON.stringify(usoCafe));
  const eco = (await conv.rpc("economia_consumidor")).data as any;
  check("economia total marca inclui_variavel → UI mostra 'mais de'", eco?.inclui_variavel === true, JSON.stringify(eco));

  // ---------- F6.5: matriz de edição + rejeição com motivo ----------
  console.log("\nF6.5 — matriz de imutabilidade e rejeição com motivo");
  const eMatriz = await dono.from("cupons").update({ economia: 999 }).eq("id", CAFE).select("id");
  check("economia bloqueada pelo trigger (P0601) com clientes que validaram", eMatriz.error?.code === "P0601", eMatriz.error?.code ?? "PASSOU!");
  const eTitulo = await dono.from("cupons").update({ titulo: "Café do dia" }).eq("id", CAFE).select("id");
  check("título (não-material) continua editável", !eTitulo.error, eTitulo.error?.message);

  const rejSemMotivo = (await admin.rpc("rejeitar_cupom", { p_cupom_id: CAFE, p_motivo: "   " })).data as any;
  check("rejeitar sem motivo → 'motivo_obrigatorio'", rejSemMotivo?.motivo === "motivo_obrigatorio", JSON.stringify(rejSemMotivo));

  const alheio = await outro.from("cupons").update({ titulo: "invadido" }).eq("id", CAFE).select("id");
  check("lojista2 não edita cupom do e1 (policy filtra)", !alheio.error && (alheio.data ?? []).length === 0, alheio.error?.code);

  // ---------- a régua ----------
  console.log("\nA RÉGUA");
  const depoisCons = await estado(CONSUMIDOR);
  check("consumidor@ INTOCADO", depoisCons.pts === antesCons.pts && depoisCons.linhas === antesCons.linhas,
        `${antesCons.pts}/${antesCons.linhas} → ${depoisCons.pts}/${depoisCons.linhas}`);

  const fim = await estado(CONVIDADO);
  console.log(`\nconvidado@: ${antesConv.pts}/${antesConv.linhas} → ${fim.pts}/${fim.linhas}`);
  console.log(`Resultado: ${passed} PASS, ${failed} FAIL`);
  return failed > 0 ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
