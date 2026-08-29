-- ============================================================
-- Promofy — Adendo 05/08 · Migration 35: "Não responder" no NPS
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
-- A REGRA É DO SERVIDOR, NÃO DA TELA. Recusar é definitivo, e "definitivo"
-- que só existe no React não é definitivo: o consumidor fala PostgREST tão
-- bem quanto o lojista. Por isso `responder_nps` é reescrita aqui para
-- RECUSAR a nota de uma linha já recusada — sem gravar `nps`, sem creditar,
-- sem tocar o ledger. As duas direções ficam fechadas:
--
--     responder → recusar   já era proibido (devolve `ja_respondido`)
--     recusar   → responder passa a ser proibido (`motivo: nps_recusado`)
--
-- E O ESTADO PRECISA SABER. `estado_cupom_json` devolvia `nps` e mais nada
-- sobre a pesquisa: um cliente lendo `nps === null` concluía "ainda dá para
-- responder" e mostrava o CTA de avaliação sobre uma pesquisa encerrada. A
-- chave `nps_recusado_em` entra ali para que os três estados sejam
-- distinguíveis na leitura — não respondeu / respondeu / recusou. É UX; a
-- autoridade continua sendo a RPC.
--
-- ADITIVA. `usos`, `saldo`, `config` e `usuario` saem idênticos; `estados`
-- ganha UMA chave nova (o cliente antigo ignora chave que não conhece, e o
-- `m/layout.tsx` repassa o DTO inteiro). `nps_pendentes` só encolhe, e só
-- para quem recusou.
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
-- 3. ESTADO DO CUPOM — passa a distinguir "recusou" de "não respondeu"
--
-- Corpo idêntico ao da migration 6, com UMA chave a mais. Sem ela, o único
-- sinal sobre a pesquisa era `nps`, e `nps = null` misturava duas coisas
-- opostas: "ainda pode responder" e "encerrou de vez". A folha do cupom
-- (`cupom-ativo-sheet`) decidia o CTA "Avaliar experiência" exatamente por
-- esse null.
--
-- `immutable` de propósito, como antes: é função de UMA linha, sem leitura
-- de outra tabela e sem `now()`.
-- ------------------------------------------------------------
create or replace function public.estado_cupom_json(p_row public.cupons_usuario)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'row_id', p_row.id,
    'cupom_id', p_row.cupom_id,
    'status', p_row.status,
    'codigo', p_row.codigo,
    'ativado_em', p_row.ativado_em,
    'expira_em', p_row.expira_em,
    'nps', p_row.nps,
    -- Adendo 05/08: null = nunca recusou. Quem lê `nps is null` PRECISA
    -- olhar aqui antes de oferecer a pesquisa.
    'nps_recusado_em', p_row.nps_recusado_em
  );
$$;

comment on function public.estado_cupom_json(public.cupons_usuario) is
  'Adendo 05/08: ganha nps_recusado_em, para o cliente distinguir "ainda pode responder" de "encerrou de vez". Resto identico a migration 6.';

-- `create or replace` PRESERVA o ACL — nada aqui promove esta função. O
-- revoke é re-emitido porque é exatamente o que a migration 2 declarou para
-- ela (`from public, anon`), e ela NÃO aparece no bloco de `grant ... to
-- authenticated` de lá: quem a alcança é `meu_estado_consumidor`, e essa
-- rota não muda.
revoke execute on function public.estado_cupom_json(public.cupons_usuario)
  from public, anon;

-- ------------------------------------------------------------
-- 4. RECUSAR NPS — encerramento definitivo, sem pontos
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
-- 5. RESPONDER NPS — recusada não aceita nota. NO SERVIDOR.
--
-- Corpo da migration 15 (Fase 5) com UM ramo novo. Tudo o mais é byte a byte
-- o que já estava no ar: a validação da nota, a idempotência, o crédito
-- lido do RETURNING, o `for update`.
--
-- POR QUE ESTE RAMO EXISTE. Sem ele, "encerramento definitivo" seria uma
-- promessa da tela: bastava a pessoa (ou qualquer coisa com o token dela)
-- chamar `responder_nps` com o `row_id` para ressuscitar uma pesquisa
-- encerrada, gravar nota e receber os pontos que a recusa dizia não creditar.
-- A UI não é fronteira — a fronteira é aqui.
--
-- ORDEM DOS RAMOS, e ela é deliberada: `nps is not null` ANTES da recusa.
-- Isso preserva EXATAMENTE a idempotência que já existia (segunda resposta
-- devolve `ja_respondido` + `pontos: 0`), e uma linha respondida nunca chega
-- a ter recusa — `recusar_nps` se recusa a marcá-la.
--
-- `motivo: 'nps_recusado'` segue o vocabulário da casa (`nao_validado`,
-- `nao_encontrado`, `cpf_invalido`, `limite_usuario`): snake_case, curto,
-- estável, legível pelo cliente sem tradução.
-- ------------------------------------------------------------
create or replace function public.responder_nps(p_row_id bigint, p_nota int)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.cupons_usuario%rowtype;
  v_pontos int;
  v_creditado int;
  v_saldo int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;
  if p_nota is null or p_nota < 0 or p_nota > 10 then
    return jsonb_build_object('ok', false, 'motivo', 'nota_invalida');
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
    select coalesce(sum(pontos), 0) into v_saldo
      from public.pontos_transacoes where usuario_id = v_uid;
    return jsonb_build_object('ok', true, 'ja_respondido', true,
      'saldo', v_saldo, 'pontos', 0);
  end if;

  -- NOVO (adendo 05/08): a pesquisa foi encerrada pelo próprio dono.
  -- Sai ANTES de qualquer escrita: nada em `cupons_usuario`, nada no ledger.
  if v.nps_recusado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'nps_recusado');
  end if;

  update public.cupons_usuario set nps = p_nota where id = v.id;

  select pontos into v_pontos from public.config_pontos where acao = 'nps';
  insert into public.pontos_transacoes (usuario_id, acao, pontos, referencia_id)
  values (v_uid, 'nps', coalesce(v_pontos, 0), v.id::text)
  on conflict do nothing  -- cinto extra sobre o índice único
  returning pontos into v_creditado;

  select coalesce(sum(pontos), 0) into v_saldo
    from public.pontos_transacoes where usuario_id = v_uid;

  return jsonb_build_object('ok', true, 'ja_respondido', false,
    'saldo', v_saldo, 'pontos', coalesce(v_creditado, 0));
end;
$$;

comment on function public.responder_nps(bigint, int) is
  'Adendo 05/08: recusa vinda de recusar_nps bloqueia a nota (motivo nps_recusado), sem escrita e sem ledger. Resto identico a migration 15.';

-- `create or replace` preserva o ACL; re-emitido no padrão da migration 15.
revoke execute on function public.responder_nps(bigint, int) from public, anon;
grant  execute on function public.responder_nps(bigint, int) to authenticated;

-- ------------------------------------------------------------
-- 6. MEU ESTADO CONSUMIDOR — a fila passa a ignorar as recusadas
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
