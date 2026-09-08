/**
 * Operação administrativa: conclui a anonimização de UMA conta em
 * `encerramento_solicitado`. Uso manual/ops — não é chamado pelo app.
 *
 * Quem/quando disparar isto automaticamente (cron, dentro da janela de
 * 30 dias que a Política de Privacidade promete) segue como decisão
 * operacional em aberto — ver docs/audits/2026-09-08-legal-privacy-gap-analysis.md.
 * Este script é o "como", pronto para ser chamado por esse mecanismo
 * quando ele existir; hoje é o caminho manual.
 *
 * Uso:
 *   npx tsx scripts/concluir-anonimizacao-conta.ts <usuario_id> [--hosted|--qa]
 */
import { resolverAlvo } from "./_alvo";
import { createClient } from "@supabase/supabase-js";
import { concluirAnonimizacaoCompleta } from "./_anonimizacao";

async function main() {
  const usuarioId = process.argv[2];
  if (!usuarioId || usuarioId.startsWith("--")) {
    console.error("Uso: npx tsx scripts/concluir-anonimizacao-conta.ts <usuario_id> [--hosted|--qa]");
    process.exitCode = 1;
    return;
  }

  const alvo = resolverAlvo("concluir-anonimizacao-conta");
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: perfil } = await svc
    .from("profiles")
    .select("id, status, role")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!perfil) {
    console.error(`Usuário ${usuarioId} não encontrado.`);
    process.exitCode = 1;
    return;
  }
  if (perfil.status !== "encerramento_solicitado") {
    console.error(`Usuário ${usuarioId} está em status "${perfil.status}", não "encerramento_solicitado". Nada a fazer.`);
    process.exitCode = 1;
    return;
  }

  const r = await concluirAnonimizacaoCompleta(svc, usuarioId);
  if (!r.ok) {
    console.error(`FALHOU na etapa "${r.etapaFalhou}": ${r.motivo}`);
    process.exitCode = 1;
    return;
  }

  console.log(`OK — ${usuarioId} anonimizado (auth.users e profiles).`);
}

main();
