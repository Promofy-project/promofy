/**
 * TX-P0 — geração segura de `src/lib/supabase/database.types.ts`.
 *
 * O QUE ISTO SUBSTITUI E POR QUÊ
 *
 * O script antigo era um one-liner:
 *
 *   supabase gen types typescript --local > src/lib/supabase/database.types.ts
 *
 * Dois defeitos, e o segundo é o que causou o incidente:
 *
 *   1. `--local` não fixa QUAL stack local — resolve por `workdir` implícito
 *      (o diretório de onde o comando roda). Esta máquina tem múltiplas
 *      stacks Supabase simultâneas (`supabase_db_promofy`, `_sigo-clinicas`,
 *      `_vertexa-*`, `_faithx-reactnative` — ver `docker ps`). Um `db:types`
 *      disparado do diretório errado, ou com `SUPABASE_WORKDIR`/cwd ambíguo,
 *      mira a stack errada sem aviso.
 *   2. `>` é redirecionamento do SHELL: o arquivo de destino é truncado para
 *      0 bytes ANTES de o comando rodar, e continua truncado se o comando
 *      falhar. Ninguém checava o exit code depois — o mesmo padrão do
 *      `npm run verify | tail -80` já registrado como armadilha. Resultado
 *      observado: `database.types.ts` zerado, sem erro visível.
 *
 * Este script fecha os dois buracos:
 *
 *   - a stack-alvo é resolvida por `supabase status --workdir <repoRoot>`,
 *     nunca por `--local`/cwd implícito. `--workdir` aponta para a raiz DESTE
 *     repositório (calculada a partir de `__dirname`), então rodar o comando
 *     de outro diretório não muda o alvo.
 *   - a geração escreve em arquivo TEMPORÁRIO; só depois de validar o
 *     conteúdo é que ele substitui o arquivo final, por `rename` (atômico no
 *     mesmo volume, em Windows e POSIX). Qualquer falha em qualquer etapa
 *     apaga o temporário e deixa o arquivo válido intocado, byte a byte.
 *
 * `DB_TYPES_OVERRIDE_URL` é um hook SÓ DE TESTE (ver test-db-types-safe.ts):
 * substitui a URL derivada do `supabase status`, para o teste negativo poder
 * simular uma geração que falha sem precisar derrubar a stack real. Não é
 * lido em nenhum outro lugar do projeto.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const ARQUIVO_FINAL = resolve(REPO_ROOT, "src/lib/supabase/database.types.ts");
const SCHEMAS = ["public", "graphql_public"]; // espelha `[api].schemas` do config.toml

// Tabelas que só existem se o alvo for MESMO o banco do Promofy (schema
// inicial, Fase 1) — não provam a taxonomia nova, provam que não caímos em
// outro Postgres local que por acaso respondeu na porta certa.
const TABELAS_SENTINELA = ["profiles", "estabelecimentos", "cupons", "cupons_usuario"];

// Piso de sanidade, não contrato rígido. O arquivo tem 966 linhas hoje;
// qualquer coisa muito abaixo disso é truncamento, não "schema encolheu".
const PISO_LINHAS = 300;

function log(msg: string) {
  console.log(`[db:types] ${msg}`);
}

function falhar(msg: string): never {
  console.error(`[db:types] ERRO: ${msg}`);
  console.error(`[db:types] ${ARQUIVO_FINAL} NÃO foi tocado.`);
  process.exit(1);
}

/** Redige credencial antes de qualquer log — mesmo sendo local. */
function redigir(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<url ilegível>";
  }
}

/**
 * Resolve a URL do Postgres da stack LOCAL deste repositório, sempre por
 * `--workdir` explícito — nunca por `--local` (que resolve por cwd) e nunca
 * por porta hardcoded (portas de `config.toml` podem mudar; múltiplas stacks
 * nesta máquina já usam 5432x/5543x/5553x vizinhos).
 */
