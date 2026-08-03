/**
 * Testes da Fase 6.
 *
 * ONDA 2 (cupom) — contra o banco, com fixtures `f6-*` e conta `qa-f6`
 * criada e destruída aqui (o seed NÃO é tocado):
 *  - C1 campos: taxas/formas persistem e voltam SANEADAS contra o
 *    vocabulário; valor fora da whitelist não é gravado;
 *  - C1 ilimitado: `limite_por_usuario NULL` deixa reativar depois de
 *    validar, e `usos` devolve limite/restantes null + pode_reusar true —
 *    os três casos que uma implementação "óbvia" erra (GREATEST devolve
 *    0, não null; `null > 0` é false; a UI não teria caminho para a 2ª
 *    ativação). Inclui PARIDADE: `pode_reusar` concorda com o que
 *    `ativar_cupom` realmente faz, cupom a cupom;
 *  - C1 prazo: < 5h é recusado pelo CHECK mesmo no PostgREST direto;
 *  - C1 moderação: lojista não auto-publica (INSERT com status 'ativo'
 *    nasce 'pendente');
 *  - C3 economia: fixo soma exato; variável soma o MÍNIMO e marca
 *    `inclui_variavel`; misto soma os dois e marca;
 *  - C3 NÃO-REGRESSÃO (o critério que o usuário pediu explicitamente):
 *    para cupons FIXOS, `economia_consumidor().total` é IDÊNTICO ao
 *    `economia_total_consumidor()` que já está no ar. O número que o
 *    cliente vê hoje não muda.
 *
 * ONDA 1 (higiene) — asserções PURAS, sem banco:
 *  - PARIDADE tabela↔barreira: a tabela "Regras de Uso" do detalhe descreve o
 *    MESMO objeto `janela` que `dentroDaJanela`/`dentro_da_janela` usam para
 *    decidir. O backlog 12.1 nasceu de as duas coisas serem fontes diferentes
 *    (uma constante literal ao lado de um botão que obedecia ao banco), então
 *    o que esta suíte prova é justamente que não podem divergir:
 *      · se o servidor deixa consumir AGORA, a linha de hoje nunca aparece
 *        bloqueada;
 *      · se a linha de um dia aparece bloqueada, NENHUMA hora daquele dia é
 *        consumível;
 *      · sem restrição na tabela ⇒ consumível em qualquer instante;
 *      · a faixa só é anunciada quando ela de fato restringe.
 *  - tolerância a `horarios` malformado: o mesmo saneamento do SQL e do
 *    espelho TS — dado inválido é "sem restrição", nunca "fora da janela".
 *    Anunciar um horário que a barreira ignora seria recriar a contradição.
 *
 * ONDA 2 (cupom) entra aqui depois, com fixtures `f6-*` e conta `qa-f6`.
 */
import { config } from "dotenv";
const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dentroDaJanela, type JanelaConsumo } from "../src/lib/janela";
import { DIAS_SEMANA, diaSemanaBrt, type DiaSemana } from "../src/lib/dias";
import {
  faixaHorario,
  linhasDaJanela,
  temRestricao,
} from "../src/lib/janela-formato";
import { sanearTaxas, sanearFormasConsumo } from "../src/lib/cupom-campos";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  console.error(`Faltam variáveis em ${envFile}.`);
  process.exit(1);
}

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

/**
 * Instante em que o relógio de America/Sao_Paulo marca `dia`/`hora`:`min`.
 * BRT é UTC-3 fixo (sem horário de verão desde 2019), então somar 3h ao UTC
 * basta. A semana-base começa numa SEGUNDA (2026-08-03) — conferido pelo
 * próprio `diaSemanaBrt` na primeira asserção, para não confiar no calendário
 * de cabeça.
 */
function instanteBrt(indiceDia: number, hora: number, min = 0): Date {
  return new Date(Date.UTC(2026, 7, 3 + indiceDia, hora + 3, min));
}

/** Grade de horas usada para varrer o dia inteiro. */
const HORAS = [0, 1, 6, 8, 10, 11, 12, 15, 17, 18, 20, 22, 23];

