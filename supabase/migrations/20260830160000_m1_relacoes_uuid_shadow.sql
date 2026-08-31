-- ============================================================
-- Promofy — MARCO 1 (parte 1/2) · Shadows UUID + relações N:N novas
--
-- Migration NOVA, posterior a 20260830150000. NÃO edita nenhuma das
-- cinco migrations anteriores da cadeia de taxonomia — todas continuam
-- imutáveis (as quatro já hospedadas) ou intocadas (a 150000, local).
--
-- Objetivo: preparar o terreno para o cutover (TX-P2D3+) SEM fazer
-- cutover. Adiciona colunas/tabela SHADOW ao lado do legado — não
-- substitui `cupons.categoria_id` (text), não substitui
-- `estabelecimentos.categoria_id` (text), não toca
-- `estabelecimento_categorias` legado. Runtime publicado continua 100%
-- alheio a tudo isto: nenhuma view, nenhuma tela, nenhum server action
-- lê as colunas/tabela que esta migration cria.
--
-- ORDEM migration→seed E O PORQUÊ DA FUNÇÃO: `supabase db reset` aplica
-- TODAS as migrations primeiro, e só DEPOIS roda `supabase/seed.sql` —
-- que é quem cria os 6 estabelecimentos demo e os cupons canônicos
-- localmente. No HOSPEDADO essas linhas já existem há muito tempo (não
-- vêm de `seed.sql`, que nunca roda lá). Isso significa que o backfill
-- desta migration precisa se comportar OK nos dois mundos: rodar de
-- verdade quando a linha existe (hospedado, sempre; local, só depois do
-- seed), e não quebrar quando ainda não existe (local, no momento em
-- que ESTA migration roda). A solução: o backfill vira uma FUNÇÃO
-- idempotente, chamada uma vez no fim desta migration (efeito real no
-- hospedado, NO-OP local) e chamada de novo no fim de `seed.sql`
-- (efeito real local, depois que os dados existem) — uma ÚNICA fonte
-- da lógica de mapeamento, nunca duas cópias que podem divergir.
-- ============================================================

-- ------------------------------------------------------------
-- A. SHADOW em cupons — categoria_nova_id NULL ao lado do legado
-- categoria_id (text). ON DELETE RESTRICT: uma folha em uso não pode
-- desaparecer por baixo de um cupom que aponta pra ela.
-- ------------------------------------------------------------
alter table public.cupons
  add column categoria_nova_id uuid null references public.categorias_novas (id) on delete restrict;

comment on column public.cupons.categoria_nova_id is
  'MARCO 1 (shadow, STAGING): categoria folha UUID equivalente ao categoria_id legado (text). NULL até classificado. NÃO é lido por nenhuma tela ainda — public.cupons.categoria_id (legado) continua a autoridade do runtime.';

create index idx_cupons_categoria_nova on public.cupons (categoria_nova_id);

-- ------------------------------------------------------------
-- B. SHADOW em estabelecimentos — categoria_principal_id.
-- ------------------------------------------------------------
alter table public.estabelecimentos
  add column categoria_principal_id uuid null references public.categorias_novas (id) on delete restrict;

comment on column public.estabelecimentos.categoria_principal_id is
  'MARCO 1 (shadow, STAGING): categoria folha UUID equivalente ao categoria_id legado (text), que hoje é a "categoria principal" do estabelecimento. NULL até classificado. NÃO é lido por nenhuma tela ainda.';

create index idx_estabelecimentos_categoria_principal on public.estabelecimentos (categoria_principal_id);

-- ------------------------------------------------------------
-- C. Junção N:N nova — estabelecimento × categoria folha (UUID).
-- Espelha o legado `estabelecimento_categorias`, mas com categoria_id
-- UUID apontando para categorias_novas. PK composta, sem surrogate.
-- ------------------------------------------------------------
create table public.estabelecimento_categorias_novas (
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  categoria_id uuid not null references public.categorias_novas (id) on delete restrict,
  criado_em timestamptz not null default now(),
  primary key (estabelecimento_id, categoria_id)
);

