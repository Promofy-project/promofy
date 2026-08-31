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
import { janelaAlcancavel, type JanelaConsumo } from "../src/lib/janela";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const SENHA = "promofy123";
const CUPOM_F9 = "f9-nps-pendente";
const CUPOM_ANTECIPADO = "f9-janela-antecipada";
const CUPOM_LONGE = "f9-janela-longe";
const CUPOM_RECUSA = "f9-nps-recusa";
const CUPOM_FILA_A = "f9-nps-fila-a";
const CUPOM_FILA_B = "f9-nps-fila-b";

/** Retorno de `janela_alcance` (migration 29). */
type Alcance = { alcancavel: boolean; teto: string | null };

/**
 * "HH:MM" em BRT. `Intl` é aceitável AQUI — a proibição do CLAUDE.md vale
 * para `src/lib`, que atravessa para o React Native; este script roda no
 * Node local. Mesmo padrão de `test-fase5.ts`.
 */
function horaBrt(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  return `${p.find((x) => x.type === "hour")!.value}:${p.find((x) => x.type === "minute")!.value}`;
}

/** Desloca "HH:MM" por N horas, com wraparound de 24h. */
function deslocarHoras(hhmm: string, horas: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h + horas) % 24) + 24) % 24;
  return `${String(total).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
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

/**
 * Lançamentos de NPS no livro-razão de um usuário.
 *
 * Saldo igual não prova ledger intocado — dois lançamentos que se anulam dão
 * o mesmo saldo. Para "recusar não credita" a asserção honesta conta LINHAS.
 */
async function contarNps(usuarioId: string): Promise<number> {
  const { data } = await svc
    .from("pontos_transacoes").select("id").eq("usuario_id", usuarioId).eq("acao", "nps");
  return (data ?? []).length;
}

/** Eventos por tipo de UM cupom — a prova de que cliques ≥ ativações. */
async function contarEventos(cupomId: string): Promise<{ clique: number; ativacao: number }> {
  const { data } = await svc
    .from("cupom_eventos").select("tipo").eq("cupom_id", cupomId);
  const linhas = (data ?? []) as { tipo: string }[];
  return {
    clique: linhas.filter((l) => l.tipo === "clique").length,
    ativacao: linhas.filter((l) => l.tipo === "ativacao").length,
  };
}

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
      .from("estabelecimentos").select("categoria_id, categoria_principal_id").eq("id", "e1").maybeSingle();
    // MARCO 2B (CONTRACT): categoria_nova_id agora é NOT NULL.
    const catNovaE1 = e1!.categoria_principal_id as string;
    const cupom = { id: CUPOM_F9, titulo: "F9 nota pendente" };
    await svc.from("cupons").delete().eq("id", CUPOM_F9);
    const criado = await svc.from("cupons").insert({
      id: CUPOM_F9,
      estabelecimento_id: "e1",
      categoria_id: e1!.categoria_id as string,
      categoria_nova_id: catNovaE1,
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
    console.log("\n[Z1b] Adendo 05/08 — as três saídas do card de NPS");
    // ============================================================

    // Cupom PRÓPRIO para a recusa, e não uma segunda ativação do anterior:
    // `limite_por_usuario` nasce 1 (schema inicial), então reativar o mesmo
    // cupom seria recusado por limite — e afrouxá-lo mexeria nas asserções de
    // `usos` que o Z1 já faz em cima daquele cupom.
    await svc.from("cupons").delete().eq("id", CUPOM_RECUSA);
    const criadoRec = await svc.from("cupons").insert({
      id: CUPOM_RECUSA,
      estabelecimento_id: "e1",
      categoria_id: e1!.categoria_id as string,
      categoria_nova_id: catNovaE1,
      titulo: "F9 nota recusada",
      beneficio: "Cupom da suíte do adendo 05/08",
      economia: 10,
      validade_fim: "2035-12-31",
      status: "ativo" as const,
      horarios: { descricao: "todos os dias", dias: [], inicio: "00:00", fim: "23:59" },
    });
    check("cupom da recusa criado no e1", !criadoRec.error, criadoRec.error?.message);

    const at2 = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_RECUSA })).data as any;
    check("qa ativa o cupom da recusa", at2?.ok === true, JSON.stringify(at2));
    const val2 = (await dono.rpc("validar_cupom", { p_codigo: at2?.estado?.codigo })).data as any;
    check("lojista valida a segunda no balcão", val2?.ok === true, JSON.stringify(val2?.motivo));

    const fila2 = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("a segunda validação entra na fila", fila2.length === 1, JSON.stringify(fila2));
    const rowId2 = fila2[0]!.row_id;

    // ---- "Responder mais tarde" ----
    // É estado de SESSÃO no provider (`dispensarNpsPendente`), e o teste do
    // banco é justamente que ele NÃO deixa marca: uma segunda leitura do
    // servidor — que é o que uma nova abertura do app faz — reoferece.
    const filaDeNovo = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("\"responder mais tarde\" não grava nada — a fila reoferece na próxima leitura",
      filaDeNovo.length === 1 && filaDeNovo[0]!.row_id === rowId2,
      JSON.stringify(filaDeNovo));
    const fonteProvider = readFileSync("src/components/coupon-state-provider.tsx", "utf8");
    check("…e o dispensar continua sem tocar em nenhuma action",
      /dispensarNpsPendente: \(\) =>\s*\n?\s*setFilaNps\(\(prev\) => prev\.slice\(1\)\)/.test(fonteProvider));

    // ---- "Não responder" ----
    const saldoAntes = ((await cliente.rpc("meu_estado_consumidor")).data as any)?.saldo ?? -1;

    // Recusar o que é de OUTRA pessoa não pode funcionar — e o motivo não
    // distingue "não é sua" de "não existe".
    const alheio = (await dono.rpc("recusar_nps", { p_row_id: rowId2 })).data as any;
    check("recusar a pendência de outra pessoa é recusado",
      alheio?.ok === false && alheio?.motivo === "nao_encontrado", JSON.stringify(alheio));

    const rec1 = (await cliente.rpc("recusar_nps", { p_row_id: rowId2 })).data as any;
    check("\"não responder\" é aceito", rec1?.ok === true && rec1?.ja_recusado === false,
      JSON.stringify(rec1));

    const filaPosRecusa = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("recusada, a pendência SAI da fila para sempre",
      filaPosRecusa.length === 0, JSON.stringify(filaPosRecusa));

    const saldoDepois = ((await cliente.rpc("meu_estado_consumidor")).data as any)?.saldo ?? -2;
    check("recusar NÃO credita pontos", saldoDepois === saldoAntes,
      `${saldoAntes} → ${saldoDepois}`);

    const { data: linhaRec } = await svc
      .from("cupons_usuario").select("nps, nps_recusado_em").eq("id", rowId2).maybeSingle();
    check("a recusa fica carimbada e a nota continua nula",
      linhaRec?.nps === null && Boolean(linhaRec?.nps_recusado_em),
      JSON.stringify(linhaRec));

    const rec2 = (await cliente.rpc("recusar_nps", { p_row_id: rowId2 })).data as any;
    const { data: linhaRec2 } = await svc
      .from("cupons_usuario").select("nps_recusado_em").eq("id", rowId2).maybeSingle();
    check("recusar de novo é idempotente e preserva o carimbo da PRIMEIRA recusa",
      rec2?.ok === true && rec2?.ja_recusado === true &&
        linhaRec2?.nps_recusado_em === linhaRec?.nps_recusado_em,
      JSON.stringify({ rec2, antes: linhaRec?.nps_recusado_em, depois: linhaRec2?.nps_recusado_em }));

    // Recusar uma JÁ RESPONDIDA não pode apagar a resposta da história.
    const recRespondida = (await cliente.rpc("recusar_nps", { p_row_id: rowId })).data as any;
    const { data: linhaResp } = await svc
      .from("cupons_usuario").select("nps, nps_recusado_em").eq("id", rowId).maybeSingle();
    check("recusar uma já respondida não marca recusa nem mexe na nota",
      recRespondida?.ok === true && recRespondida?.ja_respondido === true &&
        linhaResp?.nps === 9 && linhaResp?.nps_recusado_em === null,
      JSON.stringify({ recRespondida, linhaResp }));

    // A coluna nova entra no regime da migration 2: escrita só por RPC.
    const patch = await cliente
      .from("cupons_usuario")
      .update({ nps_recusado_em: null } as never)
      .eq("id", rowId2)
      .select("id");
    check("PostgREST não consegue desfazer a recusa por PATCH (sem grant de UPDATE)",
      Boolean(patch.error) || (patch.data ?? []).length === 0,
      JSON.stringify({ erro: patch.error?.message, linhas: patch.data }));

    // ---- recusar → responder: PROIBIDO NO SERVIDOR ----
    // A asserção mais importante deste bloco. Sem ela, "encerramento
    // definitivo" seria promessa da tela: bastava chamar a RPC com o row_id
    // para ressuscitar a pesquisa, gravar nota e levar os pontos que a recusa
    // dizia não creditar. A UI não é fronteira.
    const ledgerAntes = await contarNps(qa!.id);
    const revive = (await cliente.rpc("responder_nps", { p_row_id: rowId2, p_nota: 10 })).data as any;
    const { data: linhaRevive } = await svc
      .from("cupons_usuario").select("nps, nps_recusado_em").eq("id", rowId2).maybeSingle();
    const saldoPosRevive = ((await cliente.rpc("meu_estado_consumidor")).data as any)?.saldo ?? -3;
    const ledgerDepois = await contarNps(qa!.id);
    check("responder DEPOIS de recusar é recusado com motivo próprio",
      revive?.ok === false && revive?.motivo === "nps_recusado", JSON.stringify(revive));
    check("…e a nota continua NULL (nada foi gravado)",
      linhaRevive?.nps === null, String(linhaRevive?.nps));
    check("…e a recusa continua carimbada",
      linhaRevive?.nps_recusado_em === linhaRec?.nps_recusado_em);
    check("…e o saldo não muda", saldoPosRevive === saldoAntes,
      `${saldoAntes} → ${saldoPosRevive}`);
    check("…e o ledger não ganha lançamento de nps",
      ledgerDepois === ledgerAntes, `${ledgerAntes} → ${ledgerDepois}`);

    // ---- o ESTADO precisa deixar a recusa visível ----
    // `nps === null` sozinho é ambíguo: diz "ainda pode responder" e "encerrou
    // de vez". Quem lê só o `nps` oferece avaliação sobre pesquisa fechada —
    // era o caso do rodapé de `cupom-ativo-sheet`.
    const estadosPos = ((await cliente.rpc("meu_estado_consumidor")).data as any)?.estados ?? [];
    const estadoRecusado = (estadosPos as any[]).find((e) => e.row_id === rowId2);
    check("estados[] expõe nps_recusado_em para a linha recusada",
      Boolean(estadoRecusado) && estadoRecusado.nps === null &&
        Boolean(estadoRecusado.nps_recusado_em),
      JSON.stringify(estadoRecusado));
    const estadoRespondido = (estadosPos as any[]).find((e) => e.row_id === rowId);
    check("…e a linha RESPONDIDA sai com nps preenchido e recusa nula",
      Boolean(estadoRespondido) && estadoRespondido.nps === 9 &&
        estadoRespondido.nps_recusado_em === null,
      JSON.stringify(estadoRespondido));


    // ============================================================
    console.log("\n[Z1c] Fila com DUAS pendências — uma por vez, mais recente primeiro");
    // ============================================================

    // Até aqui a fila nunca teve mais de uma linha ao mesmo tempo: a ordem e o
    // "uma por vez" eram garantidos por leitura do SQL, não por medição.
    const filaCupons = [CUPOM_FILA_A, CUPOM_FILA_B];
    for (const id of filaCupons) {
      await svc.from("cupons").delete().eq("id", id);
      await svc.from("cupons").insert({
        id,
        estabelecimento_id: "e1",
        categoria_id: e1!.categoria_id as string,
        categoria_nova_id: catNovaE1,
        titulo: `F9 fila ${id.slice(-1).toUpperCase()}`,
        beneficio: "Cupom da suíte do adendo 05/08 (fila)",
        economia: 10,
        validade_fim: "2035-12-31",
        status: "ativo" as const,
        horarios: { descricao: "todos os dias", dias: [], inicio: "00:00", fim: "23:59" },
      });
    }

    // Validadas em ORDEM: A primeiro, B depois. B é a mais recente.
    const rowsFila: number[] = [];
    for (const id of filaCupons) {
      const a = (await cliente.rpc("ativar_cupom", { p_cupom_id: id })).data as any;
      const v = (await dono.rpc("validar_cupom", { p_codigo: a?.estado?.codigo })).data as any;
      if (v?.ok !== true) check(`validação da fila (${id})`, false, JSON.stringify(v));
      rowsFila.push(a?.estado?.row_id as number);
    }

    const duas = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("as DUAS pendências convivem na fila", duas.length === 2,
      JSON.stringify(duas.map((p) => p.row_id)));
    check("a mais RECENTE vem primeiro (B antes de A)",
      duas[0]?.row_id === rowsFila[1] && duas[1]?.row_id === rowsFila[0],
      JSON.stringify({ fila: duas.map((p) => p.row_id), esperado: [rowsFila[1], rowsFila[0]] }));

    // Recusar a cabeça: a segunda vira a cabeça. É o "uma por vez" do card.
    await cliente.rpc("recusar_nps", { p_row_id: duas[0]!.row_id });
    const restou = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("recusada a cabeça, a fila passa a oferecer a SEGUINTE",
      restou.length === 1 && restou[0]?.row_id === rowsFila[0],
      JSON.stringify(restou));

    // Responder a que sobrou esvazia a fila — e credita normalmente.
    const respFila = (await cliente.rpc("responder_nps", { p_row_id: restou[0]!.row_id, p_nota: 8 })).data as any;
    const vazia = pendentesDe((await cliente.rpc("meu_estado_consumidor")).data);
    check("NPS normal continua respondendo e creditando UMA vez depois de tudo isso",
      respFila?.ok === true && (respFila?.pontos ?? 0) > 0, JSON.stringify(respFila));
    check("respondida a última, a fila fica vazia", vazia.length === 0, JSON.stringify(vazia));


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
    console.log("\n[Z3] Janela alcançável + clique no servidor (QA v2 §3.1 e §3.3)");
    // ============================================================

    // ANCORADO NO RELÓGIO DO BANCO, nunca no da máquina: a janela é
    // decidida em BRT dentro do Postgres, e a suíte precisa valer rodando
    // de qualquer fuso. `ativado_em` do Z1 é esse relógio, já observado.
    const relogioDb = new Date(at?.estado?.ativado_em ?? Date.now());
    console.log(`  ..  relógio do banco: ${horaBrt(relogioDb)} BRT`);

    const nulo = (await svc.rpc("janela_alcance", {
      p_horarios: null, p_prazo_horas: 5,
    })).data as Alcance | null;
    check("janela_alcance trata horários nulos como sem restrição",
      nulo?.alcancavel === true && nulo?.teto === null, JSON.stringify(nulo));

    const { data: e1cat } = await svc
      .from("estabelecimentos").select("categoria_id, categoria_principal_id").eq("id", "e1").maybeSingle();
    // MARCO 2B (CONTRACT): categoria_nova_id agora é NOT NULL.
    const catNovaE1Janela = e1cat!.categoria_principal_id as string;

    /** Janela ancorada no relógio do BANCO, aberta de +ini a +fim horas. */
    const janela = (ini: number, fim: number) => ({
      descricao: `+${ini}h a +${fim}h`,
      dias: [] as string[],           // sem restrição de dia: só o horário decide
      inicio: deslocarHoras(horaBrt(relogioDb), ini),
      fim: deslocarHoras(horaBrt(relogioDb), fim),
    });

    const criarCupom = async (id: string, titulo: string, h: object) => {
      await svc.from("cupons").delete().eq("id", id);
      return svc.from("cupons").insert({
        id,
        estabelecimento_id: "e1",
        categoria_id: e1cat!.categoria_id as string,
        categoria_nova_id: catNovaE1Janela,
        titulo,
        beneficio: "Cupom da suíte da Fase 9 — janela controlada",
        economia: 10,
        validade_fim: "2035-12-31",
        status: "ativo" as const,
        prazo_ativacao_horas: 5,
        horarios: h,
      });
    };

    // ---- caso 1: janela que ABRE dentro do prazo → aceita, com teto ----
    // Abre em 1h, fecha em 3h. Antes da migration 30 isto era recusado, e
    // era a queixa do relatório: o consumidor perdia o cupom por chegar cedo.
    const { error: errAnt } = await criarCupom(
      CUPOM_ANTECIPADO, "F9 janela antecipada", janela(1, 3));
    check("cupom com janela que abre em 1h criado", !errAnt, errAnt?.message);

    const antes = await contarEventos(CUPOM_ANTECIPADO);
    const rAnt = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_ANTECIPADO }))
      .data as any;
    check("ANTECIPADA: ativação é aceita quando o prazo alcança a janela",
      rAnt?.ok === true, JSON.stringify(rAnt?.motivo ?? rAnt));

    // O TETO É O PONTO TODO: sem ele o código valeria até agora+5h e seria
    // validável no balcão DEPOIS que a janela fechou — fora do horário que o
    // lojista definiu. Aqui a janela fecha em +3h e o prazo daria +5h.
    const alc = (await svc.rpc("janela_alcance", {
      p_horarios: janela(1, 3), p_prazo_horas: 5,
    })).data as Alcance | null;
    const expira = rAnt?.estado?.expira_em ? new Date(rAnt.estado.expira_em) : null;
    const teto = alc?.teto ? new Date(alc.teto) : null;
    check("ANTECIPADA: expira_em é limitado ao fim da janela, não a agora+5h",
      Boolean(expira && teto && expira.getTime() <= teto.getTime() + 60_000),
      `expira=${expira?.toISOString()} teto=${teto?.toISOString()}`);

    const depoisAt = await contarEventos(CUPOM_ANTECIPADO);
    check("CLIQUE: ativação bem-sucedida grava clique E ativação no servidor",
      depoisAt.clique === antes.clique + 1 && depoisAt.ativacao === antes.ativacao + 1,
      JSON.stringify(depoisAt));

    // ---- caso 2: janela longe demais → recusa, mas o clique conta ----
    // Abre em 9h, com prazo de 5h: continua fora de alcance, e é o negativo
    // que impede a regra nova de virar "sempre aceita".
    const { error: errLonge } = await criarCupom(
      CUPOM_LONGE, "F9 janela fora de alcance", janela(9, 11));
    check("cupom com janela a 9h criado", !errLonge, errLonge?.message);

    const antesL = await contarEventos(CUPOM_LONGE);
    const rLonge = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_LONGE }))
      .data as any;
    check("FORA DE ALCANCE: 9h > prazo de 5h → recusa com fora_da_janela",
      rLonge?.ok === false && rLonge?.motivo === "fora_da_janela",
      JSON.stringify(rLonge));

    const depoisL = await contarEventos(CUPOM_LONGE);
    check("CLIQUE: tentativa RECUSADA grava clique e NENHUMA ativação",
      depoisL.clique === antesL.clique + 1 && depoisL.ativacao === antesL.ativacao,
      JSON.stringify(depoisL));

    // É esta a relação que o funil do portal mostrava quebrada: com o clique
    // no cliente (fire-and-forget), uma ativação podia existir sem o clique
    // que a originou.
    check("CLIQUE: cliques >= ativações em ambos os cupons",
      depoisAt.clique >= depoisAt.ativacao && depoisL.clique >= depoisL.ativacao,
      `${JSON.stringify(depoisAt)} ${JSON.stringify(depoisL)}`);

    // E o cliente não pode mais mandar o clique por conta própria.
    const fonteAcao = readFileSync("src/components/cupom-acao-usar.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    check("o cliente NÃO registra mais o clique (agora é ativar_cupom)",
      !/registrarEventoAction\([^)]*clique/.test(fonteAcao));

    // ---- paridade do espelho: se o TS e o SQL divergirem, a UI mente ----
    // A Fase 5 estabeleceu que `src/lib/janela.ts` replica o SQL caso a
    // caso. `janelaAlcancavel` herda a obrigação: um botão esmaecido sobre
    // uma RPC que aceitaria é o "botão inerte" de novo.
    const casos: [string, object, number][] = [
      ["aberta agora", janela(-1, 2), 5],
      ["abre em 1h (dentro do prazo)", janela(1, 3), 5],
      ["abre em 9h (fora do prazo)", janela(9, 11), 5],
      ["abre em 9h, mas prazo de 12h", janela(9, 11), 12],
      ["já fechou hoje", janela(-4, -2), 5],
      ["horário malformado", { dias: [], inicio: "", fim: "" }, 5],
    ];
    for (const [nome, h, prazo] of casos) {
      const sql = ((await svc.rpc("janela_alcance", {
        p_horarios: h, p_prazo_horas: prazo,
      })).data as Alcance | null)?.alcancavel;
      const ts = janelaAlcancavel(h as JanelaConsumo, prazo, relogioDb);
      check(`paridade SQL↔TS — ${nome}`, sql === ts, `sql=${sql} ts=${ts}`);
    }


    // ============================================================
  } finally {
    await svc.from("cupons").delete().eq("id", CUPOM_F9);
    await svc.from("cupons").delete().eq("id", CUPOM_ANTECIPADO);
    await svc.from("cupons").delete().eq("id", CUPOM_LONGE);
    await svc.from("cupons").delete().eq("id", CUPOM_RECUSA);
    // Faltavam aqui (achado no smoke hospedado do AD-2): dois cupons do
    // bloco [Z1c] vazaram para o hospedado porque as constantes existiam
    // mas nunca entraram nesta lista. Limpos manualmente uma vez; a lista
    // agora cobre os seis cupons que a suíte cria.
    await svc.from("cupons").delete().eq("id", CUPOM_FILA_A);
    await svc.from("cupons").delete().eq("id", CUPOM_FILA_B);
    if (qa) await destruirContaQa(svc, qa.id);
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c));