const CASOS: Array<{ nome: string; janela: JanelaConsumo | undefined }> = [
  { nome: "sem janela (cupom legado, só descrição)", janela: undefined },
  { nome: "objeto vazio", janela: {} },
  {
    nome: "c01 do seed (Ter–Dom, 18:00–23:00)",
    janela: { dias: ["Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"], inicio: "18:00", fim: "23:00" },
  },
  {
    nome: "c02 do seed (Seg–Sex, 11:00–15:00)",
    janela: { dias: ["Seg", "Ter", "Qua", "Qui", "Sex"], inicio: "11:00", fim: "15:00" },
  },
  { nome: "só dias (sem horário)", janela: { dias: ["Sáb", "Dom"] } },
  { nome: "só horário (sem dias)", janela: { inicio: "08:00", fim: "12:00" } },
  { nome: "dias vazio = sem restrição de dia", janela: { dias: [], inicio: "09:00", fim: "17:00" } },
  { nome: "cruza a meia-noite (22:00–02:00)", janela: { dias: ["Sex", "Sáb"], inicio: "22:00", fim: "02:00" } },
  { nome: "hora vazia (o que o form gravava)", janela: { dias: ["Seg"], inicio: "", fim: "" } },
  { nome: "hora lixo", janela: { dias: ["Ter"], inicio: "abc", fim: "99:99" } },
  { nome: "só início, sem fim", janela: { dias: ["Qua"], inicio: "10:00" } },
  { nome: "'Sab' sem acento", janela: { dias: ["Sab"], inicio: "09:00", fim: "18:00" } },
  { nome: "hora de 1 dígito (8:00)", janela: { dias: ["Qui"], inicio: "8:00", fim: "12:00" } },
  { nome: "todos os dias, 00:00–23:59 (alargado no hospedado)", janela: { dias: [...DIAS_SEMANA], inicio: "00:00", fim: "23:59" } },
];

console.log("\n[test-fase6] Onda 1 — asserções puras (sem banco)\n");

console.log("[base do calendário]");
{
  const nomes = DIAS_SEMANA.map((_, i) => diaSemanaBrt(instanteBrt(i, 12)));
  check(
    "a semana-base começa na Segunda e cobre os 7 dias em ordem",
    nomes.join(",") === DIAS_SEMANA.join(","),
    nomes.join(","),
  );
}

console.log("\n[paridade tabela ↔ barreira]");
for (const caso of CASOS) {
  const { nome, janela } = caso;

  // 1) servidor deixa consumir AGORA ⇒ a linha de hoje não está bloqueada
  let violacoesPermissivas = "";
  // 2) linha bloqueada ⇒ nenhuma hora daquele dia é consumível
  let violacoesRestritivas = "";

  for (let d = 0; d < DIAS_SEMANA.length; d++) {
    const dia = DIAS_SEMANA[d] as DiaSemana;
    const linha = linhasDaJanela(janela, dia).find((l) => l.dia === dia)!;
    for (const h of HORAS) {
      const t = instanteBrt(d, h);
      const podeAgora = dentroDaJanela(janela, t);
      if (podeAgora && !linha.permitido) {
        violacoesPermissivas += ` ${dia}@${h}h`;
      }
      if (!linha.permitido && podeAgora) {
        violacoesRestritivas += ` ${dia}@${h}h`;
      }
    }
    check(
      `${nome} — a linha de ${dia} marca "hoje" quando é o dia`,
      linha.hoje === true,
      JSON.stringify(linha),
    );
  }

  check(
    `${nome} — consumível agora ⇒ linha de hoje NÃO bloqueada`,
    violacoesPermissivas === "",
    violacoesPermissivas,
  );
  check(
    `${nome} — linha bloqueada ⇒ nenhuma hora do dia é consumível`,
    violacoesRestritivas === "",
    violacoesRestritivas,
  );
}

console.log("\n[sem restrição = sempre consumível]");
for (const { nome, janela } of CASOS) {
  if (temRestricao(janela)) continue;
  let fora = "";
  for (let d = 0; d < DIAS_SEMANA.length; d++) {
    for (const h of HORAS) {
      if (!dentroDaJanela(janela, instanteBrt(d, h))) fora += ` ${DIAS_SEMANA[d]}@${h}h`;
    }
  }
  check(`${nome} — temRestricao=false ⇒ consumível em qualquer instante`, fora === "", fora);
}

