-- ============================================================
-- Promofy — CLIENT-CALL-CLOSURE-01
-- Pausa operacional + indicadores de vitrine + fronteira pausa×ativação
--
-- ADITIVA. Não edita migration hospedada. Não toca CRM.
--
-- O QUE JÁ EXISTE E NÃO SE REESCREVE:
--   janela_alcance (29) — teto da janela prevalece sobre o prazo de 5h.
--   Reserva de capacidade (34) — ocupados = validado + ativo vigente.
--   status_cupom.indisponivel — oscilação operacional, visível na vitrine,
--   recusada por ativar_cupom quando status <> 'ativo'. É o estado Pausado.
--
-- O QUE ESTA MIGRATION FAZ:
--   (1) RPCs pausar_cupom / retomar_cupom — único caminho de escrita do
--       status operacional. `status` não está no grant de update do lojista
--       (migration 9 / 32).
--   (2) RPC indicadores_vitrine_cupons — batch sem PII: ocupados,
--       disponíveis, resgates confirmados (só validado).
--   (3) ativar_cupom — SEMPRE FOR UPDATE OF c no SELECT inicial, para a
--       pausa e a ativação se serializarem na mesma linha. O status lido
--       é o da linha travada (não um snapshot anterior ao lock).
--   (4) validar_cupom — o carimbo esgotado também pega cupom pausado
--       (indisponivel): a última validação de uma reserva pré-pausa
--       encerra a campanha de verdade.
-- ============================================================

-- ------------------------------------------------------------
-- (1) PAUSAR — ativo → indisponivel. Idempotente se já pausado.
--
-- Não exclui, não mexe em cupons_usuario, não apaga métricas.
-- Recusa o que não é campanha no ar: pendente/rejeitado/esgotado/
-- excluido/expirado, e ativo cuja validade já venceu (aí o caminho
-- é prorrogar, não pausar).
-- ------------------------------------------------------------
create or replace function public.pausar_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.cupons%rowtype;
  v_hoje date := public.hoje_brt();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v_row
    from public.cupons
   where id = p_cupom_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if not (select private.owns_estabelecimento(v_row.estabelecimento_id)) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado');
  end if;

  if v_row.status = 'excluido' then
    return jsonb_build_object('ok', false, 'motivo', 'excluido');
  end if;
  if v_row.status = 'esgotado' then
    return jsonb_build_object('ok', false, 'motivo', 'esgotado');
  end if;
  if v_row.status = 'pendente' then
    return jsonb_build_object('ok', false, 'motivo', 'pendente');
  end if;
  if v_row.status = 'rejeitado' then
    return jsonb_build_object('ok', false, 'motivo', 'rejeitado');
  end if;
  if v_row.status = 'expirado' or v_row.validade_fim < v_hoje then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if v_row.status = 'indisponivel' then
    return jsonb_build_object('ok', true, 'ja_pausado', true);
  end if;
  if v_row.status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_operacional');
  end if;

  update public.cupons
     set status = 'indisponivel',
         atualizado_em = now(),
         moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'em', now(),
                'acao', 'pausado',
                'por', v_uid
              ))
   where id = p_cupom_id
     and status = 'ativo'
   returning * into v_row;

  if not found then
    -- Outra transação venceu a corrida (pausa ou mudança de status).
    select * into v_row from public.cupons where id = p_cupom_id;
    if v_row.status = 'indisponivel' then
      return jsonb_build_object('ok', true, 'ja_pausado', true);
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'nao_operacional');
  end if;

  return jsonb_build_object('ok', true, 'ja_pausado', false);
end;
$$;

comment on function public.pausar_cupom(text) is
  'CLIENT-CALL-CLOSURE-01: pausa operacional (ativo→indisponivel). Impede novas ativações; códigos já emitidos seguem validáveis. Owner only.';

revoke execute on function public.pausar_cupom(text) from public, anon;
grant execute on function public.pausar_cupom(text) to authenticated;

