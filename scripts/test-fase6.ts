/**
 * Testes da Fase 6.
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
import { dentroDaJanela, type JanelaConsumo } from "../src/lib/janela";
import { DIAS_SEMANA, diaSemanaBrt, type DiaSemana } from "../src/lib/dias";
import {
  faixaHorario,
  linhasDaJanela,
  resumoJanela,
  temRestricao,
} from "../src/lib/janela-formato";

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
  check(
    "resumo usa a descrição do lojista quando existe",
    resumoJanela("Sob agendamento") === "Sob agendamento",
  );
  check(
    "resumo sem descrição é honesto",
    resumoJanela("") === "Sem restrição de horário" &&
      resumoJanela(null) === "Sem restrição de horário",
  );
}

console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