function resolverDbUrl(): string {
  const override = process.env.DB_TYPES_OVERRIDE_URL;
  if (override) {
    log(`DB_TYPES_OVERRIDE_URL setada — usando URL de override (modo teste).`);
    return override;
  }

  let saida: string;
  try {
    saida = execFileSync(
      "supabase",
      ["status", "--workdir", REPO_ROOT, "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detalhe = err.stderr?.toString().trim() || err.message || String(e);
    falhar(
      `\`supabase status\` falhou — a stack local do Promofy está no ar?\n` +
        `  (rode \`supabase start\` neste repositório)\n  detalhe: ${detalhe}`,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(saida);
  } catch {
    falhar(`\`supabase status -o json\` não devolveu JSON válido.`);
  }

  const dbUrl = parsed!["DB_URL"];
  if (typeof dbUrl !== "string" || !dbUrl.startsWith("postgresql://")) {
    falhar(`\`supabase status\` não trouxe DB_URL válida para ${REPO_ROOT}.`);
  }
  return dbUrl as string;
}

/**
 * Gera os tipos para um arquivo TEMPORÁRIO via `--db-url` explícito (nunca
 * `--local`) e devolve o conteúdo gerado. Não escreve no arquivo final.
 */
function gerarParaTemp(dbUrl: string, tempPath: string): string {
  const args = [
    "gen",
    "types",
    "typescript",
    "--workdir",
    REPO_ROOT,
    "--db-url",
    dbUrl,
    ...SCHEMAS.flatMap((s) => ["--schema", s]),
  ];

  let conteudo: string;
  try {
    conteudo = execFileSync("supabase", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message?: string };
    const detalhe = err.stderr?.toString().trim() || err.message || String(e);
    if (existsSync(tempPath)) rmSync(tempPath, { force: true });
    falhar(`\`supabase gen types\` terminou com erro contra ${redigir(dbUrl)}.\n  detalhe: ${detalhe}`);
  }

  writeFileSync(tempPath, conteudo, "utf8");
  return conteudo;
}

/**
 * Valida que o conteúdo gerado (a) não é lixo/truncamento e (b) veio
 * REALMENTE do banco do Promofy, não de outro Postgres local que a porta
 * apontou por acidente.
 */
function validar(conteudo: string, tempPath: string): void {
  const abortar = (motivo: string) => {
    if (existsSync(tempPath)) rmSync(tempPath, { force: true });
    falhar(motivo);
  };

  if (conteudo.length === 0) abortar("saída da geração está vazia.");

  const linhas = conteudo.split("\n").length;
  if (linhas < PISO_LINHAS) {
    abortar(`saída tem só ${linhas} linhas (piso de sanidade: ${PISO_LINHAS}) — parece truncamento.`);
  }

  if (!conteudo.includes("export type Database")) {
    abortar('saída não contém "export type Database" — não parece um typings file do Supabase.');
  }

  const faltando = TABELAS_SENTINELA.filter((t) => !new RegExp(`\\b${t}:\\s*\\{`).test(conteudo));
  if (faltando.length > 0) {
    abortar(
      `tabelas sentinela do Promofy ausentes no resultado: ${faltando.join(", ")}. ` +
        `O alvo da geração não parece ser o banco deste projeto.`,
    );
  }

  log(`validado: ${linhas} linhas, sentinelas presentes (${TABELAS_SENTINELA.join(", ")}).`);
}

function main() {
  log(`repo: ${REPO_ROOT}`);
  const dbUrl = resolverDbUrl();
  log(`alvo: ${redigir(dbUrl)}`);

  const tempPath = `${ARQUIVO_FINAL}.tmp-${randomUUID()}`;

  const conteudo = gerarParaTemp(dbUrl, tempPath);
  validar(conteudo, tempPath);

  // Só agora o arquivo final é tocado — `rename` substitui atomicamente
  // (Windows e POSIX) em vez de um `write` que poderia deixar o arquivo
  // pela metade se o processo morrer no meio.
  try {
    renameSync(tempPath, ARQUIVO_FINAL);
  } catch (e) {
    if (existsSync(tempPath)) rmSync(tempPath, { force: true });
    falhar(`falha ao substituir ${ARQUIVO_FINAL}: ${(e as Error).message}`);
  }

  log(`OK — ${ARQUIVO_FINAL} atualizado.`);
}

main();