comment on table public.estabelecimento_categorias_novas is
  'MARCO 1 (shadow, STAGING): junção N:N estabelecimento×categoria-folha equivalente ao legado estabelecimento_categorias, com categoria_id UUID. NÃO é lida por nenhuma tela ainda.';

create index idx_estab_categorias_novas_categoria on public.estabelecimento_categorias_novas (categoria_id);

alter table public.estabelecimento_categorias_novas enable row level security;

revoke all on table public.estabelecimento_categorias_novas from anon, authenticated;
grant select on table public.estabelecimento_categorias_novas to anon, authenticated;

create policy "estabelecimento_categorias_novas: leitura publica"
  on public.estabelecimento_categorias_novas for select to anon, authenticated
  using (true);

-- Sem policy de INSERT/UPDATE/DELETE: sem grant, não há caminho de
-- escrita para anon/authenticated — mesmo contrato de "catálogo muda
-- por migration/service_role" já usado em segmentos/categorias_novas.

-- ------------------------------------------------------------
-- D. Invariante: categoria_nova_id do cupom pertence ao conjunto do
-- estabelecimento (espelha checar_categoria_cupom, migration 9, para o
-- shadow UUID) — "ativo" só é exigido no momento de uma NOVA seleção
-- (INSERT ou UPDATE que muda categoria_nova_id). Categoria desativada
-- DEPOIS não invalida cupom histórico: a trigger só roda quando o
-- campo está sendo escrito, nunca em UPDATE que não o toca.
-- ------------------------------------------------------------
create or replace function public.checar_categoria_nova_cupom()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ativo boolean;
begin
  if new.categoria_nova_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.estabelecimento_categorias_novas ecn
     where ecn.estabelecimento_id = new.estabelecimento_id
       and ecn.categoria_id = new.categoria_nova_id
  ) then
    raise exception 'categoria_nova_fora_do_conjunto'
      using hint = 'categoria_nova_id do cupom precisa ser uma das categorias do estabelecimento em estabelecimento_categorias_novas.';
  end if;

  select (cn.ativo and s.ativo) into v_ativo
    from public.categorias_novas cn
    join public.segmentos s on s.id = cn.segmento_id
   where cn.id = new.categoria_nova_id;

  if v_ativo is not true then
    raise exception 'categoria_nova_inativa_para_nova_selecao'
      using hint = 'categoria e segmento precisam estar ativos para uma NOVA seleção de categoria_nova_id. Categoria já em uso que foi desativada depois não invalida o cupom existente — esta checagem só roda quando categoria_nova_id está sendo definida/alterada.';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_categoria_nova_cupom() from public, anon, authenticated;

comment on function public.checar_categoria_nova_cupom() is
  'MARCO 1: valida categoria_nova_id do cupom contra estabelecimento_categorias_novas + ativo, só quando o campo está sendo definido/alterado (nunca retroativo).';

drop trigger if exists trg_cupons_categoria_nova_no_conjunto on public.cupons;
create trigger trg_cupons_categoria_nova_no_conjunto
  before insert or update of categoria_nova_id, estabelecimento_id on public.cupons
  for each row execute function public.checar_categoria_nova_cupom();

-- ------------------------------------------------------------
-- E. Invariante: categoria_principal_id do estabelecimento pertence ao
-- conjunto do próprio estabelecimento — nas DUAS direções:
--   E1. definir/mudar principal para algo fora do join é negado;
--   E2. remover do join a categoria que hoje é a principal é negado.
-- ------------------------------------------------------------
create or replace function public.checar_principal_novo_no_conjunto()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.categoria_principal_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.estabelecimento_categorias_novas ecn
     where ecn.estabelecimento_id = new.id
       and ecn.categoria_id = new.categoria_principal_id
  ) then
    raise exception 'categoria_principal_fora_do_conjunto'
      using hint = 'categoria_principal_id precisa estar em estabelecimento_categorias_novas do mesmo estabelecimento.';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_principal_novo_no_conjunto() from public, anon, authenticated;

comment on function public.checar_principal_novo_no_conjunto() is
  'MARCO 1: valida (E1) que categoria_principal_id de estabelecimentos está em estabelecimento_categorias_novas do mesmo estabelecimento.';

