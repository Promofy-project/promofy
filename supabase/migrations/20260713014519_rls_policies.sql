-- ============================================================
-- Promofy — Fase 1 · Migration 3: RLS em TODAS as tabelas
--
-- Princípios:
-- * Policies com `to <role>` + predicados com (select auth.uid())
--   (cacheado por statement — não é chamado por linha).
-- * UPDATE sempre com USING **e** WITH CHECK.
-- * Colunas sensíveis protegidas por REVOKE de TABELA + GRANT por
--   coluna (revoke por coluna é NO-OP no Postgres quando existe
--   grant de tabela — e o Supabase dá ALL a anon/authenticated via
--   default privileges).
-- * Helpers SECURITY DEFINER em schema `private` (não exposto na
--   API) para evitar recursão em profiles; só revelam dados do
--   PRÓPRIO chamador.
--
-- Efeito colateral aceito (Fase 1): o admin via API também é o role
-- `authenticated` do PostgREST, então os grants por coluna limitam o
-- admin igualmente. Papéis/status/rating mudam só via seed ou
-- service_role (a UI do admin continua mockada nesta fase). A Fase 2
-- reabre escrita administrativa via server actions/RPCs.
-- ============================================================

-- HELPERS ----------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;
-- Postgres dá EXECUTE a PUBLIC por default em toda função nova:
alter default privileges in schema private revoke execute on functions from public;

create or replace function private.is_admin()
returns boolean
language sql
security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.owns_estabelecimento(est_id text)
returns boolean
language sql
security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.estabelecimentos e
    where e.id = est_id and e.owner_id = (select auth.uid())
  );
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.owns_estabelecimento(text) to authenticated;

-- GRANTS POR COLUNA (defesa contra escalação) ----------------
-- profiles: usuário nunca altera o próprio role
revoke update on table public.profiles from authenticated, anon;
grant  update (nome, cidade, cpf, telefone, nascimento)
  on public.profiles to authenticated;

-- estabelecimentos: lojista não se auto-reativa nem infla rating
revoke update on table public.estabelecimentos from authenticated, anon;
grant  update (nome, cidade, categoria_id)
  on public.estabelecimentos to authenticated;

-- cupons_usuario: consumidor só "pede" o cupom (defaults preenchem
-- status/codigo/ativado_em) e só responde NPS depois
revoke insert, update on table public.cupons_usuario from authenticated, anon;
grant  insert (usuario_id, cupom_id) on public.cupons_usuario to authenticated;
grant  update (nps) on public.cupons_usuario to authenticated;

-- cupom_eventos / pontos_transacoes: nenhuma escrita client-side na
-- Fase 1 (eventos forjáveis corromperiam métricas do lojista; pontos
-- só nascem server-side)
revoke insert, update, delete on table public.cupom_eventos from authenticated, anon;
revoke insert, update, delete on table public.pontos_transacoes from authenticated, anon;

-- ENABLE RLS EM TODAS ----------------------------------------
alter table public.profiles           enable row level security;
alter table public.categorias         enable row level security;
alter table public.estabelecimentos   enable row level security;
alter table public.cupons             enable row level security;
alter table public.avaliacoes         enable row level security;
alter table public.cupom_eventos      enable row level security;
alter table public.cupons_usuario     enable row level security;
alter table public.pontos_transacoes  enable row level security;
alter table public.config_pontos      enable row level security;
alter table public.planos             enable row level security;
alter table public.assinaturas        enable row level security;

-- PROFILES ---------------------------------------------------
create policy "profiles: dono le o proprio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: dono atualiza o proprio (colunas via grant)"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles: admin le todos"
  on public.profiles for select to authenticated
  using ((select private.is_admin()));

-- CATEGORIAS -------------------------------------------------
create policy "categorias: leitura publica"
  on public.categorias for select to anon, authenticated
  using (true);

create policy "categorias: admin gerencia"
  on public.categorias for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ESTABELECIMENTOS -------------------------------------------
create policy "estabelecimentos: publico le ativos"
  on public.estabelecimentos for select to anon, authenticated
  using (status = 'ativo');

