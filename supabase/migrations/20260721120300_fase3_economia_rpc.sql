-- ============================================================
-- Promofy — Fase 3 · Migration 11: total economizado (D3)
--
-- Soma cupons.economia das validações do próprio consumidor.
-- SECURITY DEFINER porque a RLS pública de cupons esconde cupom de
-- estabelecimento suspenso/expirado — sob invoker, a economia já ganha
-- nesses cupons seria SUBCONTADA. Como definer ignora a RLS, o filtro
-- por auth.uid() DENTRO da função é a ÚNICA barreira: sem parâmetro de
-- usuário, predicado explícito por (select auth.uid()). search_path
-- travado + revoke de public/anon (padrão fase2_rpcs).
-- ============================================================

create or replace function public.economia_total_consumidor()
returns numeric
language sql stable
security definer set search_path = ''
as $$
  select coalesce(sum(c.economia), 0)::numeric
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
   where cu.usuario_id = (select auth.uid())
     and cu.status = 'validado';
$$;

revoke execute on function public.economia_total_consumidor() from public, anon;
grant execute on function public.economia_total_consumidor() to authenticated;