drop trigger if exists trg_estabelecimentos_principal_novo_no_conjunto on public.estabelecimentos;
create trigger trg_estabelecimentos_principal_novo_no_conjunto
  before insert or update of categoria_principal_id on public.estabelecimentos
  for each row execute function public.checar_principal_novo_no_conjunto();

-- E2 foi estendida no HARDENING FINAL: a proteção original só olhava
-- categoria_principal_id. A auditoria achou o mesmo buraco na OUTRA
-- ponta — nada impedia remover (estabelecimento, categoria) do join
-- enquanto algum cupom daquele estabelecimento ainda usasse essa
-- categoria em categoria_nova_id (ex.: e1 tem {restaurante, pizzaria},
-- c01 usa pizzaria; DELETE (e1, pizzaria) não podia deixar c01 com uma
-- categoria_nova_id órfã do join). A função agora nega os dois casos —
-- principal E uso por cupom — e dispara também em UPDATE que MUDA a
-- chave (estabelecimento_id/categoria_id), não só em DELETE: um UPDATE
-- que reafirma a MESMA chave (sem mudar valor) não é bloqueado, mesmo
-- contrato de "IS DISTINCT FROM" já usado no resto do Marco 1.
create or replace function public.impedir_remover_categoria_do_conjunto_em_uso()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.estabelecimento_id is not distinct from old.estabelecimento_id
       and new.categoria_id is not distinct from old.categoria_id then
      return new;
    end if;
  end if;

  if exists (
    select 1 from public.estabelecimentos e
     where e.id = old.estabelecimento_id
       and e.categoria_principal_id = old.categoria_id
  ) then
    raise exception 'nao_pode_remover_categoria_principal_do_conjunto'
      using hint = 'Esta categoria é a categoria_principal_id do estabelecimento — troque a principal antes de remover ou mudar este vínculo de estabelecimento_categorias_novas.';
  end if;

  if exists (
    select 1 from public.cupons c
     where c.estabelecimento_id = old.estabelecimento_id
       and c.categoria_nova_id = old.categoria_id
  ) then
    raise exception 'nao_pode_remover_categoria_em_uso_por_cupom'
      using hint = 'Existe cupom deste estabelecimento com categoria_nova_id apontando para esta categoria — recategorize ou limpe o cupom antes de remover ou mudar este vínculo.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.impedir_remover_categoria_do_conjunto_em_uso() from public, anon, authenticated;

comment on function public.impedir_remover_categoria_do_conjunto_em_uso() is
  'MARCO 1 (HARDENING FINAL): nega DELETE/UPDATE-de-chave em estabelecimento_categorias_novas quando a linha é (E2) a categoria_principal_id vigente do estabelecimento OU (E3) está em uso por categoria_nova_id de algum cupom do mesmo estabelecimento.';

drop trigger if exists trg_estab_categorias_novas_protege_principal on public.estabelecimento_categorias_novas;
drop trigger if exists trg_estab_categorias_novas_protege_em_uso on public.estabelecimento_categorias_novas;
create trigger trg_estab_categorias_novas_protege_em_uso
  before delete or update of estabelecimento_id, categoria_id on public.estabelecimento_categorias_novas
  for each row execute function public.impedir_remover_categoria_do_conjunto_em_uso();

