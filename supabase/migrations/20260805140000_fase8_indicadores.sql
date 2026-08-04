-- ============================================================
-- Promofy — Fase 8 · Migration 25: indicadores do estabelecimento (M2)
--
-- O NPS é coletado desde a Fase 2 (`cupons_usuario.nps`, escrito só por
-- `responder_nps`) e NUNCA foi agregado. O estabelecimento não via nada, e o
-- `/portal/avaliacoes` exibia "NPS médio recebido: 8,7" — string hardcoded.
-- Esta migration é o número de verdade.
--
-- POR QUE `security definer`
--
-- A RLS de `cupons_usuario` mostra ao consumidor as SUAS linhas; o lojista não
-- lê as linhas de ninguém. Sob invoker, o lojista veria zero e o NPS seria
-- sempre nulo. Como definer, o filtro por posse DENTRO da função é a única
-- barreira — daí ele vir primeiro, antes de qualquer leitura.
--
-- O QUE NÃO SAI DAQUI
--
-- Nome completo, e-mail, CPF e id do consumidor. As últimas notas levam apenas
-- o PRIMEIRO NOME: o lojista precisa de rosto humano no feedback, não de
-- identificação. `split_part(nome,' ',1)` — e nunca o `usuario_id`, que
-- permitiria cruzar notas entre cupons e reconstruir o histórico de alguém.
-- ============================================================

create or replace function public.indicadores_estabelecimento()
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estab  text;
  v_total  int;
  v_prom   int;
  v_neu    int;
  v_detr   int;
  v_resg   int;
  v_ultimas jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  -- Posse ANTES de qualquer leitura. Sem estabelecimento, sai sem tocar dado.
  select e.id into v_estab
    from public.estabelecimentos e
   where e.owner_id = v_uid
   limit 1;
  if v_estab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_estabelecimento');
  end if;

  -- Faixas canônicas do NPS. Notas nulas (quem não respondeu) ficam fora da
  -- base de cálculo — não são detratores.
  select
    count(*) filter (where cu.nps is not null),
    count(*) filter (where cu.nps between 9 and 10),
    count(*) filter (where cu.nps between 7 and 8),
    count(*) filter (where cu.nps between 0 and 6)
    into v_total, v_prom, v_neu, v_detr
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
   where c.estabelecimento_id = v_estab;

  -- Resgates do MÊS corrente em horário de Brasília — "mês" é conceito de
  -- negócio, e em UTC o dia 1º começaria às 21h do dia 30.
  select count(*) into v_resg
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
   where c.estabelecimento_id = v_estab
     and cu.status = 'validado'
     and cu.validado_em is not null
     and date_trunc('month', cu.validado_em at time zone 'America/Sao_Paulo')
       = date_trunc('month', (now() at time zone 'America/Sao_Paulo'));

  select coalesce(jsonb_agg(x order by x->>'em' desc), '[]'::jsonb) into v_ultimas
    from (
      select jsonb_build_object(
               'nota', cu.nps,
               -- PRIMEIRO nome apenas. Sem sobrenome, sem id, sem CPF.
               'nome', coalesce(nullif(split_part(p.nome, ' ', 1), ''), 'Cliente'),
               'cupom', c.titulo,
               'em', cu.validado_em
             ) as x
        from public.cupons_usuario cu
        join public.cupons c   on c.id = cu.cupom_id
        join public.profiles p on p.id = cu.usuario_id
       where c.estabelecimento_id = v_estab
         and cu.nps is not null
       order by cu.validado_em desc nulls last
       limit 5
    ) ult;

  return jsonb_build_object(
    'ok', true,
    -- `tem_dados` existe para a UI NÃO precisar decidir se 0 respostas
    -- significam "score zero" ou "ainda sem avaliações". São coisas
    -- diferentes, e derivar isso na tela é como o selo "utilizado" errou na
    -- Fase 6: a decisão vem do servidor.
    'tem_dados', v_total > 0,
    'respostas', v_total,
    'score', case when v_total > 0
                  then round(((v_prom - v_detr)::numeric * 100) / v_total)
                  else null end,
    'promotores', v_prom,
    'neutros', v_neu,
    'detratores', v_detr,
    'resgates_mes', v_resg,
    'ultimas', v_ultimas
  );
end;
$$;

comment on function public.indicadores_estabelecimento() is
  'Fase 8/M2: NPS, distribuicao, resgates do mes e ultimas notas do estabelecimento do chamador. Primeiro nome apenas; nunca id/CPF/e-mail do consumidor.';

revoke execute on function public.indicadores_estabelecimento() from public, anon;
grant  execute on function public.indicadores_estabelecimento() to authenticated;