console.log("\n[a faixa só é anunciada quando restringe de verdade]");
{
  // Se faixaHorario devolve texto, ou existe hora em que o cupom NÃO é
  // consumível por causa da HORA, ou a faixa cobre o dia inteiro.
  //
  // O segundo ramo NÃO é frouxidão: é o caso real do hospedado. A Fase 5
  // alargou c02/c03/c05 para "todos os dias, 00:00–23:59" e reescreveu a
  // `descricao` junto (FASE-5 §10). Como `dentro_da_janela` trunca `now()` ao
  // minuto, essa faixa nunca barra — e ainda assim tem de aparecer na tabela:
  // esconder o que o lojista configurou seria fazer a tela discordar da
  // descrição do próprio cupom. O que a asserção proíbe é anunciar uma faixa
  // ARBITRÁRIA que a barreira ignora (hora vazia, lixo, só início) — esses
  // casos não chegam aqui porque faixaHorario já devolve null para eles.
  const DIA_INTEIRO = "00:00 às 23:59";
  for (const { nome, janela } of CASOS) {
    const faixa = faixaHorario(janela);
    if (faixa === null) continue;
    // varre um dia permitido inteiro, minuto a minuto seria caro; a grade basta
    const diaPermitido = linhasDaJanela(janela, "Seg").find((l) => l.permitido);
    if (!diaPermitido) continue;
    const d = DIAS_SEMANA.indexOf(diaPermitido.dia);
    const houveNao = HORAS.some((h) => !dentroDaJanela(janela, instanteBrt(d, h)));
    check(
      `${nome} — faixa "${faixa}" restringe de verdade ou cobre o dia inteiro`,
      houveNao || faixa === DIA_INTEIRO,
      "faixa anunciada mas nunca barra",
    );
  }

  // O caso do hospedado, explícito: a janela alargada continua VISÍVEL e
  // continua sem barrar em nenhum instante.
  {
    const alargada: JanelaConsumo = { dias: [...DIAS_SEMANA], inicio: "00:00", fim: "23:59" };
    const sempreDentro = DIAS_SEMANA.every((_, d) =>
      HORAS.every((h) => dentroDaJanela(alargada, instanteBrt(d, h))),
    );
    check("janela alargada do hospedado nunca barra", sempreDentro);
    check("…e mesmo assim é exibida (não vira 'sem restrição')", temRestricao(alargada) === true);
    check(
      "…com a faixa que o lojista configurou",
      linhasDaJanela(alargada, "Seg").every((l) => l.permitido && l.faixa === DIA_INTEIRO),
    );
  }

  check(
    "hora vazia não vira faixa (o que o form gravava)",
    faixaHorario({ dias: ["Seg"], inicio: "", fim: "" }) === null,
  );
  check("hora lixo não vira faixa", faixaHorario({ inicio: "abc", fim: "99:99" }) === null);
  check("só início não vira faixa", faixaHorario({ inicio: "10:00" }) === null);
  check("hora impossível (25:00) não vira faixa", faixaHorario({ inicio: "25:00", fim: "26:00" }) === null);
  check(
    "faixa válida é formatada com 'às'",
    faixaHorario({ inicio: "18:00", fim: "23:00" }) === "18:00 às 23:00",
  );
  check(
    "hora de 1 dígito é preservada como o lojista gravou",
    faixaHorario({ inicio: "8:00", fim: "12:00" }) === "8:00 às 12:00",
  );
}

