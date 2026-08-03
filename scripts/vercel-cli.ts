/**
 * Vercel CLI com token de projeto — caminho estável, sem depender do OAuth
 * do conector MCP (que expirou no meio do deploy da Fase 6.5 e obrigou a
 * reiniciar a sessão).
 *
 * POR QUE UM WRAPPER, E NÃO `vercel` direto no npm script:
 *
 *  1. npm scripts NÃO carregam `.env.local`. O token vive lá (gitignored por
 *     `.env*.local`) e precisa ser injetado explicitamente — mesmo padrão que
 *     `seed-users.ts` e as suítes já usam com `dotenv`.
 *  2. O token vai por **variável de ambiente do processo filho**, nunca como
 *     `--token` na linha de comando: argumento de processo é legível por
 *     qualquer outro processo da máquina (`ps`, Get-Process, Procmon).
 *  3. `--scope` é fixado aqui. A conta tem um time só (`promo-project`), mas
 *     deixar implícito é como o deploy da Fase 6.5 quase foi para o projeto
 *     errado — ver a regra de contas de hospedagem na memória do projeto.
 *
 * Uso:
 *   npm run vercel:deployments
 *   npm run vercel:env
 *   npm run vercel:rollback -- dpl_xxxxxxxx
 *   npm run vercel -- <qualquer subcomando da CLI>
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const TIME = "promo-project";
const PROJETO = "promofy";

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error(
    [
      "",
      "  VERCEL_TOKEN ausente.",
      "",
      "  1. https://vercel.com/account/settings/tokens → Create Token",
      `  2. Scope: o time "Promofy" (${TIME}) — NÃO "Full Account".`,
      "     Tokens da Vercel são de conta ou de TIME; não existe token de projeto.",
      `     Como este time tem só o projeto "${PROJETO}", time == projeto na prática.`,
      "  3. Expiration: o menor prazo que sirva ao seu ciclo de trabalho.",
      "  4. Cole em .env.local (JÁ gitignored por `.env*.local`):",
      "",
      "       VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx",
      "",
      "  Nunca versione o token, nunca o cole num relatório, nunca o passe por --token.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Uso: npm run vercel -- <subcomando>   (ex.: ls, env ls, rollback <id>)");
  process.exit(1);
}

// O ambiente do filho carrega o token; a linha de comando, não.
const env = { ...process.env, VERCEL_TOKEN: token };

function vercel(argv: string[]) {
  return spawnSync("npx", ["--no-install", "vercel", ...argv, "--scope", TIME], {
    stdio: "inherit",
    env,
    shell: true, // resolve o .cmd do node_modules/.bin no Windows
  });
}

// `env ls` e `rollback` exigem projeto vinculado (.vercel/project.json, gitignored).
// Vincular é idempotente e não-interativo com --yes.
if (!existsSync(".vercel/project.json")) {
  const link = vercel(["link", "--yes", "--project", PROJETO]);
  if (link.status !== 0) process.exit(link.status ?? 1);
}

process.exit(vercel(args).status ?? 1);
