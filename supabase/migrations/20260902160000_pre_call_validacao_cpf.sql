-- ============================================================
-- Promofy — PRE-CALL-FIX-02 · paridade código ↔ CPF na validação
--
-- DIAGNÓSTICO (produção + repro local):
--
--   Ativação viva da Convidada (CPF 987.***.***-00) em e3 ("Studio Bella").
--   e3..e6 nasceram no seed SEM owner_id; só e1/e2 ganham dono em seed-users.
--
--   `validar_cupom` checava `if v.owner_id <> v_uid`. Com owner_id NULL,
--   a comparação em SQL é UNKNOWN e o IF em PL/pgSQL NÃO entra — qualquer
--   lojista (dono de outro estab) validava o código do órfão.
--
--   `buscar_ativacoes_por_cpf` filtra `estabelecimento_id = any(estabs_do_dono())`,
--   que nunca inclui órfãos. Mesma ativação: código PASS, CPF → sem_ativacao_aqui.
--
-- CORREÇÃO:
--   (1) Autoridade: `owner_id is distinct from auth.uid()` — NULL também rejeita.
--   (2) Backfill: e3..e6 herdam o dono de e1 quando e1 já tem owner (hospedado).
--       No db:reset local o seed ainda não rodou aqui; seed-users cobre o baseline.
--
-- Não edita migrations da Fase 8. Não afrouxa indistinguibilidade / rate limit /
-- exigência de CPF na confirmação / ausência do código na busca.
-- ============================================================

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
  -- PRE-CALL-FIX-02: `<>` falhava aberto com owner_id NULL (órfãos e3..e6).
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
       where id = v.cupom_id and status = 'ativo';
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
  'Fase 2 + 9/D1 + PRE-CALL-FIX-02: valida o código no balcão; owner_id NULL rejeita (is distinct from); esgotamento na mesma transação.';

-- Hospedado: e1 já tem dono. Local no reset: no-op até seed-users.
update public.estabelecimentos e
   set owner_id = d.owner_id
  from public.estabelecimentos d
 where d.id = 'e1'
   and d.owner_id is not null
   and e.id in ('e3', 'e4', 'e5', 'e6')
   and e.owner_id is null;
