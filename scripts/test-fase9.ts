/**
 * Suíte da Fase 9 — Onda 0 (pontas da Fase 8).
 *
 * Z1 — a nota que o balcão deixou em aberto.
 * Z2 — o cadastro parando de confirmar existência de conta.
 *
 * Asserções por PostgREST DIRETO com sessão real, pelo motivo de sempre: uma
 * regra que só existe na Server Action é contornável por quem fala HTTP.
 *
 * A conta é `qa-*` efêmera — nunca `consumidor@`, que é a régua.
 */
import { readFileSync } from "node:fs";

import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase9");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MENSAGEM_CADASTRO_GENERICA } from "../src/lib/auth-estado";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const SENHA = "promofy123";
const CUPOM_F9 = "f9-nps-pendente";
let passed = 0, failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string, senha = SENHA): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

type Pendente = { row_id: number; cupom_id: string; titulo: string; validado_em: string | null };
const pendentesDe = (estado: unknown): Pendente[] =>
  ((estado as { nps_pendentes?: Pendente[] } | null)?.nps_pendentes ?? []);

async function main(): Promise<number> {
  const dono = await logar("lojista@promofy.test"); // e1 Sabor & Cia
  let qa: ContaQa | null = null;

  try {
    qa = await criarContaQa(svc, "f9", { nome: "Fulana Teste Fase Nove" });
    const cliente = await logar(qa.email, qa.senha);

    // ============================================================
    console.log("\n[Z1] NPS pós-balcão — a nota que o balcão deixou em aberto");
    // ============================================================

    // Cupom PRÓPRIO, com janela 24h. Os dois cupons do e1 no seed têm janela
    // restrita ("Ter a Dom 18h-23h" e "Seg a Sex 11h-15h"), e usá-los deixaria
    // a suíte dependente da HORA em que roda — flakiness que a casa não aceita.
    // A categoria tem de pertencer à junção do e1 (trigger da migration 12).
    const { data: e1 } = await svc
      .from("estabelecimentos").select("categoria_id").eq("id", "e1").maybeSingle();
    const cupom = { id: CUPOM_F9, titulo: "F9 nota pendente" };
    await svc.from("cupons").delete().eq("id", CUPOM_F9);
    const criado = await svc.from("cupons").insert({
      id: CUPOM_F9,
      estabelecimento_id: "e1",
      categoria_id: e1!.categoria_id as string,
      titulo: cupom.titulo,
      beneficio: "Cupom da suíte da Fase 9",
      economia: 10,
      validade_fim: "2035-12-31",
      status: "ativo" as const,
      horarios: { descricao: "todos os dias", dias: [], inicio: "00:00", fim: "23:59" },
    });
    check("cupom do teste criado no e1", !criado.error, criado.error?.message);

    const vazio = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("antes de tudo, a fila de pendentes está vazia", vazio.length === 0, JSON.stringify(vazio));

    const at = (await cliente.rpc("ativar_cupom", { p_cupom_id: cupom.id })).data as any;
    check("qa ativa o cupom", at?.ok === true, JSON.stringify(at));

    // ATIVA (ainda não validada) NÃO é pendência de NPS — é o negativo que
    // impede a fila de virar "todo cupom que você tem".
    const soAtiva = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("ativação apenas ATIVA não entra na fila de NPS",
      soAtiva.length === 0, JSON.stringify(soAtiva));

    // O balcão valida — este é o caminho em que o celular do cliente está
    // ausente e o flip nunca é observado pelo app.
    const val = (await dono.rpc("validar_cupom", { p_codigo: at?.estado?.codigo })).data as any;
    check("lojista valida no balcão", val?.ok === true, JSON.stringify(val?.motivo));

    const fila = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("APÓS a validação no balcão, a fila oferece a pesquisa",
      fila.length === 1, JSON.stringify(fila));
    check("a pendência traz row_id e título (a UI precisa dizer de qual cupom fala)",
      typeof fila[0]?.row_id === "number" && fila[0]?.titulo === cupom.titulo,
      JSON.stringify(fila[0]));
    check("e traz validado_em (é o que ordena a fila)",
      Boolean(fila[0]?.validado_em));

    const rowId = fila[0]!.row_id;
    const r1 = (await cliente.rpc("responder_nps", { p_row_id: rowId, p_nota: 9 })).data as any;
    check("responder credita pontos UMA vez", r1?.ok === true && (r1?.pontos ?? 0) > 0,
      JSON.stringify(r1));

    const r2 = (await cliente.rpc("responder_nps", { p_row_id: rowId, p_nota: 3 })).data as any;
    check("responder de novo NÃO credita (idempotente) e não muda a nota",
      r2?.ok === true && r2?.ja_respondido === true && (r2?.pontos ?? 0) === 0,
      JSON.stringify(r2));

    const depois = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("respondida, a pendência SAI da fila", depois.length === 0, JSON.stringify(depois));

    const { data: linha } = await svc
      .from("cupons_usuario").select("nps").eq("id", rowId).maybeSingle();
    check("a nota gravada é a primeira (9), não a segunda", linha?.nps === 9, String(linha?.nps));


    // ============================================================
    console.log("\n[Z2] Cadastro — sem oráculo explícito de existência");
    // ============================================================

    // A frase não pode afirmar existência. Asserção sobre o TEXTO, porque é
    // ele que o visitante lê.
    check("a mensagem genérica não afirma que o e-mail existe",
      !/já está cadastrado/i.test(MENSAGEM_CADASTRO_GENERICA),
      MENSAGEM_CADASTRO_GENERICA);
    check("…mas ainda aponta o login para quem esqueceu que tem conta",
      /já tem uma conta/i.test(MENSAGEM_CADASTRO_GENERICA));

    // E a action não pode ter sobrado com o texto antigo em nenhum RAMO.
    // Comentários fora antes de olhar: o cabeçalho da action CITA a frase
    // antiga para explicar por que ela saiu, e sem isso a própria explicação
    // seria acusada — foi o que aconteceu na primeira versão deste teste.
    const fonteAction = readFileSync("src/lib/actions/auth.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    check("nenhum ramo do cadastro devolve mais o texto antigo",
      !/Este e-mail já está cadastrado/.test(fonteAction));


    // ============================================================
  } finally {
    await svc.from("cupons").delete().eq("id", CUPOM_F9);
    if (qa) await destruirContaQa(svc, qa.id);
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c));
