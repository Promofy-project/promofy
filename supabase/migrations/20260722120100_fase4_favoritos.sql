-- ============================================================
-- Promofy — Fase 4 · Migration 13: favoritos de estabelecimento
--
-- Usuário favorita ESTABELECIMENTOS (não cupons). criado_em é usado
-- pelo Bloco D (novidades): cupom publicado DEPOIS do favorito conta
-- como novidade — por isso a escrita direta é revogada e a mutação é
-- exclusiva via RPC (padrão cupons_usuario da Fase 2): cliente não
-- forja criado_em nem favorita em nome de outro usuário.
-- ============================================================

create table public.favoritos (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, estabelecimento_id)
);

-- PK cobre buscas por usuário; índice para o caminho inverso
create index idx_favoritos_estabelecimento
  on public.favoritos (estabelecimento_id);

-- Default privileges dão ALL — revogar tudo; leitura direta sob RLS
-- (hidratação do provider e RPC invoker de novidades dependem do SELECT).
revoke all on table public.favoritos from anon, authenticated;
grant select on public.favoritos to authenticated;

alter table public.favoritos enable row level security;

create policy "favoritos: usuario le os proprios"
  on public.favoritos for select
  to authenticated
  using (usuario_id = (select auth.uid()));

-- ------------------------------------------------------------
-- RPCs — único caminho de escrita. Posse por auth.uid(); idempotentes.
-- ------------------------------------------------------------
create or replace function public.favoritar_estabelecimento(p_est_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  -- só estabelecimento ativo entra nos favoritos (catálogo visível)
  if not exists (
    select 1 from public.estabelecimentos e
    where e.id = p_est_id and e.status = 'ativo'
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  insert into public.favoritos (usuario_id, estabelecimento_id)
  values (v_uid, p_est_id)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'favorito', true);
end;
$$;

create or replace function public.desfavoritar_estabelecimento(p_est_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  delete from public.favoritos
  where usuario_id = v_uid and estabelecimento_id = p_est_id;

  return jsonb_build_object('ok', true, 'favorito', false);
end;
$$;

revoke execute on function
  public.favoritar_estabelecimento(text),
  public.desfavoritar_estabelecimento(text)
from public, anon;

grant execute on function
  public.favoritar_estabelecimento(text),
  public.desfavoritar_estabelecimento(text)
to authenticated;
