/**
 * Vercel pela API REST, com token de escopo mínimo (Fase 7/P3).
 *
 * POR QUE NÃO A CLI DA VERCEL
 *
 * A primeira versão desta fase instalou a CLI. Ela não funciona com o token
 * que queremos usar: a CLI consulta `/v2/user` no arranque, e um token com
 * escopo de TIME recebe 404 ali (e 403 em `/v2/teams`) — medido, não suposto.
 * Fazer a CLI funcionar exigiria um token de conta inteira, o oposto do que o
 * resto deste projeto faz (grant por coluna, RLS, definer com checagem
 * explícita). Então a CLI saiu e ficou a API, que aceita o token restrito.
 *
 * O que se perde: `vercel dev`, `vercel logs`, `vercel deploy`. Nenhum deles é
 * usado aqui — o deploy é pelo Git. Se um dia forem necessários, aí sim se
 * discute um token amplo e temporário.
 *
 * O token vai no header Authorization e NUNCA é impresso. Valores de env var
 * também não: `env` lista apenas nomes e ambientes.
 *
 * Uso:
 *   npm run vercel:deployments
 *   npm run vercel:env
 *   npm run vercel:env:set NEXT_PUBLIC_SENTRY_DSN preview,production
 *   npm run vercel:rollback -- dpl_xxxxxxxx
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const TIME = "team_EKI4zpKeMY2o6K1cLM0RDJl9"; // time "Promofy" (slug promo-project)
const PROJETO = "promofy";
const BASE = "https://api.vercel.com";

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error(
    [
      "",
      "  VERCEL_TOKEN ausente.",
      "",
      "  1. https://vercel.com/account/settings/tokens → Create Token",
      '  2. Scope: o time "Promofy" — NÃO "Full Account".',
      "  3. Cole em .env.local (gitignored por `.env*.local`):",
      "",
      "       VERCEL_TOKEN=...",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

async function api<T>(
  caminho: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const sep = caminho.includes("?") ? "&" : "?";
  const resp = await fetch(`${BASE}${caminho}${sep}teamId=${TIME}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const texto = await resp.text();
  if (!resp.ok) {
    // A mensagem da Vercel pode ecoar o que foi enviado. Não é lugar de valor
    // de env var, então o corpo do erro é truncado.
    throw new Error(`${resp.status} ${caminho.split("?")[0]} — ${texto.slice(0, 300)}`);
  }
  return texto ? (JSON.parse(texto) as T) : ({} as T);
}

function dataBr(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ---------------------------------------------------------------

async function deployments() {
  const r = await api<{
    deployments: {
      uid: string;
      url: string;
      state: string;
      target: string | null;
      created: number;
      meta?: Record<string, string>;
    }[];
  }>(`/v6/deployments?projectId=${PROJETO}&limit=10`);

  console.log(`\nDeployments de ${PROJETO} (mais recente primeiro)\n`);
  r.deployments.forEach((d, i) => {
    const sha = (d.meta?.githubCommitSha ?? "").slice(0, 7);
    const branch = d.meta?.githubCommitRef ?? "—";
    const alvo = d.target ?? "preview";
    const marca = i === 0 && alvo === "production" ? "  <- ROLLBACK CANDIDATE" : "";
    console.log(
      `  ${d.uid}\n    ${d.state.padEnd(8)} ${alvo.padEnd(10)} ${sha.padEnd(8)} ${branch}\n    ${dataBr(d.created)}  https://${d.url}${marca}\n`,
    );
  });
}

async function envLs() {
  const r = await api<{
    envs: { key: string; target?: string[]; type: string; gitBranch?: string }[];
  }>(`/v9/projects/${PROJETO}/env`);

  console.log(`\nEnv vars de ${PROJETO} (NOMES apenas — valores nunca são impressos)\n`);
  for (const alvo of ["production", "preview", "development"]) {
    const doAlvo = r.envs.filter((e) => (e.target ?? []).includes(alvo));
    console.log(`  ${alvo} (${doAlvo.length})`);
    for (const e of doAlvo.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(`    ${e.key}  [${e.type}]`);
    }
    console.log("");
  }
}

async function envSet(chave: string, alvos: string[]) {
  const valor = process.env[chave];
  if (!valor) {
    console.error(`${chave} não está no .env.local — nada a enviar.`);
    process.exit(1);
  }
  const r = await api<{ failed: { error: { message: string } }[] }>(
    `/v10/projects/${PROJETO}/env?upsert=true`,
    {
      method: "POST",
      body: {
        key: chave,
        value: valor,
        // "encrypted": a Vercel guarda cifrado e não devolve o valor em leitura.
        type: "encrypted",
        target: alvos,
        comment: "Fase 7 — definida via scripts/vercel-api.ts",
      },
    },
  );
  if (r.failed?.length) {
    console.error(`Falhou: ${r.failed.map((f) => f.error.message).join("; ")}`);
    process.exit(1);
  }
  console.log(`OK — ${chave} definida em ${alvos.join(", ")} (valor não impresso).`);
}

async function rollback(deploymentId: string) {
  await api(`/v1/projects/${PROJETO}/rollback/${deploymentId}`, { method: "POST" });
  console.log(`Rollback disparado para ${deploymentId}.`);
  console.log("Confirme com: npm run vercel:deployments");
}

// ---------------------------------------------------------------

const [cmd, ...resto] = process.argv.slice(2);

const rotas: Record<string, () => Promise<void>> = {
  deployments,
  env: envLs,
  "env:set": async () => {
    const [chave, alvos] = resto;
    if (!chave || !alvos) {
      console.error("Uso: npm run vercel:env:set <CHAVE> <preview,production>");
      process.exit(1);
    }
    await envSet(chave, alvos.split(","));
  },
  rollback: async () => {
    if (!resto[0]) {
      console.error("Uso: npm run vercel:rollback -- <deploymentId>");
      process.exit(1);
    }
    await rollback(resto[0]);
  },
};

const rota = rotas[cmd ?? ""];
if (!rota) {
  console.error(`Comandos: ${Object.keys(rotas).join(" | ")}`);
  process.exit(1);
}

rota().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
