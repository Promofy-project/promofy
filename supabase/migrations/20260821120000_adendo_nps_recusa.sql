-- ============================================================
-- Promofy — Adendo 05/08 · Migration 36: "Não responder" no NPS
--
-- O PEDIDO (refinamento do cliente sobre o Z1). O card da pesquisa passa a
-- ter três saídas, e não duas:
--
--   * Responder            → `responder_nps` (existe desde a Fase 2)
--   * Responder mais tarde → dispensar SÓ NESTA SESSÃO (nada no banco;
--                            a próxima abertura oferece de novo)
--   * Não responder        → ENCERRAMENTO DEFINITIVO: a linha sai da fila
--                            para sempre, sem crédito de pontos
--
-- Só a terceira precisa de banco: "mais tarde" já é o comportamento atual do
-- dispensar (estado de sessão no provider), e "responder" já existe.
--
-- POR QUE UMA COLUNA, E NÃO UM SENTINELA EM `nps`. Marcar recusa como
-- `nps = -1` (ou 0) contaminaria a única coluna de onde saem os indicadores:
-- `indicadores_estabelecimento` (migration 25) monta a base do NPS com
-- `nps is not null` e classifica 0–6 como DETRATOR. Um recusado viraria
-- detrator — o oposto do que "não quis responder" significa. `nps` continua
-- querendo dizer uma coisa só: a nota que a pessoa deu.
--
-- POR QUE timestamptz E NÃO boolean. Mesmo custo de escrita e de leitura
-- (`is null` / `is not null`), e responde "quando" de graça — a mesma escolha
-- de `validado_em`. Um boolean exigiria DEFAULT e backfill implícito; a coluna
-- nullable nasce NULL em todas as linhas sem reescrever nada.
--
-- SEM GRANT NOVO. A migration 2 revogou `insert, update` de `cupons_usuario`
-- para `authenticated` — toda escrita passa por RPC `security definer`. A
-- coluna nova entra nesse mesmo regime: não há PATCH possível por PostgREST,
-- nem para marcar nem para desmarcar a recusa.
--
-- ADITIVA. `estados`, `usos`, `saldo`, `config` e `usuario` saem idênticos.
-- O código publicado que não conhece `nps_recusado_em` continua funcionando:
-- ninguém recusa nada, e `nps_pendentes` se comporta como antes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A marca da recusa
-- ------------------------------------------------------------
alter table public.cupons_usuario
  add column nps_recusado_em timestamptz;

comment on column public.cupons_usuario.nps_recusado_em is
  'Adendo 05/08: quando o consumidor escolheu NAO responder o NPS desta ativacao. NULL = nunca recusou. Encerramento definitivo — a linha sai de nps_pendentes para sempre e nao gera credito de pontos. Nao confundir com "responder mais tarde", que e estado de sessao no cliente e nao e gravado.';

-- ------------------------------------------------------------
-- 2. O índice parcial acompanha o predicado da consulta
--
-- A migration 28 criou o índice com `status = 'validado' and nps is null`.
-- A consulta ganhou uma terceira condição; sem ela no predicado, o índice
-- passaria a carregar linhas que a fila nunca mais devolve.
-- ------------------------------------------------------------
drop index if exists public.cupons_usuario_nps_pendente_idx;

create index cupons_usuario_nps_pendente_idx
  on public.cupons_usuario (usuario_id, validado_em desc)
  where status = 'validado' and nps is null and nps_recusado_em is null;

-- ------------------------------------------------------------
-- 3. RECUSAR NPS — encerramento definitivo, sem pontos
--
-- `security definer` pelo mesmo motivo de `responder_nps`: não existe grant
-- de UPDATE em `cupons_usuario`. O `usuario_id = auth.uid()` no WHERE é o
-- que impede recusar a pendência de outra pessoa (e devolve
-- 'nao_encontrado', que não distingue "não é sua" de "não existe").
--
-- IDEMPOTENTE nos dois sentidos:
--   * já recusada   → ok, `ja_recusado: true`, nada é reescrito (o carimbo
--                     guarda a PRIMEIRA recusa);
--   * já respondida → ok, `ja_respondido: true`, e NÃO marca recusa — a nota
--                     já foi dada, e apagá-la da fila por recusa seria mentir
--                     sobre o que aconteceu.
--
-- NÃO credita pontos, e é isso que o pedido do cliente exige: quem recusa
-- não ganha os pontos do NPS. Como não há insert em `pontos_transacoes`,
-- também não há como um clique em "Não responder" animar "+N".
-- ------------------------------------------------------------
create or replace function public.recusar_nps(p_row_id bigint)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.cupons_usuario%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v from public.cupons_usuario
   where id = p_row_id and usuario_id = v_uid
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v.status <> 'validado' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_validado');
  end if;

  if v.nps is not null then
    return jsonb_build_object('ok', true, 'ja_respondido', true, 'ja_recusado', false);
  end if;
  if v.nps_recusado_em is not null then
    return jsonb_build_object('ok', true, 'ja_respondido', false, 'ja_recusado', true);
  end if;

  update public.cupons_usuario set nps_recusado_em = now() where id = v.id;

  return jsonb_build_object('ok', true, 'ja_respondido', false, 'ja_recusado', false);
