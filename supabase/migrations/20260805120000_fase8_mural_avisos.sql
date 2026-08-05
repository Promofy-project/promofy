-- ============================================================
-- Promofy — Fase 8 · Migration 24: mural de recados (M1)
--
-- O QUE EXISTIA: nada. O `/admin/avisos` é 100% mock — dois literais em
-- `React.useState`, "Enviar aviso" só faz `setAvisos(...)`, e recarregar a
-- página zera tudo. O lojista nunca recebeu recado nenhum.
--
-- DESTINATÁRIOS EM TABELA DE JUNÇÃO, NÃO jsonb
--
-- O predicado de RLS vira `para_todos or exists(...)`, indexável e trivial de
-- ler. O precedente da casa para "N de um lado" é junção
-- (`estabelecimento_categorias`, Fase 4). O jsonb sem CHECK da Fase 6 foi
-- escolhido por outro motivo — evitar que dado sujo virasse EXCEÇÃO dentro de
-- `security definer` — e esse motivo não se aplica aqui: aqui o dado é uma FK.
--
-- QUEM ESCREVE O QUÊ
--
-- Admin escreve avisos e destinatários. O lojista só LÊ o que é dele, e a
-- marcação de lido vai por RPC `security definer` — mesmo padrão de
-- `favoritos` (Fase 4): sem isso o lojista forjaria `lido_em` ou marcaria em
-- nome de outro estabelecimento.
-- ============================================================

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------
create table public.avisos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(btrim(titulo)) > 0),
  corpo         text not null check (length(btrim(corpo)) > 0),
  -- `para_todos` é a forma canônica de "broadcast". Com ela, a lista de
  -- destinatários fica VAZIA — não se materializa uma linha por
  -- estabelecimento, que envelheceria a cada novo parceiro cadastrado.
  para_todos    boolean not null default false,
  criado_por    uuid references public.profiles (id) on delete set null,
  publicado_em  timestamptz not null default now()
);

comment on table public.avisos is
  'Recados do admin para os estabelecimentos (Fase 8/M1). para_todos = broadcast; senão, ver avisos_destinatarios.';

create table public.avisos_destinatarios (
  aviso_id           uuid not null references public.avisos (id) on delete cascade,
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  primary key (aviso_id, estabelecimento_id)
);

create table public.avisos_lidos (
  aviso_id           uuid not null references public.avisos (id) on delete cascade,
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  lido_em            timestamptz not null default now(),
  primary key (aviso_id, estabelecimento_id)
);

-- A PK cobre (aviso_id, estabelecimento_id); estes índices cobrem o caminho
-- INVERSO, que é o do lojista: "meus avisos" e "o que eu já li".
create index avisos_destinatarios_estab_idx on public.avisos_destinatarios (estabelecimento_id);
create index avisos_lidos_estab_idx         on public.avisos_lidos (estabelecimento_id);
create index avisos_publicado_em_idx        on public.avisos (publicado_em desc);

-- ------------------------------------------------------------
-- HELPER: "este aviso é para mim?"
--
-- `security definer` porque precisa enxergar `avisos_destinatarios` sem
-- depender da RLS daquela tabela — senão a policy de `avisos` dependeria da
-- policy de outra tabela, e a ordem de avaliação vira armadilha.
-- ------------------------------------------------------------
create or replace function private.aviso_visivel(p_aviso_id uuid)
returns boolean
language sql
security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.avisos a
    where a.id = p_aviso_id
      and (
        a.para_todos
        or exists (
          select 1
            from public.avisos_destinatarios d
            join public.estabelecimentos e on e.id = d.estabelecimento_id
           where d.aviso_id = a.id
             and e.owner_id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on function private.aviso_visivel(uuid) from public, anon;
grant  execute on function private.aviso_visivel(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.avisos               enable row level security;
alter table public.avisos_destinatarios enable row level security;
alter table public.avisos_lidos         enable row level security;

-- Escrita direta revogada: quem publica é o admin (policy abaixo), e quem
-- marca lido é a RPC. `avisos_lidos` não recebe grant de escrita NENHUM —
-- nem para o dono — para que `lido_em` não seja forjável.
revoke all on public.avisos, public.avisos_destinatarios, public.avisos_lidos
  from anon, authenticated;
grant select on public.avisos, public.avisos_destinatarios, public.avisos_lidos
  to authenticated;
grant insert, update, delete on public.avisos, public.avisos_destinatarios
  to authenticated;  -- filtrado pelas policies de admin abaixo

create policy "avisos: admin gerencia"
  on public.avisos for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "avisos: lojista le os seus"
  on public.avisos for select to authenticated
  using ((select private.aviso_visivel(id)));

create policy "avisos_destinatarios: admin gerencia"
  on public.avisos_destinatarios for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- O lojista lê a junção só das linhas que apontam para ELE. Sem isto ele
-- descobriria, a partir de um aviso `para_todos`, quais outros
-- estabelecimentos existem e recebem o quê.
create policy "avisos_destinatarios: lojista le os seus"
  on public.avisos_destinatarios for select to authenticated
  using ((select private.owns_estabelecimento(estabelecimento_id)));

create policy "avisos_lidos: dono le o proprio"
  on public.avisos_lidos for select to authenticated
  using (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())   -- o admin precisa contar quem leu
  );

-- ------------------------------------------------------------
-- RPC: marcar como lido (único caminho de escrita)
-- ------------------------------------------------------------
create or replace function public.marcar_aviso_lido(p_aviso_id uuid)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_estab text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select e.id into v_estab
    from public.estabelecimentos e
   where e.owner_id = v_uid
   limit 1;
  if v_estab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_estabelecimento');
  end if;

  -- Marcar como lido um aviso que não é seu seria escrever uma linha para um
  -- aviso que você nem pode ler. O mesmo predicado da policy de leitura.
  if not (select private.aviso_visivel(p_aviso_id)) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  insert into public.avisos_lidos (aviso_id, estabelecimento_id)
  values (p_aviso_id, v_estab)
  on conflict (aviso_id, estabelecimento_id) do nothing;  -- idempotente

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.marcar_aviso_lido(uuid) is
  'Fase 8/M1: marca um aviso como lido pelo estabelecimento do chamador. Idempotente. Unico caminho de escrita em avisos_lidos.';

revoke execute on function public.marcar_aviso_lido(uuid) from public, anon;
grant  execute on function public.marcar_aviso_lido(uuid) to authenticated;

-- ------------------------------------------------------------
-- RPC: contagem de não-lidos (o badge)
--
-- `security invoker` de propósito: roda sob a RLS do chamador, então a própria
-- policy de leitura já filtra o que ele pode ver. Não precisa de definer, e
-- não ter definer aqui é uma superfície a menos.
-- ------------------------------------------------------------
create or replace function public.avisos_nao_lidos()
returns integer
language sql
security invoker stable set search_path = ''
as $$
  select count(*)::int
    from public.avisos a
   where not exists (
     select 1 from public.avisos_lidos l
      where l.aviso_id = a.id
        and (select private.owns_estabelecimento(l.estabelecimento_id))
   );
$$;

comment on function public.avisos_nao_lidos() is
  'Fase 8/M1: quantos avisos visiveis ao chamador ainda nao foram lidos. security invoker — a RLS de avisos ja filtra.';

revoke execute on function public.avisos_nao_lidos() from public, anon;
grant  execute on function public.avisos_nao_lidos() to authenticated;
