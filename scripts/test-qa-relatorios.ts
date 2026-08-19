/**
 * Suíte dos relatórios de QA do cliente (v1 e v2).
 *
 * Esta suíte responde a UMA pergunta: **o que o cliente pediu está no
 * código?** Ela não testa regra de negócio nova — isso é papel das suítes de
 * fase. Ela testa que os itens dos dois relatórios ou (a) já estavam
 * implementados e continuam, ou (b) foram corrigidos e não regridem.
 *
 * Duas naturezas de asserção, e a distinção importa:
 *
 * - **Módulo puro** (`normalizarCodigoCupom`, `rotuloEconomia`): o teste
 *   chama a função. É o teste de verdade.
 * - **Estática** (ler o arquivo e casar padrão): o teste olha o código-fonte.
 *   É mais fraco, mas é o único jeito de guardar um defeito que vive na
 *   ÁRVORE JSX e não numa função — "o botão tem destino", "o rótulo não
 *   depende do índice". O precedente da casa é `test-fase7` (botão sem
 *   `type` dentro de `<form>`).
 *
 * As asserções estáticas removem comentários antes de casar. Sem isso, o
 * comentário que EXPLICA por que o padrão antigo saiu seria acusado de ser o
 * padrão antigo — foi o que aconteceu na primeira versão de `test-fase9`.
 *
 * SEM BANCO de propósito: tudo aqui é módulo puro ou leitura de arquivo, e
 * roda sem Docker. As asserções que precisam de banco (janela antecipada,
 * clique no servidor) entram quando as Ondas B/C forem implementadas — ver
 * docs/superpowers/plans/2026-08-17-relatorios-qa-v1-v2.md.
 */
import { readFileSync } from "node:fs";

import { normalizarCodigoCupom } from "../src/lib/codigo-cupom";
import { rotuloEconomia } from "../src/lib/cupom-campos";
import { encerrar } from "./_qa-conta";

console.log("\n[test-qa-relatorios] alvo: módulos puros + código-fonte (sem banco)\n");

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

/** Fonte sem comentários — ver o cabeçalho sobre por que isso é necessário. */
function fonteSemComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

// ---------------------------------------------------------------
// v1 §3.2 — código de validação sem hífens
//
// O relatório fala em "12 dígitos"; são 8 caracteres significativos num
// alfabeto de 32 sem 0/O/1/I, mais o prefixo PRMF. O que ele pede de fato —
// não obrigar o lojista a digitar hífen — já valia antes dos dois relatórios.
// ---------------------------------------------------------------
console.log("v1 §3.2 — validação aceita o código sem formatação manual");

check(
  "código canônico atravessa inalterado",
  normalizarCodigoCupom("PRMF-UD2R-N7ER") === "PRMF-UD2R-N7ER",
  normalizarCodigoCupom("PRMF-UD2R-N7ER"),
);
check(
  "sem hífen e sem prefixo é reconstituído",
  normalizarCodigoCupom("UD2RN7ER") === "PRMF-UD2R-N7ER",
  normalizarCodigoCupom("UD2RN7ER"),
);
check(
  "minúsculo com espaços é reconstituído",
  normalizarCodigoCupom("prmf ud2r n7er") === "PRMF-UD2R-N7ER",
  normalizarCodigoCupom("prmf ud2r n7er"),
);
check(
  "entrada de tamanho errado NÃO inventa formato",
  normalizarCodigoCupom("UD2RN7") === "UD2RN7",
  normalizarCodigoCupom("UD2RN7"),
);

// ---------------------------------------------------------------
// v1 §3.4 — economia variável exibe "a partir de"
// ---------------------------------------------------------------
console.log("\nv1 §3.4 — economia variável");

