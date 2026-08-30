-- ============================================================
-- Promofy — MARCO 1 (parte 2/2) · Snapshots imutáveis de categoria em
-- cupom_eventos e cupons_usuario
--
-- Migration NOVA, posterior a 20260830160000 (que já criou o shadow
-- `cupons.categoria_nova_id` e a função idempotente
-- `aplicar_backfill_m1_taxonomia()`). Não edita nenhuma migration
-- anterior.
--
-- Objetivo: capturar, no momento em que um fato histórico nasce
-- (evento de app ou ativação/uso), QUAL categoria folha o cupom tinha
-- NAQUELE momento — e nunca deixar essa captura mudar depois, mesmo
-- que o cupom seja recategorizado no futuro (cutover, correção, o que
-- for). Server-owned: a captura roda em trigger e SEMPRE deriva de
-- `cupons.categoria_nova_id`, incondicionalmente — não "só quando o
-- caller não mandou nada" (a versão original do Marco 1). O caller
-- (RPC, Server Action, PostgREST direto, inclusive service_role da
-- aplicação) não decide o snapshot: qualquer `categoria_id` que ele
-- mande no INSERT é ignorado e sobrescrito pela categoria real do
-- cupom antes de a linha existir. Snapshot é fato derivado, não input.
-- ============================================================

-- ------------------------------------------------------------
-- A. SHADOW de snapshot — NULL por ora, preenchido pelo backfill (F)
-- para os fatos que já existem, e capturado automaticamente (B) para
-- todo fato NOVO a partir de agora.
-- ------------------------------------------------------------
alter table public.cupom_eventos
  add column categoria_id uuid null references public.categorias_novas (id) on delete restrict;

comment on column public.cupom_eventos.categoria_id is
  'MARCO 1 (shadow, STAGING): snapshot da categoria folha do cupom NO MOMENTO do evento. Capturado automaticamente no INSERT (trg_cupom_eventos_capturar_categoria) a partir de cupons.categoria_nova_id — nunca depende do caller informar. Imutável depois de preenchido (trg_cupom_eventos_categoria_imutavel): NULL->UUID é permitido (backfill/transição), UUID->outro UUID nunca. Se o cupom mudar de categoria depois, o evento histórico não muda.';

create index idx_cupom_eventos_categoria on public.cupom_eventos (categoria_id);

alter table public.cupons_usuario
  add column categoria_id uuid null references public.categorias_novas (id) on delete restrict;

comment on column public.cupons_usuario.categoria_id is
  'MARCO 1 (shadow, STAGING): snapshot da categoria folha do cupom NO MOMENTO da ativação/uso. Mesmo contrato de captura automática e imutabilidade de cupom_eventos.categoria_id — ver trg_cupons_usuario_capturar_categoria / trg_cupons_usuario_categoria_imutavel.';

create index idx_cupons_usuario_categoria on public.cupons_usuario (categoria_id);

-- ------------------------------------------------------------
-- B. Captura automática no INSERT — HARDENING FINAL: SEMPRE deriva de
-- cupons.categoria_nova_id do cupom_id envolvido, incondicionalmente.
-- A versão original só preenchia "se new.categoria_id is null" — o que
-- deixava o caller livre para mandar qualquer UUID e ele ser aceito
-- como se fosse o snapshot real. Agora o valor recebido é IGNORADO e
-- SOBRESCRITO: o snapshot nunca é o que o caller mandou, é sempre a
-- categoria real do cupom no instante do INSERT. Se o shadow do cupom
-- ainda estiver NULL (transição — ver MIGRATIONS.md), o snapshot nasce
-- NULL também, mesmo que o caller tenha mandado um UUID — não é erro,
-- é o estado esperado até o cutover terminar de classificar o cupom.
-- ------------------------------------------------------------
create or replace function public.capturar_categoria_nova_evento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  select c.categoria_nova_id into new.categoria_id
    from public.cupons c
   where c.id = new.cupom_id;
  return new;
end;
$$;

revoke execute on function public.capturar_categoria_nova_evento() from public, anon, authenticated;