-- ------------------------------------------------------------
-- (2) RETOMAR — indisponivel → ativo. Não pula validade nem moderação.
-- ------------------------------------------------------------
create or replace function public.retomar_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.cupons%rowtype;
  v_hoje date := public.hoje_brt();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v_row
    from public.cupons
   where id = p_cupom_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if not (select private.owns_estabelecimento(v_row.estabelecimento_id)) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado');
  end if;

  if v_row.status = 'excluido' then
    return jsonb_build_object('ok', false, 'motivo', 'excluido');
  end if;
  if v_row.status = 'esgotado' then
    return jsonb_build_object('ok', false, 'motivo', 'esgotado');
  end if;
  if v_row.status = 'pendente' then
    return jsonb_build_object('ok', false, 'motivo', 'pendente');
  end if;
  if v_row.status = 'rejeitado' then
    return jsonb_build_object('ok', false, 'motivo', 'rejeitado');
  end if;
  if v_row.status = 'expirado' or v_row.validade_fim < v_hoje then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if v_row.status = 'ativo' then
    return jsonb_build_object('ok', true, 'ja_retomado', true);
  end if;
  if v_row.status <> 'indisponivel' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_pausado');
  end if;

  update public.cupons
     set status = 'ativo',
         atualizado_em = now(),
         moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'em', now(),
                'acao', 'retomado',
                'por', v_uid
              ))
   where id = p_cupom_id
     and status = 'indisponivel'
     and validade_fim >= v_hoje
   returning * into v_row;

  if not found then
    select * into v_row from public.cupons where id = p_cupom_id;
    if v_row.status = 'ativo' then
      return jsonb_build_object('ok', true, 'ja_retomado', true);
    end if;
    if v_row.status = 'expirado' or v_row.validade_fim < v_hoje then
      return jsonb_build_object('ok', false, 'motivo', 'expirado');
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'nao_pausado');
  end if;

  return jsonb_build_object('ok', true, 'ja_retomado', false);
end;
$$;

comment on function public.retomar_cupom(text) is
  'CLIENT-CALL-CLOSURE-01: retoma cupom pausado (indisponivel→ativo) se ainda válido e aprovado. Não reseta histórico. Owner only.';

revoke execute on function public.retomar_cupom(text) from public, anon;
grant execute on function public.retomar_cupom(text) to authenticated;