-- ------------------------------------------------------------
-- F. Backfill IDEMPOTENTE — EXATAMENTE docs/taxonomia/depara-v1.json.
-- Função (não bloco solto) porque `supabase/seed.sql` também precisa
-- chamá-la, depois de criar os 6 estabelecimentos/14 cupons localmente
-- (ver cabeçalho desta migration). NO-OP quando as linhas-alvo ainda
-- não existem (0 de 6 / 0 de 14); fail-high em qualquer estado parcial
-- (1..5 / 1..13); idempotente quando chamada de novo sobre dado já
-- preenchido (WHERE ... IS NULL / ON CONFLICT DO NOTHING).
--
-- HARDENING FINAL: vive em `private`, não em `public`. Isto não é API
-- de produto — é ferramenta de migration/seed/reset administrativo, e
-- `private` não está em `schemas` no config.toml do PostgREST (só
-- `public`/`graphql_public` são expostos), então a função simplesmente
-- não existe do ponto de vista da API REST, para NENHUM papel — nem
-- anon, nem authenticated, nem service_role via RPC. O `revoke execute`
-- abaixo é defesa em profundidade (mesmo padrão de `private.hmac_cpf`),
-- não o que efetivamente bloqueia: o bloqueio real é a ausência da
-- função no schema exposto. Também deixou de ser SECURITY DEFINER — só
-- roda como `postgres` (runner de migration/seed), que já tem acesso
-- direto a todas as tabelas envolvidas; DEFINER só faz sentido quando
-- quem chama precisa de um privilégio que não tem.
-- ------------------------------------------------------------
create or replace function private.aplicar_backfill_m1_taxonomia()
returns void
language plpgsql
set search_path to ''
as $$
declare
  v_estab_presentes int;
  v_join_total int;
  v_principal_preenchidos int;
  v_principal_fora_do_join int;
  v_cupons_presentes int;
  v_cupons_preenchidos int;
