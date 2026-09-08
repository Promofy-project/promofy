/**
 * Conclusão de anonimização — parte 2 (GoTrue) + parte 1 (SQL).
 *
 * P0-2 do audit externo do WP LEGAL-PRIVACY-01: `concluir_anonimizacao_conta`
 * (SQL, mig. 20260908120000) só zera `profiles`. `auth.users.email` — que o
 * CRM lê ao vivo via `crm_clientes`/`crm_cliente_detalhe` (join direto, sem
 * cópia) — sobrevivia intacto. Estado "anonimizado" continuava identificável.
 *
 * `auth.users` é do GoTrue, não uma tabela de aplicação: mexer nele por SQL
 * direto é desencorajado (drift entre o cache interno do GoTrey e o banco).
 * O caminho suportado é a Admin API (`auth.admin.updateUserById`), que só
 * pode rodar com `service_role` — nunca no client, sempre script local
 * (mesmo limite que todo `SUPABASE_SERVICE_ROLE_KEY` deste projeto).
 *
 * ORDEM IMPORTA: primeiro o GoTrue (email/senha/ban), só depois o SQL
 * (profiles + status). Se o SQL falhar no meio, o pior estado possível é
 * "credencial já morta, profiles ainda não zerado" — retomável rodando de
 * novo (idempotente nos dois lados). A ordem inversa deixaria uma janela
 * pior: "profiles anonimizado, mas e-mail real ainda logável".
 *
 * O que NÃO fizemos e por quê: não existe, na Admin API do supabase-js,
 * um "revogar todas as sessões deste usuário" direto por id (só
 * `admin.signOut(jwt)`, que exige o token da sessão, não o id do usuário).
 * Trocar a senha já invalida refresh tokens existentes no GoTrue; combinado
 * com `ban_duration` (bloqueia login futuro) e com o próprio app já
 * checando `profiles.status` a cada request (não a cada refresh de token),
 * a janela de exposição de uma sessão tecnicamente ainda válida fica
 * limitada ao TTL do access token (~1h, padrão Supabase) — não zero, mas
 * medido e não uma lacuna de design.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResultadoAnonimizacao {
  ok: boolean;
  motivo?: string;
  etapaFalhou?: "auth" | "sql";
}

const DOMINIO_EMAIL_ANONIMO = "anon.invalid";

export function emailAnonimoPara(usuarioId: string): string {
  // `.invalid` é TLD reservado (RFC 2606) para endereços que nunca devem
  // resolver — sinaliza intenção (não é um domínio real que alguém possa
  // registrar e receber e-mail de contas anonimizadas por engano).
  return `anon-${usuarioId}@${DOMINIO_EMAIL_ANONIMO}`;
}

function senhaAleatoria(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

/**
 * Conclui a anonimização de UM usuário: GoTrue (email/senha/ban) e, se
 * bem-sucedido, o RPC SQL (profiles + status). Idempotente: rodar de novo
 * sobre uma conta já anonimizada retorna `ja_encerrada` do RPC sem efeito
 * colateral novo.
 */
export async function concluirAnonimizacaoCompleta(
  svc: SupabaseClient,
  usuarioId: string,
): Promise<ResultadoAnonimizacao> {
  const emailAnonimo = emailAnonimoPara(usuarioId);

  const { error: erroAuth } = await svc.auth.admin.updateUserById(usuarioId, {
    email: emailAnonimo,
    password: senhaAleatoria(),
    email_confirm: true,
    ban_duration: "87600h", // ~10 anos — impede login futuro pela credencial anterior
  });
  if (erroAuth) {
    return { ok: false, motivo: erroAuth.message, etapaFalhou: "auth" };
  }

  const { data, error: erroSql } = await svc.rpc("concluir_anonimizacao_conta", {
    p_usuario_id: usuarioId,
  });
  if (erroSql) {
    return { ok: false, motivo: erroSql.message, etapaFalhou: "sql" };
  }
  const r = data as { ok: boolean; motivo?: string };
  if (!r.ok) {
    return { ok: false, motivo: r.motivo, etapaFalhou: "sql" };
  }

  return { ok: true };
}