-- ------------------------------------------------------------
-- (3) INDICADORES DE VITRINE — batch, sem PII.
--
-- ocupados = validado + ativo vigente (a mesma conta de ativar_cupom).
-- disponiveis = limite_total - ocupados, só quando há limite.
-- resgates_confirmados = só validado (nunca ativação vigente).
-- Ilimitado: limite/ocupados/disponiveis NULL — a UI não inventa ∞.
-- ------------------------------------------------------------
create or replace function public.indicadores_vitrine_cupons()
returns table(
  cupom_id text,
  limite_total int,
  ocupados bigint,
  disponiveis int,
  resgates_confirmados bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.limite_total,
    case
      when c.limite_total is null then null
      else (
        select count(*)::bigint
          from public.cupons_usuario u
         where u.cupom_id = c.id
           and (
             u.status = 'validado'
             or (u.status = 'ativo' and u.expira_em > now())
           )
      )
    end as ocupados,
    case
      when c.limite_total is null then null
      else greatest(
        0,
        c.limite_total - (
          select count(*)::int
            from public.cupons_usuario u
           where u.cupom_id = c.id
             and (
               u.status = 'validado'
               or (u.status = 'ativo' and u.expira_em > now())
             )
        )
      )
    end as disponiveis,
    (
      select count(*)::bigint
        from public.cupons_usuario u
       where u.cupom_id = c.id
         and u.status = 'validado'
    ) as resgates_confirmados
    from public.cupons c
    join public.estabelecimentos est on est.id = c.estabelecimento_id
   where c.status in ('ativo', 'indisponivel')
     and est.status = 'ativo';
$$;

revoke execute on function public.indicadores_vitrine_cupons() from public;
grant execute on function public.indicadores_vitrine_cupons() to anon, authenticated;

comment on function public.indicadores_vitrine_cupons() is
  'CLIENT-CALL-CLOSURE-01: batch da vitrine — ocupados/disponiveis (capacidade) e resgates_confirmados (só validado). Sem usuario_id/CPF/email.';

-- ------------------------------------------------------------
-- (4) ativar_cupom — lock SEMPRE, status lido sob o lock.
--
-- Cópia da 34 com duas mudanças pontuais:
--   * SELECT ... FOR UPDATE OF c (não só quando há limite_total);
--   * some o PERFORM extra — o lock já veio no SELECT.
-- O resto (janela, teto, reserva, clique) é o mesmo contrato.
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
  v_capacidade int;
  v_tentativa int := 0;
  v_constraint text;
  v_alcance jsonb;
  v_teto timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  -- Lock da linha ANTES do clique (KEY SHARE da FK). Sempre — pausa e
  -- ativação compartilham esta fronteira, inclusive em cupom ilimitado.
  select c.id, c.status, c.validade_inicio, c.validade_fim,
         c.limite_por_usuario, c.limite_total, c.prazo_ativacao_horas,
         c.horarios, e.status as est_status
    into v_cupom
    from public.cupons c
    join public.estabelecimentos e on e.id = c.estabelecimento_id
   where c.id = p_cupom_id
   for update of c;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, 'clique');

  update public.cupons_usuario
     set status = 'expirado'
   where usuario_id = v_uid and cupom_id = p_cupom_id
     and status = 'ativo' and expira_em <= now();

  select * into v_row
    from public.cupons_usuario
   where usuario_id = v_uid and cupom_id = p_cupom_id and status = 'ativo';
  if found then
    return jsonb_build_object('ok', true, 'ja_ativo', true,
      'estado', public.estado_cupom_json(v_row));
  end if;

  if v_cupom.status = 'esgotado' then
    return jsonb_build_object('ok', false, 'motivo', 'esgotado');
  end if;
  if v_cupom.status <> 'ativo' or v_cupom.est_status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;
  if (v_cupom.validade_inicio is not null and v_cupom.validade_inicio > public.hoje_brt())
     or v_cupom.validade_fim < public.hoje_brt() then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_validade');
  end if;

  v_alcance := public.janela_alcance(
    v_cupom.horarios, coalesce(v_cupom.prazo_ativacao_horas, 5));
  if not (v_alcance ->> 'alcancavel')::boolean then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela');
  end if;
  v_teto := (v_alcance ->> 'teto')::timestamptz;

  if v_cupom.limite_por_usuario is not null then
    select count(*) into v_consumidas
      from public.cupons_usuario
     where usuario_id = v_uid and cupom_id = p_cupom_id
       and (status = 'validado' or (status = 'ativo' and expira_em > now()));
    if v_consumidas >= v_cupom.limite_por_usuario then
      return jsonb_build_object('ok', false, 'motivo', 'limite_usuario');
    end if;
  end if;

  if v_cupom.limite_total is not null then
    select count(*) into v_capacidade
      from public.cupons_usuario
     where cupom_id = p_cupom_id
       and (status = 'validado'
            or (status = 'ativo' and expira_em > now()));

    if v_capacidade >= v_cupom.limite_total then
      return jsonb_build_object('ok', false, 'motivo', 'esgotado');
    end if;
  end if;

  loop
    begin
      insert into public.cupons_usuario (usuario_id, cupom_id, expira_em)
      values (v_uid, p_cupom_id,
              least(
                now() + make_interval(hours => coalesce(v_cupom.prazo_ativacao_horas, 5)),
                coalesce(v_teto, 'infinity'::timestamptz)
              ))
      returning * into v_row;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'uniq_cupons_usuario_ativo' then
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
      else
        raise;
      end if;
    end;
  end loop;

  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, 'ativacao');

  return jsonb_build_object('ok', true, 'ja_ativo', false,
    'estado', public.estado_cupom_json(v_row));
end;
$$;

comment on function public.ativar_cupom(text) is
  'Fase 9/D1 + CLIENT-CALL-CLOSURE-01: reserva a vaga; lock da linha do cupom sempre (pausa×ativação). Janela alcançável e teto de expira_em intactos.';

revoke execute on function public.ativar_cupom(text) from public, anon;
grant execute on function public.ativar_cupom(text) to authenticated;

-- ------------------------------------------------------------
-- (5) validar_cupom — carimbo esgotado também em pausado.
--     Mesmo corpo da PRE-CALL-FIX-02; só o WHERE do carimbo muda.
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
  if v.owner_id is distinct from v_uid then
    return jsonb_build_object('ok', false, 'motivo', 'outro_estabelecimento');
  end if;
  if v.usuario_id = v_uid then
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

  if v.limite_total is not null then
    select count(*) into v_validacoes
      from public.cupons_usuario
     where cupom_id = v.cupom_id and status = 'validado';
    if v_validacoes >= v.limite_total then
      update public.cupons
         set status = 'esgotado',
             atualizado_em = now(),
             moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
               || jsonb_build_array(jsonb_build_object(
                    'em', now(),
                    'acao', 'esgotado',
                    'por', null,
                    'validacoes', v_validacoes
                  ))
       where id = v.cupom_id and status in ('ativo', 'indisponivel');
    end if;
  end if;

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

comment on function public.validar_cupom(text) is
  'Fase 2 + 9/D1 + PRE-CALL-FIX-02 + CLIENT-CALL-CLOSURE-01: valida no balcão; owner_id NULL rejeita; esgotamento também a partir de pausado.';