console.log("\n[linhas e resumo]");
{
  const linhas = linhasDaJanela({ dias: ["Sáb", "Dom"], inicio: "09:00", fim: "18:00" }, "Seg");
  check("sempre 7 linhas, na ordem canônica", linhas.length === 7 && linhas[0].dia === "Seg");
  check(
    "dia fora da lista mostra '—' e não a faixa",
    linhas.find((l) => l.dia === "Qua")!.faixa === "—",
  );
  check(
    "dia da lista mostra a faixa",
    linhas.find((l) => l.dia === "Sáb")!.faixa === "09:00 às 18:00",
  );
  check(
    "'Sab' sem acento libera o Sábado (mesma tolerância do SQL)",
    linhasDaJanela({ dias: ["Sab"] }, "Seg").find((l) => l.dia === "Sáb")!.permitido === true,
  );
  check(
    "dias sem horário válido mostram 'Qualquer horário'",
    linhasDaJanela({ dias: ["Seg"], inicio: "", fim: "" }, "Seg").find((l) => l.dia === "Seg")!
      .faixa === "Qualquer horário",
  );
  check(
    "temRestricao é falso para cupom legado (só descrição)",
    temRestricao(undefined) === false && temRestricao({}) === false,
  );
}

// ================================================================
// ONDA 2 — contra o banco
// ================================================================

