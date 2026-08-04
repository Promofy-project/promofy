/**
 * Suíte da Fase 7.
 *
 * ONDA 1 (aqui): scrubbing do Sentry e rótulos da linha do tempo de moderação.
 * Nenhuma das duas toca o banco — são módulos puros, e é assim que devem ser
 * testadas. A Onda 2 acrescenta as asserções de Storage (bucket, as policies e
 * os negativos diretos), que precisam de banco.
 *
 * O scrubbing merece suíte pela mesma razão que a matriz de imutabilidade
 * mereceu trigger: é uma barreira que falha em SILÊNCIO. Um `beforeSend`
 * quebrado não derruba nada — só passa a vazar CPF para um terceiro, e
 * ninguém percebe até alguém abrir o painel do Sentry.
 */
import { config } from "dotenv";

const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { limparTexto, limparEvento } from "../src/lib/sentry-scrub";
import { rotuloAcao, historicoDeJson } from "../src/lib/moderacao";
import { encerrar } from "./_qa-conta";

console.log(`\n[test-fase7] alvo: módulos puros (sem banco)\n`);

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

// ---------------------------------------------------------------
// P5 — scrubbing do Sentry
// ---------------------------------------------------------------
console.log("P5 — scrubbing (nada de PII sai da máquina)");

check(
  "CPF com pontuação vira [cpf]",
  limparTexto("usuario 123.456.789-09 falhou") === "usuario [cpf] falhou",
  limparTexto("usuario 123.456.789-09 falhou"),
);
check(
  "CPF sem pontuação vira [cpf]",
  limparTexto("cpf=12345678909;") === "cpf=[cpf];",
  limparTexto("cpf=12345678909;"),
);
check(
  "e-mail vira [email]",
  limparTexto("login de convidado@promofy.test negado") ===
    "login de [email] negado",
  limparTexto("login de convidado@promofy.test negado"),
);
check(
  "código de cupom COM hífen vira [codigo-cupom]",
  limparTexto("codigo PRMF-FEG2-ZKUJ invalido") ===
    "codigo [codigo-cupom] invalido",
  limparTexto("codigo PRMF-FEG2-ZKUJ invalido"),
);
check(
  "código de cupom SEM hífen também (o /e/validar aceita as duas formas)",
  limparTexto("codigo PRMFFEG2ZKUJ invalido") === "codigo [codigo-cupom] invalido",
  limparTexto("codigo PRMFFEG2ZKUJ invalido"),
);

// A varredura é recursiva porque PII chega por caminho não previsto.
const evento = {
  message: "falha ao validar 123.456.789-09",
  exception: {
    values: [{ value: "duplicate key: convidado@promofy.test", type: "Error" }],
  },
  breadcrumbs: [{ message: "GET /e/validar?codigo=PRMF-FEG2-ZKUJ" }],
  extra: { nivel2: { nivel3: ["cpf 12345678909"] } },
};
const limpo = limparEvento(evento) as typeof evento;
check(
  "varredura alcança message",
  limpo.message === "falha ao validar [cpf]",
  limpo.message,
);
check(
  "varredura alcança exception.values[].value (objeto aninhado)",
  limpo.exception.values[0].value === "duplicate key: [email]",
  limpo.exception.values[0].value,
);
check(
  "varredura alcança breadcrumbs (array de objetos)",
  limpo.breadcrumbs[0].message === "GET /e/validar?codigo=[codigo-cupom]",
  limpo.breadcrumbs[0].message,
);
check(
  "varredura alcança string dentro de array dentro de objeto",
  limpo.extra.nivel2.nivel3[0] === "cpf [cpf]",
  limpo.extra.nivel2.nivel3[0],
);
check(
  "campos não-string sobrevivem intactos",
  limpo.exception.values[0].type === "Error",
  limpo.exception.values[0].type,
);

// Referência cíclica: o evento do Sentry pode conter uma. A limpeza tem de
// terminar — e, se não terminar, tem de descartar em vez de derrubar o processo.
const ciclico: Record<string, unknown> = { message: "cpf 12345678909" };
ciclico.eu = ciclico;
let sobreviveu = true;
try {
  limparEvento(ciclico);
} catch {
  sobreviveu = false;
}
check("referência cíclica não derruba o beforeSend", sobreviveu);

check(
  "texto sem PII passa inalterado",
  limparTexto("Cupom nao encontrado no seu estabelecimento.") ===
    "Cupom nao encontrado no seu estabelecimento.",
);

// ---------------------------------------------------------------
// P4 — linha do tempo de moderação
// ---------------------------------------------------------------
console.log("\nP4 — rótulos e leitura do histórico");

check("rotuloAcao traduz 'rejeitado'", rotuloAcao("rejeitado") === "Rejeitado");
check(
  "rotuloAcao distingue edição material de edição simples",
  rotuloAcao("editado") === "Editado" &&
    rotuloAcao("editado_material") === "Editado (volta para análise)",
);
check(
  "ação desconhecida APARECE em vez de sumir",
  rotuloAcao("acao_de_migration_futura") === "acao_de_migration_futura",
);
check(
  "histórico vazio dos 21 cupons legados não quebra a leitura",
  historicoDeJson([]).length === 0 && historicoDeJson(null).length === 0,
);
check(
  "trilha canônica do ciclo é lida na ordem em que o banco gravou",
  historicoDeJson([
    { em: "2026-08-03T20:05:39Z", acao: "rejeitado", por: "a", motivo: "typo" },
    { em: "2026-08-03T20:07:00Z", acao: "editado_material", por: "b" },
    { em: "2026-08-03T20:07:44Z", acao: "reenviado", por: "b" },
    { em: "2026-08-03T20:09:57Z", acao: "aprovado", por: "a" },
  ])
    .map((e) => e.acao)
    .join(",") === "rejeitado,editado_material,reenviado,aprovado",
);

process.exit(encerrar(passed, failed));