comment on function public.capturar_categoria_nova_evento() is
  'MARCO 1 (HARDENING FINAL): captura server-owned do snapshot de categoria em cupom_eventos — roda em todo INSERT e SEMPRE deriva de cupons.categoria_nova_id, ignorando/sobrescrevendo qualquer categoria_id que o caller tenha mandado. Snapshot é fato derivado, não input.';

drop trigger if exists trg_cupom_eventos_capturar_categoria on public.cupom_eventos;
create trigger trg_cupom_eventos_capturar_categoria
  before insert on public.cupom_eventos
  for each row execute function public.capturar_categoria_nova_evento();

create or replace function public.capturar_categoria_nova_uso()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  select c.categoria_nova_id into new.categoria_id
    from public.cupons c
   where c.id = new.cupom_id;
  return new;
end;
$$;

revoke execute on function public.capturar_categoria_nova_uso() from public, anon, authenticated;

comment on function public.capturar_categoria_nova_uso() is
  'MARCO 1 (HARDENING FINAL): captura server-owned do snapshot de categoria em cupons_usuario — mesmo contrato de capturar_categoria_nova_evento() (deriva sempre, ignora input do caller).';

drop trigger if exists trg_cupons_usuario_capturar_categoria on public.cupons_usuario;
create trigger trg_cupons_usuario_capturar_categoria
  before insert on public.cupons_usuario
  for each row execute function public.capturar_categoria_nova_uso();

-- ------------------------------------------------------------
-- C. Imutabilidade — depois de preenchido, nunca muda. NULL->UUID
-- (backfill/transição) é o único caminho de escrita permitido depois
-- do INSERT; qualquer UUID->outro-UUID é recusado, para QUALQUER role
-- que execute o UPDATE (o mecanismo de trigger não é gated por grant —
-- mesma lógica já provada em trg_categorias_novas_impedir_reparent,
-- TX-P2D1E).
-- ------------------------------------------------------------
create or replace function public.impedir_mudar_categoria_evento()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.categoria_id is not null and new.categoria_id is distinct from old.categoria_id then
    raise exception 'snapshot_categoria_imutavel'
      using hint = 'cupom_eventos.categoria_id é o snapshot da categoria NO MOMENTO do evento — imutável depois de preenchido. NULL->UUID (backfill/transição) é permitido; UUID->outro UUID nunca.';
  end if;
  return new;
end;
$$;

revoke execute on function public.impedir_mudar_categoria_evento() from public, anon, authenticated;

comment on function public.impedir_mudar_categoria_evento() is
  'MARCO 1: bloqueia incondicionalmente UPDATE que mude cupom_eventos.categoria_id depois de já preenchido. NULL->UUID permitido (backfill).';

drop trigger if exists trg_cupom_eventos_categoria_imutavel on public.cupom_eventos;
create trigger trg_cupom_eventos_categoria_imutavel
  before update of categoria_id on public.cupom_eventos
  for each row execute function public.impedir_mudar_categoria_evento();

create or replace function public.impedir_mudar_categoria_uso()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.categoria_id is not null and new.categoria_id is distinct from old.categoria_id then
    raise exception 'snapshot_categoria_imutavel'
      using hint = 'cupons_usuario.categoria_id é o snapshot da categoria NO MOMENTO da ativação/uso — imutável depois de preenchido. NULL->UUID (backfill/transição) é permitido; UUID->outro UUID nunca.';
  end if;
  return new;
end;
$$;

revoke execute on function public.impedir_mudar_categoria_uso() from public, anon, authenticated;

comment on function public.impedir_mudar_categoria_uso() is
  'MARCO 1: bloqueia incondicionalmente UPDATE que mude cupons_usuario.categoria_id depois de já preenchido. NULL->UUID permitido (backfill).';

drop trigger if exists trg_cupons_usuario_categoria_imutavel on public.cupons_usuario;
create trigger trg_cupons_usuario_categoria_imutavel
  before update of categoria_id on public.cupons_usuario
  for each row execute function public.impedir_mudar_categoria_uso();

