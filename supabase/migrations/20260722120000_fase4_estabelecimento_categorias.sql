-- ============================================================
-- Promofy — Fase 4 · Migration 12: multi-categoria por estabelecimento
--
-- Junção estabelecimento_categorias (N categorias por estabelecimento;
-- cada CUPOM continua com 1 categoria, que deve pertencer ao conjunto).
-- estabelecimentos.categoria_id PERMANECE como "categoria principal"
-- (compat: avatar/gradiente dos cards e pré-seleção do form).
--
-- Escrita na junção: SÓ ADMIN (decisão da Fase 4 — mesmo racional da
-- auto-aprovação fechada na Fase 3: lojista com INSERT/DELETE poderia
-- se auto-inserir nas 6 categorias sem moderação e deletar a própria
-- principal). Lojista tem SELECT das suas (o form de cupom só precisa ler).
-- ============================================================

create table public.estabelecimento_categorias (
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  categoria_id text not null references public.categorias (id) on delete cascade,
  primary key (estabelecimento_id, categoria_id)
);

-- PK cobre buscas por estabelecimento; índice para o caminho inverso
create index idx_estab_categorias_categoria
  on public.estabelecimento_categorias (categoria_id);

-- Default privileges do Supabase dão ALL a anon/authenticated em tabela
-- nova — revogar tudo antes de conceder o mínimo (padrão da migration 3).
revoke all on table public.estabelecimento_categorias from anon, authenticated;
grant select on public.estabelecimento_categorias to anon, authenticated;
grant insert, delete on public.estabelecimento_categorias to authenticated; -- policies restringem a admin

alter table public.estabelecimento_categorias enable row level security;

-- Leitura pública: só de estabelecimentos ativos (espelha a policy de cupons)
create policy "estab_categorias: publico le de estabelecimento ativo"
  on public.estabelecimento_categorias for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.estabelecimentos e
      where e.id = estabelecimento_id and e.status = 'ativo'
    )
  );

-- Lojista lê as do próprio estabelecimento (mesmo pendente/suspenso — o
-- form de novo cupom precisa listar o conjunto); admin lê todas
create policy "estab_categorias: dono e admin leem"
  on public.estabelecimento_categorias for select
  to authenticated
  using (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  );

-- Escrita: só admin
create policy "estab_categorias: admin insere"
  on public.estabelecimento_categorias for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "estab_categorias: admin remove"
  on public.estabelecimento_categorias for delete
  to authenticated
  using ((select private.is_admin()));

-- Backfill: cada categoria única atual vira uma linha da junção (cobre o
-- hosted no `db push`; no reset local o seed também popula)
insert into public.estabelecimento_categorias (estabelecimento_id, categoria_id)
select id, categoria_id from public.estabelecimentos
on conflict do nothing;

-- ------------------------------------------------------------
-- Invariante "principal ∈ junção": o lojista perdia pouco e ganhava um
-- furo — o grant da Fase 1 permitia PATCH direto de categoria_id em
-- estabelecimentos, deslocando a principal para fora do conjunto.
-- Nenhum código do app atualiza estabelecimentos (verificado); a
-- principal passa a ser admin-managed (via service_role/SQL).
-- ------------------------------------------------------------
revoke update on table public.estabelecimentos from authenticated, anon;
grant update (nome, cidade) on public.estabelecimentos to authenticated;

-- ------------------------------------------------------------
-- Enforcement no banco (defesa em profundidade): a categoria do cupom
-- DEVE pertencer ao conjunto do estabelecimento. Trigger (e não FK
-- composta) para não interferir na ordem dos cascades de delete.
-- SECURITY DEFINER: valida contra a junção inteira, sem depender da
-- RLS de quem insere. Não dispara em aprovar_cupom (que só toca
-- status/atualizado_em/publicado_em).
-- ------------------------------------------------------------
create or replace function public.checar_categoria_cupom()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.estabelecimento_categorias ec
    where ec.estabelecimento_id = new.estabelecimento_id
      and ec.categoria_id = new.categoria_id
  ) then
    raise exception 'categoria_fora_do_conjunto'
      using hint = 'A categoria do cupom deve ser uma das categorias do estabelecimento.';
  end if;
  return new;
end;
$$;

revoke execute on function public.checar_categoria_cupom() from public, anon, authenticated;

create trigger trg_cupom_categoria_no_conjunto
  before insert or update of categoria_id, estabelecimento_id on public.cupons
  for each row execute function public.checar_categoria_cupom();