check(
  "cupom de economia fixa mostra o valor puro",
  rotuloEconomia("R$ 12,00", false) === "R$ 12,00",
  rotuloEconomia("R$ 12,00", false),
);
check(
  "cupom de economia variável ganha o prefixo 'a partir de'",
  /a partir de/i.test(rotuloEconomia("R$ 12,00", true)),
  rotuloEconomia("R$ 12,00", true),
);

// ---------------------------------------------------------------
// v1 §2.1 / v2 §3.2 — o rótulo do card não depende da posição no grid
//
// O defeito: `ctaLabel={i % 3 === 2 ? "Regras de uso" : "Usar agora"}`. O
// cliente reportou isso nos DOIS relatórios como "inconsistência entre
// cupons", e a causa era a posição do card, não o estado do cupom.
// ---------------------------------------------------------------
console.log("\nv1 §2.1 / v2 §3.2 — rótulo do card é estável");

const homeM = fonteSemComentarios("src/app/m/page.tsx");

check(
  "a home não decide rótulo por índice do grid",
  !/ctaLabel=\{[^}]*%[^}]*\}/.test(homeM),
  homeM.match(/ctaLabel=\{[^}]*\}/)?.[0] ?? "",
);
check(
  "…e não sobrou 'Regras de uso' como rótulo alternativo",
  !/Regras de uso/.test(homeM),
);

// ---------------------------------------------------------------
// v2 §1.4 — botão "Novo cupom" do dashboard tem destino
//
// Era `<Button><Plus/> Novo cupom</Button>`: sem href, sem onClick, inerte.
// ---------------------------------------------------------------
console.log("\nv2 §1.4 — botão 'Novo cupom' do dashboard leva a algum lugar");

const dashPortal = fonteSemComentarios("src/app/portal/(painel)/page.tsx");
const trechoNovoCupom = dashPortal.slice(
  Math.max(0, dashPortal.indexOf("Novo cupom") - 400),
  dashPortal.indexOf("Novo cupom") + 100,
);

check(
  "o botão 'Novo cupom' aponta para a criação de cupom",
  /\/portal\/cupons\?novo=1/.test(trechoNovoCupom),
  trechoNovoCupom.replace(/\s+/g, " ").trim(),
);

const cuponsPage = fonteSemComentarios("src/app/portal/(painel)/cupons/page.tsx");
const cuponsClient = fonteSemComentarios(
  "src/app/portal/(painel)/cupons/cupons-client.tsx",
);

check(
  "a página de cupons lê o parâmetro que abre o formulário",
  /searchParams/.test(cuponsPage) && /novo/.test(cuponsPage),
);
check(
  "…e o client honra esse parâmetro na view inicial",
  /abrirEmNovo/.test(cuponsClient),
);

// ---------------------------------------------------------------
// v2 §2.3 — cupons usados em lista vertical no admin
// ---------------------------------------------------------------
console.log("\nv2 §2.3 — admin exibe cupons usados em lista vertical");

const usuariosAdmin = fonteSemComentarios(
  "src/app/admin/(painel)/usuarios/usuarios-client.tsx",
);

check(
  "cupons usados não são mais texto corrido com join",
  !/cuponsUsados\.join/.test(usuariosAdmin),
);
check(
  "estabelecimentos frequentados também não",
  !/estabelecimentos\.join/.test(usuariosAdmin),
);
check(
  "existe uma lista de verdade (<ul>/<li>) para esses campos",
  /<ul/.test(usuariosAdmin) && /<li/.test(usuariosAdmin),
);

// ---------------------------------------------------------------
// v1 §3.3 — o template do cupom exibe o benefício durante a criação
// ---------------------------------------------------------------
console.log("\nv1 §3.3 — benefício aparece no template do cupom");

const card = fonteSemComentarios("src/components/coupon-card.tsx");

check(
  "o card renderiza cupom.beneficio",
  /cupom\.beneficio/.test(card),
);

const formNovoCupom = fonteSemComentarios(
  "src/components/portal/novo-cupom-form.tsx",
);
check(
  "…e o formulário alimenta o preview com o benefício digitado",
  /beneficio/.test(formNovoCupom) && /CouponCard/.test(formNovoCupom),
);