end;
$$;

comment on function public.recusar_nps(bigint) is
  'Adendo 05/08: encerra DEFINITIVAMENTE a pesquisa de NPS de uma ativacao validada, sem creditar pontos. Idempotente; nao sobrescreve nota ja dada.';

revoke execute on function public.recusar_nps(bigint) from public, anon;
grant  execute on function public.recusar_nps(bigint) to authenticated;

-- ------------------------------------------------------------
-- 4. MEU ESTADO CONSUMIDOR — a fila passa a ignorar as recusadas
--
-- Corpo idêntico ao da migration 28, com UMA linha a mais no WHERE de
-- `nps_pendentes`. Reescrita inteira porque é `create or replace` de função
-- SQL: não existe "alterar só o pedaço".
-- ------------------------------------------------------------
create or replace function public.meu_estado_consumidor()
returns jsonb
language sql stable
security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'usuario', (
      select jsonb_build_object('nome', nome, 'cpf_mascarado', public.mascarar_cpf(cpf))
        from public.profiles where id = (select auth.uid())
    ),
    'saldo', (
      select coalesce(sum(pontos), 0)::int
        from public.pontos_transacoes where usuario_id = (select auth.uid())
    ),
    'config', (
      select coalesce(jsonb_object_agg(acao::text, pontos), '{}'::jsonb)
        from public.config_pontos
    ),
    'estados', coalesce((
      select jsonb_agg(
               public.estado_cupom_json(cu) || jsonb_build_object(
                 'pontos_resgate', coalesce((
                   select pt.pontos
                     from public.pontos_transacoes pt
                    where pt.usuario_id = cu.usuario_id
                      and pt.acao = 'resgate'
                      and pt.referencia_id = cu.id::text
                    limit 1
                 ), 0)
               )
               order by cu.ativado_em desc)
        from public.cupons_usuario cu
       where cu.usuario_id = (select auth.uid())
         and (cu.status = 'validado' or (cu.status = 'ativo' and cu.expira_em > now()))
    ), '[]'::jsonb),
    -- Fase 9: o que o balcão validou e ainda não foi avaliado.
    -- Adendo 05/08: e que o consumidor não encerrou com "Não responder".
    'nps_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'row_id', cu.id,
               'cupom_id', cu.cupom_id,
               'titulo', c.titulo,
               'validado_em', cu.validado_em
             ) order by cu.validado_em desc nulls last)
        from public.cupons_usuario cu
        join public.cupons c on c.id = cu.cupom_id
       where cu.usuario_id = (select auth.uid())
         and cu.status = 'validado'
         and cu.nps is null
         and cu.nps_recusado_em is null
    ), '[]'::jsonb),
    'usos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'cupom_id', u.cupom_id,
               'consumidos', u.consumidos,
               'limite', u.limite,                        -- null = ilimitado
               'restantes', case when u.limite is null then null
                                 else greatest(u.limite - u.consumidos, 0) end,
               'pode_reusar', u.limite is null or u.consumidos < u.limite
             ))
        from (
          select cu.cupom_id,
                 count(*) filter (
                   where cu.status = 'validado'
                      or (cu.status = 'ativo' and cu.expira_em > now())
                 )::int as consumidos,
                 max(c.limite_por_usuario)::int as limite
            from public.cupons_usuario cu
            join public.cupons c on c.id = cu.cupom_id
           where cu.usuario_id = (select auth.uid())
           group by cu.cupom_id
        ) u
    ), '[]'::jsonb)
  );
$$;

comment on function public.meu_estado_consumidor() is
  'Adendo 05/08: nps_pendentes exclui as recusadas (nps_recusado_em not null). Resto identico a migration 28.';

-- `create or replace` preserva o ACL; re-emitido para a migration ser legível
-- sozinha, no padrão da 6.
revoke execute on function public.meu_estado_consumidor() from public, anon;
grant  execute on function public.meu_estado_consumidor() to authenticated;