begin
  select count(*) into v_estab_presentes
    from public.estabelecimentos
   where id in ('e1', 'e2', 'e3', 'e4', 'e5', 'e6');

  if v_estab_presentes = 0 then
    raise notice 'MARCO1 backfill: nenhum dos 6 estabelecimentos demo existe ainda — NO-OP (esperado em migration-time local, antes do seed.sql).';
  elsif v_estab_presentes <> 6 then
    raise exception 'MARCO1 backfill: % de 6 estabelecimentos demo presentes — estado parcial inesperado. Abortando.', v_estab_presentes;
  else
    with depara_join (estabelecimento_id, segmento_slug, categoria_slug) as (
      values
        ('e1', 'alimentacao', 'restaurante'),
        ('e1', 'alimentacao', 'pizzaria'),
        ('e2', 'fitness', 'academia'),
        ('e3', 'beleza', 'salao-de-beleza'),
        ('e4', 'eletronicos', 'celulares-acessorios'),
        ('e4', 'eletronicos', 'eletroeletronicos'),
        ('e5', 'educacao', 'idiomas'),
        ('e5', 'educacao', 'cursos-profissionalizantes'),
        ('e6', 'pet', 'banho-tosa'),
        ('e6', 'pet', 'racao-acessorios')
    )
    insert into public.estabelecimento_categorias_novas (estabelecimento_id, categoria_id)
    select dj.estabelecimento_id, cn.id
      from depara_join dj
      join public.segmentos s on s.slug = dj.segmento_slug
      join public.categorias_novas cn on cn.segmento_id = s.id and cn.slug = dj.categoria_slug
    on conflict (estabelecimento_id, categoria_id) do nothing;

    select count(*) into v_join_total from public.estabelecimento_categorias_novas;
    if v_join_total <> 10 then
      raise exception 'MARCO1 backfill: junção nova tem % linhas — esperado EXATAMENTE 10 (docs/taxonomia/depara-v1.json). Abortando.', v_join_total;
    end if;

    with depara_principal (estabelecimento_id, segmento_slug, categoria_slug) as (
      values
        ('e1', 'alimentacao', 'restaurante'),
        ('e2', 'fitness', 'academia'),
        ('e3', 'beleza', 'salao-de-beleza'),
        ('e4', 'eletronicos', 'celulares-acessorios'),
        ('e5', 'educacao', 'idiomas'),
        ('e6', 'pet', 'banho-tosa')
    )
    update public.estabelecimentos e
       set categoria_principal_id = cn.id
      from depara_principal dp
      join public.segmentos s on s.slug = dp.segmento_slug
      join public.categorias_novas cn on cn.segmento_id = s.id and cn.slug = dp.categoria_slug
     where e.id = dp.estabelecimento_id
       and e.categoria_principal_id is null;

    select count(*) into v_principal_preenchidos
      from public.estabelecimentos
     where categoria_principal_id is not null;
    if v_principal_preenchidos <> 6 then
      raise exception 'MARCO1 backfill: % estabelecimentos com categoria_principal_id preenchido — esperado EXATAMENTE 6. Abortando.', v_principal_preenchidos;
    end if;

    select count(*) into v_principal_fora_do_join
      from public.estabelecimentos e
     where e.categoria_principal_id is not null
       and not exists (
         select 1 from public.estabelecimento_categorias_novas ecn
          where ecn.estabelecimento_id = e.id and ecn.categoria_id = e.categoria_principal_id
       );
    if v_principal_fora_do_join <> 0 then
      raise exception 'MARCO1 backfill: % principal(is) fora do join novo pós-backfill. Abortando.', v_principal_fora_do_join;
    end if;
  end if;

  select count(*) into v_cupons_presentes
    from public.cupons
   where id in (
     'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10',
     'c11', 'c12', 'p-campanha-esgotada', 'p-campanha-expirada'
   );

  if v_cupons_presentes = 0 then
    raise notice 'MARCO1 backfill: nenhum dos 14 cupons canônicos existe ainda — NO-OP.';
  elsif v_cupons_presentes <> 14 then
    raise exception 'MARCO1 backfill: % de 14 cupons canônicos presentes — estado parcial inesperado. Abortando.', v_cupons_presentes;
  else
    with depara_cupons (cupom_id, segmento_slug, categoria_slug) as (
      values
        ('c01', 'alimentacao', 'pizzaria'),
        ('c02', 'alimentacao', 'restaurante'),
        ('c03', 'fitness', 'academia'),
        ('c04', 'fitness', 'academia'),
        ('c05', 'beleza', 'salao-de-beleza'),
        ('c06', 'beleza', 'salao-de-beleza'),
        ('c07', 'eletronicos', 'eletroeletronicos'),
        ('c08', 'eletronicos', 'celulares-acessorios'),
        ('c09', 'educacao', 'idiomas'),
        ('c10', 'educacao', 'cursos-profissionalizantes'),
        ('c11', 'pet', 'banho-tosa'),
        ('c12', 'pet', 'racao-acessorios'),
        ('p-campanha-esgotada', 'alimentacao', 'restaurante'),
        ('p-campanha-expirada', 'alimentacao', 'restaurante')
    )
    update public.cupons c
       set categoria_nova_id = cn.id
      from depara_cupons dc
      join public.segmentos s on s.slug = dc.segmento_slug
      join public.categorias_novas cn on cn.segmento_id = s.id and cn.slug = dc.categoria_slug
     where c.id = dc.cupom_id
       and c.categoria_nova_id is null;

    select count(*) into v_cupons_preenchidos
      from public.cupons
     where categoria_nova_id is not null;
    if v_cupons_preenchidos <> 14 then
      raise exception 'MARCO1 backfill: % cupons com categoria_nova_id preenchido — esperado EXATAMENTE 14. Abortando.', v_cupons_preenchidos;
    end if;
  end if;

  raise notice 'MARCO1 backfill (taxonomia): concluído. estabelecimentos_presentes=%, cupons_presentes=%.', v_estab_presentes, v_cupons_presentes;
end;
$$;

revoke execute on function private.aplicar_backfill_m1_taxonomia() from public, anon, authenticated;

comment on function private.aplicar_backfill_m1_taxonomia() is
  'MARCO 1: backfill idempotente de estabelecimento_categorias_novas / estabelecimentos.categoria_principal_id / cupons.categoria_nova_id, a partir de docs/taxonomia/depara-v1.json. Chamada por esta migration (efeito real no hospedado) e por supabase/seed.sql (efeito real local, depois que os dados de seed existem) — única fonte da lógica de mapeamento. Vive em `private`: ferramenta de migration/seed, não API de produto.';

-- Efeito imediato: no hospedado, os 6 estabelecimentos e 14 cupons já
-- existem, então esta chamada faz o backfill de verdade agora. Local,
-- neste ponto da migration, nenhum deles existe ainda — NO-OP (ver
-- chamada equivalente no fim de supabase/seed.sql).
select private.aplicar_backfill_m1_taxonomia();
