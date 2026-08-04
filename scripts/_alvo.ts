/**
 * Escolha do banco-alvo dos scripts (Fase 7).
 *
 * Eram dois alvos (local e hospedado) e a decisão vivia duplicada em duas
 * linhas no topo de cada script. Com a entrada do projeto de QA viraram TRÊS,
 * e um deles é a produção do cliente — é exatamente o tipo de escolha que não
 * pode ficar espalhada. Aqui ela mora num lugar só, e o banner é obrigatório.
 *
 *   (nenhuma flag)  → local        .env.local
 *   --hosted        → PRODUÇÃO     .env.hosted.local   ⚠ dados do cliente
 *   --qa            → QA           .env.qa.local       descartável
 *
 * Lembrete que já custou caro (Fase 4): suíte automatizada NUNCA roda contra
 * as contas que o cliente usa. Contra `--hosted`, só com conta `qa-*` efêmera.
 */
import { config } from "dotenv";

export type NomeAlvo = "local" | "hospedado" | "qa";

export interface Alvo {
  nome: NomeAlvo;
  envFile: string;
  /** true quando o alvo é a produção do cliente. */
  producao: boolean;
  url: string;
  anonKey: string;
  serviceRole: string;
}

export function resolverAlvo(rotulo: string): Alvo {
  const argv = process.argv;
  const qa = argv.includes("--qa");
  const hosted = argv.includes("--hosted");

  if (qa && hosted) {
    console.error("--qa e --hosted são mutuamente exclusivos.");
    process.exit(1);
  }

  const nome: NomeAlvo = qa ? "qa" : hosted ? "hospedado" : "local";
  const envFile =
    nome === "qa" ? ".env.qa.local" : nome === "hospedado" ? ".env.hosted.local" : ".env.local";

  config({ path: envFile });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRole) {
    console.error(
      `\nFaltam variáveis em ${envFile}.\n` +
        (nome === "qa"
          ? "  QA: crie o projeto descartável e preencha o arquivo (ver CLAUDE.md).\n"
          : nome === "hospedado"
            ? "  Hospedado: preencha .env.hosted.local.\n"
            : "  Local: rode `supabase start`.\n"),
    );
    process.exit(1);
  }

  const banner =
    nome === "hospedado"
      ? "PRODUÇÃO — DADOS DO CLIENTE"
      : nome === "qa"
        ? "QA descartável"
        : "local";
  console.log(`\n[${rotulo}] alvo: ${banner} (${envFile}) → ${new URL(url).host}\n`);

  return { nome, envFile, producao: nome === "hospedado", url, anonKey, serviceRole };
}
