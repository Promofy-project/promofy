-- ============================================================
-- Promofy — Fase 4 · Migration 14: novidades de favoritos (in-app)
--
-- Desenho DERIVADO, sem tabela de notificações: novidade = cupom
-- VISÍVEL de estabelecimento favoritado com publicação posterior
-- (a) ao momento do favorito e (b) ao último "visto" do usuário.
-- Zero fan-out na aprovação; sem estado duplicado; RLS trivial.
-- Push nativa (app fechado) fica para o React Native (Fase 5).
--
-- Timestamp de PUBLICAÇÃO (não de criação): cupom criado antes do
-- favorito mas aprovado depois DEVE notificar; criado_em erraria e
-- atualizado_em é instável (qualquer edit toca).
-- ============================================================

-- publicado_em: quando o cupom passou a ser visível no catálogo.
-- Fora do grant de UPDATE por coluna da Fase 3 (lista explícita — a
-- coluna nova não entra sozinha): cliente não escreve.
alter table public.cupons add column publicado_em timestamptz;

-- Backfill: tudo que já nasceu visível (ou já passou pela moderação)
-- conta como publicado na criação. Mesmo predicado no seed local.
update public.cupons
   set publicado_em = criado_em
 where status not in ('pendente', 'rejeitado');

-- ------------------------------------------------------------
-- aprovar_cupom passa a carimbar publicado_em (recriação da função da
-- Fase 3; CREATE OR REPLACE preserva o ACL existente — revoke/grant da
-- migration 10 seguem valendo). coalesce: re-aprovação não re-notifica.
-- ------------------------------------------------------------
create or replace function public.aprovar_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_row public.cupons%rowtype;
begin
  if not (select private.is_admin()) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  update public.cupons
     set status = 'ativo',
         publicado_em = coalesce(publicado_em, now()),
         atualizado_em = now()
   where id = p_cupom_id and status = 'pendente'
   returning * into v_row;

  if not found then
    -- inexistente OU não estava pendente (já moderado)
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

-- ------------------------------------------------------------
-- Marcador "visto por último" por usuário (1 linha por usuário).
-- ------------------------------------------------------------
create table public.novidades_visto (
  usuario_id uuid primary key references public.profiles (id) on delete cascade,
  visto_em timestamptz not null default now()
);

-- Default privileges dão ALL — revogar; SELECT fica (a RPC invoker de
-- contagem lê esta tabela sob a RLS do chamador). Escrita só via RPC.
revoke all on table public.novidades_visto from anon, authenticated;
grant select on public.novidades_visto to authenticated;

alter table public.novidades_visto enable row level security;

create policy "novidades_visto: usuario le o proprio"
  on public.novidades_visto for select
  to authenticated
  using (usuario_id = (select auth.uid()));

-- ------------------------------------------------------------
-- Leitura das novidades: SECURITY INVOKER — a visibilidade pública dos
-- cupons (estabelecimento ativo etc.) vem da própria RLS; favoritos e
-- visto são do próprio usuário. Predicado num lugar só: badge e página
-- usam esta mesma RPC. "Hoje" BRT inlinado (não depender do EXECUTE
-- default de hoje_brt(), que a Fase 2 revogou de public/anon).
-- ------------------------------------------------------------
create or replace function public.novidades_favoritos()
returns jsonb
language sql stable
security invoker set search_path = ''
as $$
  with hoje as (
    select (now() at time zone 'America/Sao_Paulo')::date as d
  ),
  novos as (
    select c.id, c.publicado_em
    from public.cupons c
    join public.favoritos f
      on f.estabelecimento_id = c.estabelecimento_id
     and f.usuario_id = (select auth.uid())
    left join public.novidades_visto v
      on v.usuario_id = f.usuario_id
    where c.status in ('ativo', 'indisponivel')
      and c.publicado_em is not null
      and c.publicado_em > f.criado_em
      and c.publicado_em > coalesce(v.visto_em, '-infinity'::timestamptz)
      and c.validade_fim >= (select d from hoje)
      and not (
        c.ocultar_ate_inicio
        and c.validade_inicio is not null
        and c.validade_inicio > (select d from hoje)
      )
  )
  select jsonb_build_object(
    'count', (select count(*) from novos),
    'cupom_ids', coalesce(
      (select jsonb_agg(id order by publicado_em desc) from novos),
      '[]'::jsonb
    )
  );
$$;

-- ------------------------------------------------------------
-- Marcar como visto (zera o badge). Posse por auth.uid().
-- ------------------------------------------------------------
create or replace function public.marcar_novidades_vistas()
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

  insert into public.novidades_visto (usuario_id, visto_em)
  values (v_uid, now())
  on conflict (usuario_id) do update set visto_em = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function
  public.novidades_favoritos(),
  public.marcar_novidades_vistas()
from public, anon;

grant execute on function
  public.novidades_favoritos(),
  public.marcar_novidades_vistas()
to authenticated;