const svc = createClient(url!, serviceRole!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = () =>
  createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
async function logar(email: string, senha: string): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

type Jsonb = Record<string, unknown> | null;
const motivo = (r: Jsonb) => (r as { motivo?: string })?.motivo;
const okr = (r: Jsonb) => (r as { ok?: boolean })?.ok === true;
const codigoDe = (r: Jsonb) =>
  (r as { estado?: { codigo?: string } })?.estado?.codigo ?? "";

// fixtures desta fase (prefixo próprio; o seed não é tocado)
const FIXO = "f6-fixo";
const VARIAVEL = "f6-variavel";
const ILIMITADO = "f6-ilimitado";
const LIMITADO = "f6-limitado";
const TODOS_F6 = [FIXO, VARIAVEL, ILIMITADO, LIMITADO];

interface UsoLinha {
  cupom_id: string;
  consumidos: number;
  limite: number | null;
  restantes: number | null;
  pode_reusar: boolean;
}
const usosDe = (r: Jsonb): UsoLinha[] =>
  ((r as { usos?: UsoLinha[] })?.usos ?? []);
const usoDe = (r: Jsonb, id: string) => usosDe(r).find((u) => u.cupom_id === id);

let qa: ContaQa | null = null;

async function main(): Promise<number> {
  console.log(
    `\n[test-fase6] Onda 2 — banco: ${hosted ? "HOSPEDADO (muta dados!)" : "local"} (${new URL(url!).host})\n`,
  );

  qa = await criarContaQa(svc, "f6", { nome: "QA Fase6" });
  console.log(`[conta efêmera] ${qa.email}`);
  const consumidor = await logar(qa.email, qa.senha);
  const uid = qa.id;
  const lojista = await logar("lojista@promofy.test", "promofy123"); // dono de e1

  // categoria válida do e1 (o trigger da Fase 4 exige pertencer ao conjunto)
  const { data: e1 } = await svc
    .from("estabelecimentos")
    .select("categoria_id")
    .eq("id", "e1")
    .single();
  const cat = e1!.categoria_id as string;
  const base = {
    estabelecimento_id: "e1",
    categoria_id: cat,
    validade_fim: "2030-12-31",
    status: "ativo" as const,
    horarios: { descricao: "Todos os dias" }, // sem janela: ativável a qualquer hora
  };

  try {
    await svc.from("cupons").delete().in("id", TODOS_F6);
    // TODAS as linhas com AS MESMAS CHAVES: num insert em lote o PostgREST
    // monta a lista de colunas a partir do primeiro objeto e recusa o
    // conjunto se os demais divergirem (PGRST102). E o erro é capturado —
    // um insert que falha em silêncio faz as asserções seguintes passarem
    // vazias (um UPDATE que casa 0 linhas não devolve erro).
    const { error: errFix } = await svc.from("cupons").insert([
      { ...base, id: FIXO, titulo: "F6 fixo", economia: 10, economia_variavel: false, limite_por_usuario: 1 },
      { ...base, id: VARIAVEL, titulo: "F6 variável", economia: 7, economia_variavel: true, limite_por_usuario: 1 },
      { ...base, id: ILIMITADO, titulo: "F6 ilimitado", economia: 3, economia_variavel: false, limite_por_usuario: null },
      { ...base, id: LIMITADO, titulo: "F6 limitado", economia: 5, economia_variavel: false, limite_por_usuario: 1 },
    ]);
    if (errFix) throw new Error(`fixtures f6-*: ${errFix.message}`);

    // ---------------------------------------------------------------
    console.log("[C1 — taxas e formas de consumo]");
    {
      const { data: gravado, error } = await svc
        .from("cupons")
        .update({
          taxas: ["entrega", "servico"],
          formas_consumo: ["local", "delivery"],
        })
        .eq("id", FIXO)
        .select("id");
      // `.select()` encadeado de propósito: sem ele, um update que casa 0
      // linhas devolve `error: null` e a asserção passaria vazia.
      check(
        "grava taxas e formas de consumo",
        !error && gravado?.length === 1,
        error?.message ?? `linhas=${gravado?.length}`,
      );

      const { data } = await consumidor
        .from("cupons")
        .select("taxas, formas_consumo")
        .eq("id", FIXO)
        .single();
      check(
        "consumidor lê os dois campos de volta",
        JSON.stringify(data?.taxas) === '["entrega","servico"]' &&
          JSON.stringify(data?.formas_consumo) === '["local","delivery"]',
        JSON.stringify(data),
      );
    }
    {
      // O jsonb não tem CHECK de domínio de propósito (migration 16): quem
      // garante o vocabulário é o servidor. Aqui provamos o OUTRO lado da
      // decisão — lixo gravado direto NÃO chega à tela.
      await svc
        .from("cupons")
        .update({ taxas: ["entrega", "xpto", 42, null], formas_consumo: "nao-array" })
        .eq("id", FIXO);
      const { data } = await consumidor
        .from("cupons")
        .select("taxas, formas_consumo")
        .eq("id", FIXO)
        .single();
      check(
        "valor fora do vocabulário é ignorado na leitura (só sobra 'entrega')",
        JSON.stringify(sanearTaxas(data?.taxas)) === '["entrega"]',
        JSON.stringify(sanearTaxas(data?.taxas)),
      );
      check(
        "formas_consumo fora do formato (string) vira lista vazia, não exceção",
        JSON.stringify(sanearFormasConsumo(data?.formas_consumo)) === "[]",
      );
      await svc.from("cupons").update({ taxas: ["entrega", "servico"] }).eq("id", FIXO);
    }

    // ---------------------------------------------------------------
    console.log("\n[C1 — prazo mínimo de ativação: o CHECK cobre o PostgREST direto]");
    {
      const { error } = await lojista
        .from("cupons")
        .update({ prazo_ativacao_horas: 4 })
        .eq("id", FIXO);
      check(
        "lojista NÃO grava prazo de 4h direto (CHECK recusa)",
        !!error,
        error ? "" : "passou!",
      );
      const { error: ok5 } = await lojista
        .from("cupons")
        .update({ prazo_ativacao_horas: 6 })
        .eq("id", FIXO);
      check("…mas 6h é aceito", !ok5, ok5?.message);
    }

    // ---------------------------------------------------------------
    console.log("\n[C1 — moderação: lojista não auto-publica no INSERT]");
    {
      const AUTO = "f6-autopublish";
      await svc.from("cupons").delete().eq("id", AUTO);
      const { data, error } = await lojista
        .from("cupons")
        .insert({
          id: AUTO,
          estabelecimento_id: "e1",
          categoria_id: cat,
          titulo: "F6 tentativa de auto-publish",
          economia: 1,
          validade_fim: "2030-12-31",
          status: "ativo", // <- o ataque
        })
        .select("status")
        .single();
      check(
        "INSERT com status 'ativo' nasce 'pendente' (trigger)",
        !error && data?.status === "pendente",
        error?.message ?? String(data?.status),
      );
      await svc.from("cupons").delete().eq("id", AUTO);
    }

    // ---------------------------------------------------------------
    console.log("\n[C1 — limite ilimitado por usuário]");
    {
      const a1 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: ILIMITADO })).data as Jsonb;
      check("ativa cupom ilimitado", okr(a1), JSON.stringify(a1));
      await lojista.rpc("validar_cupom", { p_codigo: codigoDe(a1) });

      const estado = (await consumidor.rpc("meu_estado_consumidor")).data as Jsonb;
      const uso = usoDe(estado, ILIMITADO);
      check("usos.limite vem null (ilimitado)", uso?.limite === null, JSON.stringify(uso));
      check(
        "usos.restantes vem null — NÃO 0 (greatest() puro devolveria 0)",
        uso?.restantes === null,
        JSON.stringify(uso),
      );
      check("usos.pode_reusar = true depois de validar", uso?.pode_reusar === true);

      const a2 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: ILIMITADO })).data as Jsonb;
      check(
        "2ª ativação é ACEITA logo após a validação (ok, não idempotente)",
        okr(a2) && (a2 as { ja_ativo?: boolean }).ja_ativo === false,
        JSON.stringify(a2),
      );
    }
    {
      // controle de não-regressão: com limite 1, tudo como na Fase 5
      const a = (await consumidor.rpc("ativar_cupom", { p_cupom_id: LIMITADO })).data as Jsonb;
      await lojista.rpc("validar_cupom", { p_codigo: codigoDe(a) });
      const estado = (await consumidor.rpc("meu_estado_consumidor")).data as Jsonb;
      const uso = usoDe(estado, LIMITADO);
      check("limite 1 validado → restantes 0 e pode_reusar false",
        uso?.restantes === 0 && uso?.pode_reusar === false, JSON.stringify(uso));
      const a2 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: LIMITADO })).data as Jsonb;
      check("…e a 2ª ativação é recusada com limite_usuario",
        motivo(a2) === "limite_usuario", JSON.stringify(a2));
    }
    {
      // PARIDADE — o mesmo tipo de prova que a Fase 5 fez para
      // `consumidos`: se o contrato divergir da RPC, a UI mente sobre a
      // regra do servidor.
      //
      // O que se compara é a COTA POR USUÁRIO, e só ela — que é o escopo
      // exato de `pode_reusar` (por isso o campo não se chama
      // `pode_ativar`). Comparar contra o `ok` genérico da RPC daria um
      // verde falso: com uma ativação VIGENTE, `ativar_cupom` devolve
      // `ok:true, ja_ativo:true` pelo ramo idempotente — que vem ANTES
      // da checagem de limite — enquanto `pode_reusar` pode ser false
      // porque a linha ativa já consome a vaga. Não é divergência: são
      // perguntas diferentes. (E a UI acerta esse caso por outro
      // caminho: com linha ativa o status é "ativo" e a tela mostra
      // "Ver cupom ativo", sem consultar `pode_reusar`.)
      const estado = (await consumidor.rpc("meu_estado_consumidor")).data as Jsonb;
      let divergencias = "";
      for (const uso of usosDe(estado)) {
        const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: uso.cupom_id }))
          .data as Jsonb;
        const barradoPorCota = motivo(r) === "limite_usuario";
        // pode_reusar=false ⇔ a RPC barra por cota (nunca um sem o outro)
        if (barradoPorCota === uso.pode_reusar) {
          divergencias += ` ${uso.cupom_id}(pode_reusar=${uso.pode_reusar},motivo=${motivo(r)})`;
        }
      }
      check(
        "PARIDADE pode_reusar ⇔ ativar_cupom barra por cota, cupom a cupom",
        divergencias === "",
        divergencias,
      );
    }
    {
      // O caso que a versão ingênua da paridade deixaria passar: cupom
      // com cota esgotada por uma ativação VIGENTE (não validada).
      const NOVO = "f6-vigente";
      await svc.from("cupons").delete().eq("id", NOVO);
      await svc.from("cupons").insert({
        ...base, id: NOVO, titulo: "F6 vigente", economia: 1,
        economia_variavel: false, limite_por_usuario: 1,
      });
      const a = (await consumidor.rpc("ativar_cupom", { p_cupom_id: NOVO })).data as Jsonb;
      check("ativa o cupom de cota 1 (linha vigente, não validada)", okr(a));
      const estado = (await consumidor.rpc("meu_estado_consumidor")).data as Jsonb;
      const uso = usoDe(estado, NOVO);
      check(
        "ativação vigente consome a vaga: pode_reusar false, restantes 0",
        uso?.pode_reusar === false && uso?.restantes === 0,
        JSON.stringify(uso),
      );
      const r2 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: NOVO })).data as Jsonb;
      check(
        "…e a RPC responde pelo ramo IDEMPOTENTE (ok + ja_ativo), não por cota",
        okr(r2) && (r2 as { ja_ativo?: boolean }).ja_ativo === true,
        JSON.stringify(r2),
      );
      await svc.from("cupons_usuario").delete().eq("cupom_id", NOVO);
      await svc.from("cupons").delete().eq("id", NOVO);
    }

    // ---------------------------------------------------------------
    console.log("\n[C3 — economia variável]");
    // estado limpo: só o que este bloco validar entra na conta
    await svc.from("cupons_usuario").delete().eq("usuario_id", uid);
    await svc.from("pontos_transacoes").delete().eq("usuario_id", uid);

    const eco = async () =>
      (await consumidor.rpc("economia_consumidor")).data as unknown as {
        total: number;
        inclui_variavel: boolean;
      };
    const ecoAntiga = async () =>
      Number((await consumidor.rpc("economia_total_consumidor")).data);

    {
      const e = await eco();
      check("sem validação: total 0 e inclui_variavel false",
        Number(e.total) === 0 && e.inclui_variavel === false, JSON.stringify(e));
    }
    {
      const a = (await consumidor.rpc("ativar_cupom", { p_cupom_id: FIXO })).data as Jsonb;
      await lojista.rpc("validar_cupom", { p_codigo: codigoDe(a) });
      const e = await eco();
      check("cupom FIXO soma exato (10) e NÃO marca variável",
        Number(e.total) === 10 && e.inclui_variavel === false, JSON.stringify(e));
      check(
        "NÃO-REGRESSÃO: total == economia_total_consumidor() (o número já no ar)",
        Number(e.total) === (await ecoAntiga()),
        `${e.total} vs ${await ecoAntiga()}`,
      );
    }
    {
      const a = (await consumidor.rpc("ativar_cupom", { p_cupom_id: VARIAVEL })).data as Jsonb;
      await lojista.rpc("validar_cupom", { p_codigo: codigoDe(a) });
      const e = await eco();
      check(
        "com cupom VARIÁVEL: soma o MÍNIMO garantido (10+7=17) e marca 'mais de'",
        Number(e.total) === 17 && e.inclui_variavel === true,
        JSON.stringify(e),
      );
      check(
        "a soma continua idêntica à RPC antiga — a flag é ADITIVA, não muda o valor",
        Number(e.total) === (await ecoAntiga()),
        `${e.total} vs ${await ecoAntiga()}`,
      );
    }
    {
      const anonC = anon();
      const r = await anonC.rpc("economia_consumidor");
      check("anon NÃO chama economia_consumidor (execute revogado)",
        r.error !== null, r.error ? "" : `vazou ${JSON.stringify(r.data)}`);
    }
    {
      // isolamento: a economia de A não vaza para B
      const outro = await criarContaQa(svc, "f6b", { nome: "QA Fase6 B" });
      try {
        const cB = await logar(outro.email, outro.senha);
        const eB = (await cB.rpc("economia_consumidor")).data as unknown as {
          total: number;
        };
        check("economia de outro usuário é 0 (isolada por auth.uid)",
          Number(eB.total) === 0, JSON.stringify(eB));
      } finally {
        await destruirContaQa(svc, outro.id);
      }
    }
  } finally {
    // restauração — só o que este arquivo criou (a conta qa some no fim)
    await svc.from("cupons_usuario").delete().eq("usuario_id", uid);
    await svc.from("cupons").delete().in("id", TODOS_F6);
  }

  return encerrar(passed, failed);
}

/** `process.exit` NÃO executa `finally` — ver scripts/_qa-conta.ts. */
main()
  .then(async (code) => {
    await destruirContaQa(svc, qa?.id);
    process.exit(code);
  })
  .catch(async (err) => {
    console.error("test-fase6 falhou:", err);
    await destruirContaQa(svc, qa?.id);
    process.exit(1);
  });
