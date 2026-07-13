-- ============================================================
-- Promofy — Fase 2 · Migration 7: regras de negócio no servidor
--
-- RPCs SECURITY DEFINER = único caminho de escrita do ciclo do
-- cupom, validação, NPS, eventos e pontos. Cada função roda numa
-- transação e faz as checagens de papel/posse EXPLICITAMENTE.
-- No final, os grants diretos de escrita da Fase 1 são revogados.
--
-- Convenções:
-- * "hoje" de negócio = America/Sao_Paulo (hoje_brt) — um cupom
--   válido "até dia X" não morre às 21:00 BRT por causa do UTC.
-- * Retornos jsonb {ok:true,...} | {ok:false, motivo:'...'} — a
--   Server Action traduz motivo em mensagem amigável.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
create or replace function public.hoje_brt()
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Máscara padrão do produto: 123.***.***-09. Nunca devolver CPF
-- completo para o portal.
create or replace function public.mascarar_cpf(p_cpf text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if length(d) <> 11 then
    return '***';
  end if;
  return substr(d, 1, 3) || '.***.***-' || substr(d, 10, 2);
end;
$$;

-- Serialização única do estado de uma linha do ciclo
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
    'nps', p_row.nps
  );
$$;


-- ------------------------------------------------------------
-- ATIVAR CUPOM (consumidor)
-- ------------------------------------------------------------
create or replace function public.ativar_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cupom record;
  v_row public.cupons_usuario%rowtype;
  v_consumidas int;
  v_validacoes int;
  v_tentativa int := 0;
  v_constraint text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  -- expiração lazy: libera a vaga de ativações vencidas
  update public.cupons_usuario
     set status = 'expirado'
   where usuario_id = v_uid and cupom_id = p_cupom_id
     and status = 'ativo' and expira_em <= now();

  -- já existe ativação vigente → idempotente (reabre o mesmo código)
  select * into v_row
    from public.cupons_usuario
   where usuario_id = v_uid and cupom_id = p_cupom_id and status = 'ativo';
  if found then
    return jsonb_build_object('ok', true, 'ja_ativo', true,
      'estado', public.estado_cupom_json(v_row));
  end if;

  select c.id, c.status, c.validade_inicio, c.validade_fim,
         c.limite_por_usuario, c.limite_total, c.prazo_ativacao_horas,
         e.status as est_status
    into v_cupom
    from public.cupons c
    join public.estabelecimentos e on e.id = c.estabelecimento_id
   where c.id = p_cupom_id;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v_cupom.status <> 'ativo' or v_cupom.est_status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;
  if (v_cupom.validade_inicio is not null and v_cupom.validade_inicio > public.hoje_brt())
     or v_cupom.validade_fim < public.hoje_brt() then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_validade');
  end if;

  -- limite por usuário: validadas + ativas vigentes consomem vaga;
  -- expiradas liberam (interpretação documentada no relatório da fase)
  select count(*) into v_consumidas
    from public.cupons_usuario
   where usuario_id = v_uid and cupom_id = p_cupom_id
     and (status = 'validado' or (status = 'ativo' and expira_em > now()));
  if v_consumidas >= v_cupom.limite_por_usuario then
    return jsonb_build_object('ok', false, 'motivo', 'limite_usuario');
  end if;

  -- limite total (checagem de admissão; a autoritativa é na validação)
  if v_cupom.limite_total is not null then
    select count(*) into v_validacoes
      from public.cupons_usuario
     where cupom_id = p_cupom_id and status = 'validado';
    if v_validacoes >= v_cupom.limite_total then
      return jsonb_build_object('ok', false, 'motivo', 'esgotado');
    end if;
  end if;

  -- insert com tratamento de corrida/colisão por constraint
  loop
    begin
      insert into public.cupons_usuario (usuario_id, cupom_id, expira_em)
      values (v_uid, p_cupom_id,
              now() + make_interval(hours => coalesce(v_cupom.prazo_ativacao_horas, 5)))
      returning * into v_row;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'uniq_cupons_usuario_ativo' then
        -- corrida: outra requisição do mesmo usuário venceu → idempotente
        select * into v_row
          from public.cupons_usuario
         where usuario_id = v_uid and cupom_id = p_cupom_id and status = 'ativo';
        if found then
          return jsonb_build_object('ok', true, 'ja_ativo', true,
            'estado', public.estado_cupom_json(v_row));
        end if;
        raise;
      elsif v_constraint = 'cupons_usuario_codigo_key' then
        v_tentativa := v_tentativa + 1;
        if v_tentativa > 2 then raise; end if;
        -- loop de novo: o default gera outro código
      else
        raise;
      end if;
    end;
  end loop;

  -- evento de ativação na MESMA transação (métricas derivadas)
  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, 'ativacao');

  return jsonb_build_object('ok', true, 'ja_ativo', false,
    'estado', public.estado_cupom_json(v_row));
end;
$$;