// ---------------------------------------------------------------
// v1 §1 — "visualizar senha" nas quatro frentes de login
//
// Já valia antes dos relatórios; a asserção existe para não regredir numa
// tela só (foi assim que o item nasceu: parcial em algumas telas).
// ---------------------------------------------------------------
console.log("\nv1 §1 — toggle de visualizar senha nas 4 telas de login");

const passwordInput = fonteSemComentarios("src/components/password-input.tsx");
check(
  "o campo de senha tem toggle de visibilidade",
  /type=\{\s*(vis|mostrar|show)/i.test(passwordInput) ||
    (/useState/.test(passwordInput) && /password/.test(passwordInput) && /text/.test(passwordInput)),
);

for (const [tela, caminho] of [
  ["/m/login", "src/app/m/login/page.tsx"],
  ["/e/login", "src/app/e/login/page.tsx"],
  ["/portal e /admin (login-painel)", "src/components/login-painel.tsx"],
] as const) {
  const fonte = fonteSemComentarios(caminho);
  check(
    `${tela} usa o campo que traz o toggle`,
    /type="password"/.test(fonte),
  );
}

// ---------------------------------------------------------------
// D3.1 — paridade do motivo `esgotado` na validação do Portal
//
// `validar_cupom` (migration 33) devolve motivo 'esgotado' quando o limite
// total já foi consumido. O /e traduz isso em ResultadoValidacao. O dialog
// do Portal caía no fallback genérico (`MENSAGEM.erro`) porque a chave
// não existia no mapa — o lojista via "Não foi possível validar agora"
// para um recusa de negócio explícita.
// ---------------------------------------------------------------
console.log("\nD3.1 — Portal traduz motivo esgotado (paridade com /e)");

const dialogPortal = fonteSemComentarios(
  "src/components/portal/validar-cupom-dialog.tsx",
);
const resultadoE = fonteSemComentarios(
  "src/components/estab/resultado-validacao.tsx",
);

function stringDoMapa(fonte: string, chave: string): string | null {
  const m = fonte.match(new RegExp(`${chave}:\\s*"([^"]+)"`));
  return m?.[1] ?? null;
}
function descricaoDoErro(fonte: string, chave: string): string | null {
  const m = fonte.match(
    new RegExp(`${chave}:\\s*\\{[\\s\\S]*?descricao:\\s*"([^"]+)"`),
  );
  return m?.[1] ?? null;
}

const msgEsgotadoPortal = stringDoMapa(dialogPortal, "esgotado");
const msgErroPortal = stringDoMapa(dialogPortal, "erro");
const descEsgotadoE = descricaoDoErro(resultadoE, "esgotado");

check(
  "o mapa do Portal tem a chave esgotado",
  typeof msgEsgotadoPortal === "string" && msgEsgotadoPortal.length > 0,
  msgEsgotadoPortal ?? "(ausente)",
);
check(
  "a mensagem de esgotado NÃO é o fallback genérico",
  !!msgEsgotadoPortal &&
    !!msgErroPortal &&
    msgEsgotadoPortal !== msgErroPortal,
  `esgotado=${msgEsgotadoPortal ?? "(ausente)"} erro=${msgErroPortal ?? "(ausente)"}`,
);
check(
  "o /e continua com tratamento específico de esgotado",
  !!descEsgotadoE,
  descEsgotadoE ?? "(ausente)",
);
check(
  "Portal e /e usam a mesma frase de esgotado",
  !!msgEsgotadoPortal &&
    !!descEsgotadoE &&
    msgEsgotadoPortal === descEsgotadoE,
  `portal=${msgEsgotadoPortal ?? "(ausente)"} /e=${descEsgotadoE ?? "(ausente)"}`,
);

// ---------------------------------------------------------------
console.log("");
process.exit(encerrar(passed, failed));