-- ------------------------------------------------------------
-- D. Backfill dos fatos JÁ EXISTENTES — idempotente, mesma razão de
-- ser função (não bloco solto) que aplicar_backfill_m1_taxonomia():
-- localmente os fatos (cupom_eventos/cupons_usuario) só existem depois
-- de `seed.sql` rodar; no hospedado já existem quando esta migration
-- aplica. O assert não é por CONTAGEM FIXA (o volume de eventos varia
-- por ambiente e cresce com uso real) — é por ORFANDADE ZERO: nenhum
-- fato cujo cupom já tem categoria_nova_id pode ficar com snapshot
-- NULL depois do backfill.
--
-- HARDENING FINAL: vive em `private`, mesmo motivo de
-- `private.aplicar_backfill_m1_taxonomia()` (migration 160000) — não é
-- API de produto, e `private` não é exposto pelo PostgREST
-- (`schemas = ["public", "graphql_public"]` no config.toml), então a
-- função não é alcançável por RPC para nenhum papel. Também deixou de
-- ser SECURITY DEFINER pelo mesmo motivo daquela: só roda como
-- `postgres` (migration/seed), que já tem acesso direto às tabelas.
-- ------------------------------------------------------------
create or replace function private.aplicar_backfill_m1_snapshots()
returns void
language plpgsql
set search_path to ''
as $$
declare
  v_eventos_orfaos int;
  v_usuario_orfaos int;
  v_eventos_backfillados int;
  v_usuario_backfillados int;
begin
  update public.cupom_eventos ce
     set categoria_id = c.categoria_nova_id
    from public.cupons c
   where ce.cupom_id = c.id
     and ce.categoria_id is null
     and c.categoria_nova_id is not null;
  get diagnostics v_eventos_backfillados = row_count;

  select count(*) into v_eventos_orfaos
    from public.cupom_eventos ce
    join public.cupons c on c.id = ce.cupom_id
   where c.categoria_nova_id is not null
     and ce.categoria_id is null;
  if v_eventos_orfaos <> 0 then
    raise exception 'MARCO1 backfill snapshots: % linha(s) de cupom_eventos ficaram com categoria_id NULL apesar do cupom já ter categoria_nova_id. Abortando.', v_eventos_orfaos;
  end if;

  update public.cupons_usuario cu
     set categoria_id = c.categoria_nova_id
    from public.cupons c
   where cu.cupom_id = c.id
     and cu.categoria_id is null
     and c.categoria_nova_id is not null;
  get diagnostics v_usuario_backfillados = row_count;

  select count(*) into v_usuario_orfaos
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
   where c.categoria_nova_id is not null
     and cu.categoria_id is null;
  if v_usuario_orfaos <> 0 then
    raise exception 'MARCO1 backfill snapshots: % linha(s) de cupons_usuario ficaram com categoria_id NULL apesar do cupom já ter categoria_nova_id. Abortando.', v_usuario_orfaos;
  end if;

  raise notice 'MARCO1 backfill (snapshots): concluído. cupom_eventos backfillados=%, cupons_usuario backfillados=%.', v_eventos_backfillados, v_usuario_backfillados;
end;
$$;

revoke execute on function private.aplicar_backfill_m1_snapshots() from public, anon, authenticated;

comment on function private.aplicar_backfill_m1_snapshots() is
  'MARCO 1: backfill idempotente de cupom_eventos.categoria_id / cupons_usuario.categoria_id para os fatos já existentes, a partir de cupons.categoria_nova_id. Chamada por esta migration (efeito real no hospedado) e por supabase/seed.sql (efeito real local). Vive em `private`: ferramenta de migration/seed, não API de produto.';

-- Efeito imediato: no hospedado, aplicar_backfill_m1_taxonomia() já
-- rodou (migration 160000, aplicada antes desta) e preencheu
-- cupons.categoria_nova_id — este backfill de snapshots já tem o que
-- precisa. Localmente, neste ponto da migration, os fatos ainda não
-- existem (seed.sql roda depois) — os dois UPDATEs acima afetam 0
-- linhas e os asserts de órfão zero passam trivialmente (nada para
-- checar). Ver chamada equivalente no fim de supabase/seed.sql.
select private.aplicar_backfill_m1_snapshots();