create policy "estabelecimentos: lojista le o proprio"
  on public.estabelecimentos for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "estabelecimentos: lojista atualiza o proprio"
  on public.estabelecimentos for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "estabelecimentos: admin le todos"
  on public.estabelecimentos for select to authenticated
  using ((select private.is_admin()));

-- CUPONS -----------------------------------------------------
-- Público NÃO enxerga cupons de estabelecimento pendente/suspenso
-- (o mock tem c07→e4 pendente e c11/c12→e6 suspenso).
create policy "cupons: publico le visiveis de estabelecimento ativo"
  on public.cupons for select to anon, authenticated
  using (
    status in ('ativo','indisponivel')
    and exists (
      select 1 from public.estabelecimentos e
      where e.id = estabelecimento_id and e.status = 'ativo'
    )
  );

create policy "cupons: lojista le os proprios"
  on public.cupons for select to authenticated
  using ((select private.owns_estabelecimento(estabelecimento_id)));

create policy "cupons: lojista insere nos proprios"
  on public.cupons for insert to authenticated
  with check ((select private.owns_estabelecimento(estabelecimento_id)));

create policy "cupons: lojista atualiza os proprios"
  on public.cupons for update to authenticated
  using ((select private.owns_estabelecimento(estabelecimento_id)))
  with check ((select private.owns_estabelecimento(estabelecimento_id)));

create policy "cupons: lojista apaga os proprios"
  on public.cupons for delete to authenticated
  using ((select private.owns_estabelecimento(estabelecimento_id)));

create policy "cupons: admin le todos"
  on public.cupons for select to authenticated
  using ((select private.is_admin()));

-- AVALIACOES -------------------------------------------------
create policy "avaliacoes: leitura publica"
  on public.avaliacoes for select to anon, authenticated
  using (true);

create policy "avaliacoes: consumidor insere a propria"
  on public.avaliacoes for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "avaliacoes: consumidor atualiza a propria"
  on public.avaliacoes for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "avaliacoes: consumidor apaga a propria"
  on public.avaliacoes for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- CUPOM_EVENTOS ----------------------------------------------
-- Sem INSERT client-side na Fase 1 (ver cabeçalho).
create policy "cupom_eventos: consumidor le os proprios"
  on public.cupom_eventos for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "cupom_eventos: lojista le eventos dos proprios cupons"
  on public.cupom_eventos for select to authenticated
  using (exists (
    select 1 from public.cupons c
    where c.id = cupom_id
      and (select private.owns_estabelecimento(c.estabelecimento_id))
  ));

create policy "cupom_eventos: admin le todos"
  on public.cupom_eventos for select to authenticated
  using ((select private.is_admin()));

-- CUPONS_USUARIO ---------------------------------------------
create policy "cupons_usuario: consumidor le os proprios"
  on public.cupons_usuario for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "cupons_usuario: consumidor insere o proprio (colunas via grant)"
  on public.cupons_usuario for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "cupons_usuario: consumidor atualiza nps do proprio"
  on public.cupons_usuario for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy "cupons_usuario: lojista le resgates dos proprios cupons"
  on public.cupons_usuario for select to authenticated
  using (exists (
    select 1 from public.cupons c
    where c.id = cupom_id
      and (select private.owns_estabelecimento(c.estabelecimento_id))
  ));

create policy "cupons_usuario: admin le todos"
  on public.cupons_usuario for select to authenticated
  using ((select private.is_admin()));

-- PONTOS_TRANSACOES ------------------------------------------
create policy "pontos: consumidor le os proprios"
  on public.pontos_transacoes for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "pontos: admin le todos"
  on public.pontos_transacoes for select to authenticated
  using ((select private.is_admin()));

-- CONFIG_PONTOS ----------------------------------------------
create policy "config_pontos: leitura publica"
  on public.config_pontos for select to anon, authenticated
  using (true);

create policy "config_pontos: admin gerencia"
  on public.config_pontos for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- PLANOS -----------------------------------------------------
create policy "planos: leitura publica"
  on public.planos for select to anon, authenticated
  using (true);

create policy "planos: admin gerencia"
  on public.planos for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ASSINATURAS ------------------------------------------------
create policy "assinaturas: consumidor le a propria"
  on public.assinaturas for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "assinaturas: admin le todas"
  on public.assinaturas for select to authenticated
  using ((select private.is_admin()));
