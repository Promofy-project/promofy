-- ============================================================
-- Promofy — Fase 1 · Migration 4: view de métricas de cupom
--
-- Métricas SEMPRE derivadas de cupom_eventos (nunca contadores
-- soltos). security_invoker: a view respeita o RLS de quem
-- consulta — lojista só agrega eventos dos próprios cupons.
-- ============================================================

create view public.cupom_metricas
with (security_invoker = true) as
select
  cupom_id,
  count(*) filter (where tipo = 'visualizacao') as visualizacoes,
  count(*) filter (where tipo = 'clique')       as cliques,
  count(*) filter (where tipo = 'ativacao')     as ativacoes,
  count(*) filter (where tipo = 'validacao')    as resgates
from public.cupom_eventos
group by cupom_id;
