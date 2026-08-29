/**
 * TX-P0 — prova de que o gerador seguro (`db-types-safe.ts`) não pode mais
 * zerar `database.types.ts`, e de que ele continua gerando de verdade quando
 * o alvo é correto.
 *
 * Roda em duas partes:
 *
 *   1. NEGATIVO — aponta a geração para uma URL que não responde
 *      (`DB_TYPES_OVERRIDE_URL`, hook só de teste do próprio script seguro).
 *      Isso reproduz o modo de falha original (comando não completa) sem
 *      precisar derrubar a stack local de verdade. Exige: exit != 0, e o
 *      arquivo final IDÊNTICO byte a byte (hash, tamanho, linhas) ao de
 *      antes de rodar.
 *   2. POSITIVO — roda contra a stack local real (sem override). Exige:
 *      exit 0, arquivo substituído, sentinelas presentes.
 *
 * Pré-requisito do positivo: `supabase start` já rodando neste repositório
 * (mesma exigência de sempre para `db:types`).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..");
const ARQUIVO = resolve(REPO_ROOT, "src/lib/supabase/database.types.ts");
const SCRIPT_SEGURO = resolve(REPO_ROOT, "scripts/db-types-safe.ts");
// Invoca o CLI do tsx via `node <cli.mjs>` em vez de `npx tsx` — `npx` é um
// shim (.cmd) no Windows e `execFileSync` sem `shell: true` não o resolve.
// Rodar o .mjs direto com o node deste processo funciona nos dois SOs.
const TSX_CLI = resolve(REPO_ROOT, "node_modules/tsx/dist/cli.mjs");

function snapshot() {
  const buf = readFileSync(ARQUIVO);
  return {
    hash: createHash("sha256").update(buf).digest("hex"),
    tamanho: statSync(ARQUIVO).size,
    linhas: buf.toString("utf8").split("\n").length,
  };
}

function rodarSeguro(env: NodeJS.ProcessEnv): { exit: number; stderr: string } {
  try {
    execFileSync(process.execPath, [TSX_CLI, SCRIPT_SEGURO], {
      cwd: REPO_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exit: 0, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stderr?: Buffer };
    return { exit: err.status ?? 1, stderr: err.stderr?.toString() ?? "" };
  }
}

function main() {
  if (!existsSync(ARQUIVO)) {
    console.error(`[test:db-types] ${ARQUIVO} não existe — não há baseline para comparar. Abortando.`);
    process.exit(1);
  }

  console.log("[test:db-types] === parte 1: NEGATIVO (destino inválido) ===");
  const antes = snapshot();
  console.log(
    `[test:db-types] baseline: ${antes.linhas} linhas, ${antes.tamanho} bytes, sha256=${antes.hash.slice(0, 12)}…`,
  );

  // Porta que garantidamente não tem ninguém escutando localmente.
  const urlInvalida = "postgresql://postgres:postgres@127.0.0.1:1/postgres";
  const neg = rodarSeguro({ ...process.env, DB_TYPES_OVERRIDE_URL: urlInvalida });

  if (neg.exit === 0) {
    console.error("[test:db-types] FALHOU: geração contra destino inválido terminou com exit 0 (esperado != 0).");
    process.exit(1);
  }
  console.log(`[test:db-types] exit ${neg.exit} (esperado != 0) — OK.`);

  if (!existsSync(ARQUIVO)) {
    console.error("[test:db-types] FALHOU: arquivo final foi APAGADO pela geração que falhou.");
    process.exit(1);
  }

  const depois = snapshot();
  const identico =
    depois.hash === antes.hash && depois.tamanho === antes.tamanho && depois.linhas === antes.linhas;

  if (!identico) {
    console.error("[test:db-types] FALHOU: arquivo final mudou após geração que deveria ter sido abortada.");
    console.error(`  antes:  ${antes.linhas} linhas, ${antes.tamanho} bytes, ${antes.hash}`);
    console.error(`  depois: ${depois.linhas} linhas, ${depois.tamanho} bytes, ${depois.hash}`);
    process.exit(1);
  }
  console.log("[test:db-types] arquivo final intacto (hash/tamanho/linhas idênticos) — OK.");

  console.log("\n[test:db-types] === parte 2: POSITIVO (stack local real) ===");
  const pos = rodarSeguro(process.env);
  if (pos.exit !== 0) {
    console.error(`[test:db-types] FALHOU: geração contra a stack local terminou com exit ${pos.exit}.`);
    console.error(pos.stderr);
    console.error("  (a stack local do Promofy está no ar? `supabase start` neste repositório)");
    process.exit(1);
  }

  const final = snapshot();
  const conteudo = readFileSync(ARQUIVO, "utf8");
  const sentinelas = ["profiles", "estabelecimentos", "cupons", "cupons_usuario"];
  const faltando = sentinelas.filter((t) => !new RegExp(`\\b${t}:\\s*\\{`).test(conteudo));

  if (faltando.length > 0) {
    console.error(`[test:db-types] FALHOU: sentinelas ausentes no arquivo gerado: ${faltando.join(", ")}`);
    process.exit(1);
  }

  console.log(
    `[test:db-types] geração real OK: ${final.linhas} linhas, ${final.tamanho} bytes, sentinelas presentes.`,
  );
  console.log("\n[test:db-types] TODAS AS VERIFICAÇÕES PASSARAM.");
}

main();
