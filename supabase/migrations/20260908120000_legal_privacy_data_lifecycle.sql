-- LEGAL-PRIVACY-01: encerramento de conta do consumidor (state machine) +
-- anonimização mínima. Reaceite versionado de documentos NÃO precisa de
-- schema novo — `aceites_documento` (mig. 20260902140000) já grant/RLS
-- self-insert, self-select; a versão "atual" de cada documento vive em
-- src/lib/documentos-legais.ts, não no banco (mesmo padrão do termos
-- consumidor já existente).
--
-- Escopo desta migration: SÓ consumidor. Encerramento de conta de parceiro
-- (estabelecimento) cascateia para cupons/clientes de terceiros e fica como
-- decisão de produto separada — não implementado aqui.

create type public.status_conta as enum ('ativo', 'encerramento_solicitado', 'anonimizado');

alter table public.profiles
  add column status public.status_conta not null default 'ativo',
  add column encerramento_solicitado_em timestamptz,
  add column encerramento_concluido_em timestamptz;

-- 1. Consumidor solicita encerramento da própria conta.
-- A conta fica inutilizável a partir daqui (bloqueio no app-layer, `/m`
-- layout, lê `status`); a anonimização de fato roda em
-- `concluir_anonimizacao_conta`, disparada fora do caminho do usuário
-- (service_role) dentro da janela de até 30 dias que a Política promete.
create or replace function public.solicitar_encerramento_conta()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v_row from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if v_row.role <> 'consumidor' then
    -- Encerramento de conta de parceiro/admin não é coberto por este
    -- fluxo (cascata para clientes de terceiros; decisão de produto à
    -- parte). Não fingir suporte.
    return jsonb_build_object('ok', false, 'motivo', 'papel_nao_suportado');
  end if;

  if v_row.status = 'anonimizado' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_encerrada');
  end if;

  if v_row.status = 'encerramento_solicitado' then
    return jsonb_build_object(
      'ok', true,
      'status', v_row.status,
      'solicitado_em', v_row.encerramento_solicitado_em
    );
  end if;

  update public.profiles
     set status = 'encerramento_solicitado',
         encerramento_solicitado_em = now()
   where id = v_uid
   returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'status', v_row.status,
    'solicitado_em', v_row.encerramento_solicitado_em
  );
end;
$$;

-- 2. Cancelamento — só permitido ANTES da anonimização de fato rodar
-- (Fase 12: "cancelamento quando permitido"). Depois de `anonimizado` não
-- há volta: os dados já foram removidos.
create or replace function public.cancelar_encerramento_conta()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v_row from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if v_row.status = 'anonimizado' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_encerrada');
  end if;

  if v_row.status <> 'encerramento_solicitado' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_solicitado');
  end if;

  update public.profiles
     set status = 'ativo',
         encerramento_solicitado_em = null
   where id = v_uid;

  return jsonb_build_object('ok', true, 'status', 'ativo');
end;
$$;

-- 3. Anonimização de fato. SERVICE_ROLE-only (disparo fora do caminho do
-- usuário — job/admin, não este WP). Só toca `profiles`: o resto do
-- schema (cupons_usuario, cupom_eventos, pontos_transacoes, favoritos,
-- avaliacoes, aceites_documento, crm_exportacoes, validacao_tentativas)
-- não guarda PII própria — só FK para profiles.id — então zerar aqui já
-- remove a PII em toda a superfície sem apagar linha nenhuma, preservando
-- o histórico agregado do estabelecimento e a trilha de auditoria/aceite
-- exigida por lei. `assinaturas` fica de fora: billing real ainda não
-- existe (ver docs/audits/2026-09-02-final-client-audit.md Parte 12).
create or replace function public.concluir_anonimizacao_conta(p_usuario_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.profiles%rowtype;
begin
  select * into v_row from public.profiles where id = p_usuario_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if v_row.status <> 'encerramento_solicitado' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_solicitado');
  end if;

  update public.profiles
     set nome = 'Usuário anonimizado',
         cpf = null,
         telefone = null,
         nascimento = null,
         cidade = null,
         status = 'anonimizado',
         encerramento_concluido_em = now()
   where id = p_usuario_id;

  return jsonb_build_object('ok', true, 'status', 'anonimizado');
end;
$$;

-- `revoke ... from public` sozinho NÃO bastaria: este projeto grant EXECUTE
-- diretamente a anon/authenticated no bootstrap do Supabase, não só via o
-- pseudo-role PUBLIC — o padrão já estabelecido (gerar_codigo_cupom,
-- forcar_status_pendente, aplicar_ciclo_vida_cupom) sempre lista os três.
revoke execute on function public.solicitar_encerramento_conta() from public, anon;
revoke execute on function public.cancelar_encerramento_conta() from public, anon;
revoke execute on function public.concluir_anonimizacao_conta(uuid) from public, anon, authenticated;

grant execute on function public.solicitar_encerramento_conta() to authenticated;
grant execute on function public.cancelar_encerramento_conta() to authenticated;
grant execute on function public.concluir_anonimizacao_conta(uuid) to service_role;