-- ------------------------------------------------------------
-- VALIDAR CUPOM (lojista) — status + evento + pontos numa transação
-- ------------------------------------------------------------
create or replace function public.validar_cupom(p_codigo text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v record;
  v_validacoes int;
  v_pontos int;
  v_cliente record;
begin
  if v_uid is null
     or not exists (select 1 from public.estabelecimentos where owner_id = v_uid) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  select cu.id, cu.usuario_id, cu.cupom_id, cu.status, cu.expira_em, cu.codigo,
         c.titulo, c.beneficio, c.limite_total, e.owner_id
    into v
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
    join public.estabelecimentos e on e.id = c.estabelecimento_id
   where cu.codigo = v_codigo
     for update of cu;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v.owner_id <> v_uid then
    return jsonb_build_object('ok', false, 'motivo', 'outro_estabelecimento');
  end if;
  if v.usuario_id = v_uid then
    -- lojista não valida (nem pontua) o próprio cupom
    return jsonb_build_object('ok', false, 'motivo', 'cupom_proprio');
  end if;
  if v.status = 'validado' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_validado');
  end if;
  if v.status = 'expirado' then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if v.expira_em <= now() then
    update public.cupons_usuario set status = 'expirado' where id = v.id;
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;

  -- recheck AUTORITATIVO do limite total, serializado pela linha do cupom
  if v.limite_total is not null then
    perform 1 from public.cupons where id = v.cupom_id for update;
    select count(*) into v_validacoes
      from public.cupons_usuario
     where cupom_id = v.cupom_id and status = 'validado';
    if v_validacoes >= v.limite_total then
      return jsonb_build_object('ok', false, 'motivo', 'esgotado');
    end if;
  end if;

  update public.cupons_usuario
     set status = 'validado', validado_em = now()
   where id = v.id;

  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (v.cupom_id, v.usuario_id, 'validacao');

  select pontos into v_pontos from public.config_pontos where acao = 'resgate';
  insert into public.pontos_transacoes (usuario_id, acao, pontos, referencia_id)
  values (v.usuario_id, 'resgate', coalesce(v_pontos, 0), v.id::text);
  -- (índice único usuario/acao/referencia garante 1 crédito por resgate)

  select nome, cpf into v_cliente from public.profiles where id = v.usuario_id;

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'codigo', v.codigo,
    'titulo', v.titulo,
    'beneficio', v.beneficio,
    'cliente_nome', coalesce(v_cliente.nome, ''),
    'cliente_cpf', public.mascarar_cpf(v_cliente.cpf),
    'validado_em', now()
  ));
end;
$$;

-- ------------------------------------------------------------
-- RESPONDER NPS (consumidor) — idempotente
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
    return jsonb_build_object('ok', true, 'ja_respondido', true, 'saldo', v_saldo);
  end if;

  update public.cupons_usuario set nps = p_nota where id = v.id;

  select pontos into v_pontos from public.config_pontos where acao = 'nps';
  insert into public.pontos_transacoes (usuario_id, acao, pontos, referencia_id)
  values (v_uid, 'nps', coalesce(v_pontos, 0), v.id::text)
  on conflict do nothing;  -- cinto extra sobre o índice único

  select coalesce(sum(pontos), 0) into v_saldo
    from public.pontos_transacoes where usuario_id = v_uid;

  return jsonb_build_object('ok', true, 'ja_respondido', false, 'saldo', v_saldo);
end;
$$;

-- ------------------------------------------------------------
-- EVENTOS DO APP (visualizacao/clique) — dedup 1/usuário/cupom/dia BRT
-- ------------------------------------------------------------
create or replace function public.registrar_evento_cupom(p_cupom_id text, p_tipo text)
returns void
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;  -- anônimo não registra (no-op silencioso)
  end if;
  if p_tipo not in ('visualizacao', 'clique') then
    raise exception 'tipo de evento invalido: %', p_tipo;
  end if;

  -- só cupom publicamente visível conta métrica de app
  if not exists (
    select 1 from public.cupons c
    join public.estabelecimentos e on e.id = c.estabelecimento_id
    where c.id = p_cupom_id
      and c.status in ('ativo', 'indisponivel')
      and e.status = 'ativo'
  ) then
    return;
  end if;

  if exists (
    select 1 from public.cupom_eventos
    where cupom_id = p_cupom_id and usuario_id = v_uid
      and tipo = p_tipo::public.tipo_evento_cupom
      and (criado_em at time zone 'America/Sao_Paulo')::date = public.hoje_brt()
  ) then
    return;  -- dedup do dia
  end if;

  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, p_tipo::public.tipo_evento_cupom);
end;
$$;

-- ------------------------------------------------------------
-- LEITURAS (security INVOKER — RLS do chamador se aplica)
-- ------------------------------------------------------------
create or replace function public.saldo_pontos()
returns int
language sql stable
security invoker set search_path = ''
as $$
  select coalesce(sum(pontos), 0)::int
    from public.pontos_transacoes
   where usuario_id = (select auth.uid());
$$;

-- Hidratação do app do consumidor em 1 round-trip.
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
      select jsonb_agg(public.estado_cupom_json(cu) order by cu.ativado_em desc)
        from public.cupons_usuario cu
       where cu.usuario_id = (select auth.uid())
         and (cu.status = 'validado' or (cu.status = 'ativo' and cu.expira_em > now()))
    ), '[]'::jsonb)
  );
$$;

-- ------------------------------------------------------------
-- GRANTS: RPC é o ÚNICO caminho de escrita do ciclo a partir daqui
-- ------------------------------------------------------------
revoke insert, update on table public.cupons_usuario from authenticated;
revoke execute on function public.gerar_codigo_cupom() from authenticated;

revoke execute on function
  public.ativar_cupom(text),
  public.validar_cupom(text),
  public.responder_nps(bigint, int),
  public.registrar_evento_cupom(text, text),
  public.saldo_pontos(),
  public.meu_estado_consumidor(),
  public.hoje_brt(),
  public.mascarar_cpf(text),
  public.estado_cupom_json(public.cupons_usuario)
from public, anon;

grant execute on function
  public.ativar_cupom(text),
  public.validar_cupom(text),
  public.responder_nps(bigint, int),
  public.registrar_evento_cupom(text, text),
  public.saldo_pontos(),
  public.meu_estado_consumidor()
to authenticated;
