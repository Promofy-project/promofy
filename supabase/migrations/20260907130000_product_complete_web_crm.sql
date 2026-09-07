-- ============================================================
-- Promofy — PRODUCT-COMPLETE-WEB / CRM-01
--
-- CRM do portal: clientes = usuários com ≥1 cupons_usuario.status =
-- 'validado' em cupons do estabelecimento do chamador (owner_id =
-- auth.uid()). Ativação sem validação (ativo/expirado) NÃO cria relação.
--
-- Sem tabela de clientes desnormalizada. E-mail só via SECURITY DEFINER
-- (auth.users). CPF nunca sai destas RPCs. Auditoria de exportação sem PII.
--
-- NÃO hospedada neste WP — local only até autorização de deploy.
-- ============================================================

-- Índice parcial: listagens CRM filtram por status = 'validado' e juntam
-- cupom_id → estabelecimentos. Cobre o caminho hot das RPCs abaixo.
create index if not exists idx_cupons_usuario_validado_cupom
  on public.cupons_usuario (cupom_id, usuario_id, validado_em desc)
  where status = 'validado';

-- ------------------------------------------------------------
-- Auditoria de exportações — só metadados, sem PII, sem blob
-- ------------------------------------------------------------
create table private.crm_exportacoes (
  id                bigint generated always as identity primary key,
  estabelecimento_id text not null references public.estabelecimentos(id),
  ator_id           uuid not null references public.profiles(id),
  formato           text not null check (formato in ('xlsx', 'pdf')),
  linhas_clientes   int not null check (linhas_clientes >= 0),
  linhas_historico  int not null check (linhas_historico >= 0),
  filtros           jsonb not null default '{}'::jsonb,
  criado_em         timestamptz not null default now()
);

create index idx_crm_exportacoes_estab_criado
  on private.crm_exportacoes (estabelecimento_id, criado_em desc);

revoke all on table private.crm_exportacoes from public, anon, authenticated;

comment on table private.crm_exportacoes is
  'CRM-01: auditoria de exportacoes do portal. Metadados apenas — sem PII, sem arquivo.';

-- ------------------------------------------------------------
-- Helper: estabelecimento do lojista autenticado (posse pela sessão).
-- `order by id` é determinístico quando o seed liga vários estabs ao
-- mesmo owner (FIX-02: e1+e3..e6). Não aceita estabelecimento_id do browser.
-- ------------------------------------------------------------
create or replace function private.crm_estab_da_sessao()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
    from public.estabelecimentos e
   where e.owner_id = (select auth.uid())
   order by e.id
   limit 1;
$$;

revoke execute on function private.crm_estab_da_sessao() from public, anon, authenticated;

-- ------------------------------------------------------------
-- crm_clientes — listagem paginada + resumo
-- ------------------------------------------------------------
create or replace function public.crm_clientes(
  p_q text default null,
  p_filtro text default 'todos',
  p_pagina int default 1,
  p_por_pagina int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_estab   text;
  v_filtro  text := coalesce(nullif(trim(p_filtro), ''), 'todos');
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_pagina  int := greatest(coalesce(p_pagina, 1), 1);
  v_por     int := least(greatest(coalesce(p_por_pagina, 20), 1), 100);
  v_offset  int;
  v_total   int;
  v_resumo  jsonb;
  v_lista   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  v_estab := private.crm_estab_da_sessao();
  if v_estab is null then
    return jsonb_build_object(
      'ok', true,
      'estabelecimento_id', null,
      'total', 0,
      'pagina', v_pagina,
      'por_pagina', v_por,
      'resumo', jsonb_build_object(
        'clientes_unicos', 0,
        'novos_30d', 0,
        'recorrentes', 0,
        'resgates_confirmados', 0
      ),
      'clientes', '[]'::jsonb
    );
  end if;

  if v_filtro not in ('todos', 'recentes', 'recorrentes', 'periodo_90d') then
    v_filtro := 'todos';
  end if;

  -- Busca só com ≥2 chars; string curta = sem filtro de texto.
  if v_q is not null and char_length(v_q) < 2 then
    v_q := null;
  end if;

  v_offset := (v_pagina - 1) * v_por;

  -- Agregação base: só validado neste estabelecimento.
  with base as (
    select
      cu.usuario_id,
      count(*)::int as total_resgates,
      min(cu.validado_em) as primeiro_resgate,
      max(cu.validado_em) as ultimo_resgate
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
    where c.estabelecimento_id = v_estab
      and cu.status = 'validado'
      and cu.validado_em is not null
    group by cu.usuario_id
  ),
  enriquecido as (
    select
      b.usuario_id,
      b.total_resgates,
      b.primeiro_resgate,
      b.ultimo_resgate,
      p.nome,
      p.telefone,
      p.nascimento,
      u.email
    from base b
    join public.profiles p on p.id = b.usuario_id
    left join auth.users u on u.id = b.usuario_id
  ),
  filtrado as (
    select *
    from enriquecido e
    where
      case v_filtro
        when 'recentes' then e.ultimo_resgate >= (now() - interval '30 days')
        when 'recorrentes' then e.total_resgates >= 2
        when 'periodo_90d' then e.ultimo_resgate >= (now() - interval '90 days')
        else true
      end
      and (
        v_q is null
        or e.nome ilike '%' || v_q || '%'
        or coalesce(e.email, '') ilike '%' || v_q || '%'
        or coalesce(e.telefone, '') ilike '%' || v_q || '%'
      )
  ),
  contagem as (
    select count(*)::int as total from filtrado
  ),
  resumo_global as (
    -- Resumo do estabelecimento inteiro (não do filtro de página),
    -- para KPIs honestos no topo. Filtro de busca/aba não inventa números.
    select
      (select count(*)::int from base) as clientes_unicos,
      (select count(*)::int from base b
        where b.primeiro_resgate >= (now() - interval '30 days')) as novos_30d,
      (select count(*)::int from base b where b.total_resgates >= 2) as recorrentes,
      (select count(*)::int
         from public.cupons_usuario cu
         join public.cupons c on c.id = cu.cupom_id
        where c.estabelecimento_id = v_estab
          and cu.status = 'validado') as resgates_confirmados
  ),
  pagina as (
    select *
    from filtrado
    order by ultimo_resgate desc nulls last, usuario_id
    offset v_offset
    limit v_por
  )
  select
    (select total from contagem),
    (select jsonb_build_object(
       'clientes_unicos', clientes_unicos,
       'novos_30d', novos_30d,
       'recorrentes', recorrentes,
       'resgates_confirmados', resgates_confirmados
     ) from resumo_global),
    coalesce(
      (select jsonb_agg(
         jsonb_build_object(
           'usuario_id', p.usuario_id,
           'nome', nullif(trim(coalesce(p.nome, '')), ''),
           'email', nullif(trim(coalesce(p.email, '')), ''),
           'telefone', nullif(trim(coalesce(p.telefone, '')), ''),
           'nascimento', p.nascimento,
           'total_resgates', p.total_resgates,
           'primeiro_resgate', p.primeiro_resgate,
           'ultimo_resgate', p.ultimo_resgate
         )
         order by p.ultimo_resgate desc nulls last, p.usuario_id
       )
       from pagina p),
      '[]'::jsonb
    )
  into v_total, v_resumo, v_lista;

  return jsonb_build_object(
    'ok', true,
    'estabelecimento_id', v_estab,
    'total', coalesce(v_total, 0),
    'pagina', v_pagina,
    'por_pagina', v_por,
    'resumo', coalesce(v_resumo, jsonb_build_object(
      'clientes_unicos', 0,
      'novos_30d', 0,
      'recorrentes', 0,
      'resgates_confirmados', 0
    )),
    'clientes', coalesce(v_lista, '[]'::jsonb)
  );
end;
$$;

comment on function public.crm_clientes(text, text, int, int) is
  'CRM-01: lista clientes com resgate validado no estabelecimento do chamador. Sem CPF.';

revoke execute on function public.crm_clientes(text, text, int, int) from public, anon;
grant  execute on function public.crm_clientes(text, text, int, int) to authenticated;

-- ------------------------------------------------------------
-- crm_cliente_detalhe — ficha + histórico de resgates
-- ------------------------------------------------------------
create or replace function public.crm_cliente_detalhe(p_usuario_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estab  text;
  v_agg    record;
  v_email  text;
  v_hist   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  if p_usuario_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  v_estab := private.crm_estab_da_sessao();
  if v_estab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_estabelecimento');
  end if;

  select
    count(*)::int as total_resgates,
    min(cu.validado_em) as primeiro_resgate,
    max(cu.validado_em) as ultimo_resgate
  into v_agg
  from public.cupons_usuario cu
  join public.cupons c on c.id = cu.cupom_id
  where c.estabelecimento_id = v_estab
    and cu.status = 'validado'
    and cu.validado_em is not null
    and cu.usuario_id = p_usuario_id;

  if v_agg.total_resgates is null or v_agg.total_resgates < 1 then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  select u.email into v_email
    from auth.users u
   where u.id = p_usuario_id;

  select coalesce(jsonb_agg(x order by x->>'validado_em' desc), '[]'::jsonb)
    into v_hist
  from (
    select jsonb_build_object(
             'cupom_id', c.id,
             'titulo', c.titulo,
             'beneficio', c.beneficio,
             'economia', c.economia,
             'economia_variavel', c.economia_variavel,
             'validado_em', cu.validado_em,
             'status', cu.status,
             'nps', cu.nps
           ) as x
      from public.cupons_usuario cu
      join public.cupons c on c.id = cu.cupom_id
     where c.estabelecimento_id = v_estab
       and cu.usuario_id = p_usuario_id
       and cu.status = 'validado'
       and cu.validado_em is not null
     order by cu.validado_em desc
  ) t;

  return jsonb_build_object(
    'ok', true,
    'estabelecimento_id', v_estab,
    'cliente', (
      select jsonb_build_object(
        'usuario_id', p.id,
        'nome', nullif(trim(coalesce(p.nome, '')), ''),
        'email', nullif(trim(coalesce(v_email, '')), ''),
        'telefone', nullif(trim(coalesce(p.telefone, '')), ''),
        'nascimento', p.nascimento,
        'total_resgates', v_agg.total_resgates,
        'primeiro_resgate', v_agg.primeiro_resgate,
        'ultimo_resgate', v_agg.ultimo_resgate
      )
      from public.profiles p
      where p.id = p_usuario_id
    ),
    'historico', coalesce(v_hist, '[]'::jsonb)
  );
end;
$$;

comment on function public.crm_cliente_detalhe(uuid) is
  'CRM-01: detalhe do cliente com historico de resgates no estab do chamador. Sem CPF.';

revoke execute on function public.crm_cliente_detalhe(uuid) from public, anon;
grant  execute on function public.crm_cliente_detalhe(uuid) to authenticated;

-- ------------------------------------------------------------
-- crm_export_dados — clientes + histórico para exportação (cap 5000)
-- ------------------------------------------------------------
create or replace function public.crm_export_dados(
  p_q text default null,
  p_filtro text default 'todos'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_estab   text;
  v_filtro  text := coalesce(nullif(trim(p_filtro), ''), 'todos');
  v_q       text := nullif(trim(coalesce(p_q, '')), '');
  v_cap     int := 5000;
  v_clientes jsonb;
  v_hist     jsonb;
  v_ids      uuid[];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  v_estab := private.crm_estab_da_sessao();
  if v_estab is null then
    return jsonb_build_object(
      'ok', true,
      'estabelecimento_id', null,
      'clientes', '[]'::jsonb,
      'historico', '[]'::jsonb
    );
  end if;

  if v_filtro not in ('todos', 'recentes', 'recorrentes', 'periodo_90d') then
    v_filtro := 'todos';
  end if;
  if v_q is not null and char_length(v_q) < 2 then
    v_q := null;
  end if;

  with base as (
    select
      cu.usuario_id,
      count(*)::int as total_resgates,
      min(cu.validado_em) as primeiro_resgate,
      max(cu.validado_em) as ultimo_resgate
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
    where c.estabelecimento_id = v_estab
      and cu.status = 'validado'
      and cu.validado_em is not null
    group by cu.usuario_id
  ),
  enriquecido as (
    select
      b.usuario_id,
      b.total_resgates,
      b.primeiro_resgate,
      b.ultimo_resgate,
      p.nome,
      p.telefone,
      p.nascimento,
      u.email
    from base b
    join public.profiles p on p.id = b.usuario_id
    left join auth.users u on u.id = b.usuario_id
  ),
  filtrado as (
    select *
    from enriquecido e
    where
      case v_filtro
        when 'recentes' then e.ultimo_resgate >= (now() - interval '30 days')
        when 'recorrentes' then e.total_resgates >= 2
        when 'periodo_90d' then e.ultimo_resgate >= (now() - interval '90 days')
        else true
      end
      and (
        v_q is null
        or e.nome ilike '%' || v_q || '%'
        or coalesce(e.email, '') ilike '%' || v_q || '%'
        or coalesce(e.telefone, '') ilike '%' || v_q || '%'
      )
    order by e.ultimo_resgate desc nulls last, e.usuario_id
    limit v_cap
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'usuario_id', f.usuario_id,
          'nome', nullif(trim(coalesce(f.nome, '')), ''),
          'email', nullif(trim(coalesce(f.email, '')), ''),
          'telefone', nullif(trim(coalesce(f.telefone, '')), ''),
          'nascimento', f.nascimento,
          'total_resgates', f.total_resgates,
          'primeiro_resgate', f.primeiro_resgate,
          'ultimo_resgate', f.ultimo_resgate
        )
        order by f.ultimo_resgate desc nulls last, f.usuario_id
      ),
      '[]'::jsonb
    ),
    coalesce(array_agg(f.usuario_id), '{}')
  into v_clientes, v_ids
  from filtrado f;

  select coalesce(jsonb_agg(x order by x->>'validado_em' desc), '[]'::jsonb)
    into v_hist
  from (
    select jsonb_build_object(
             'usuario_id', cu.usuario_id,
             'nome', nullif(trim(coalesce(p.nome, '')), ''),
             'cupom_id', c.id,
             'titulo', c.titulo,
             'beneficio', c.beneficio,
             'economia', c.economia,
             'economia_variavel', c.economia_variavel,
             'validado_em', cu.validado_em,
             'status', cu.status,
             'nps', cu.nps
           ) as x
      from public.cupons_usuario cu
      join public.cupons c on c.id = cu.cupom_id
      join public.profiles p on p.id = cu.usuario_id
     where c.estabelecimento_id = v_estab
       and cu.status = 'validado'
       and cu.validado_em is not null
       and cu.usuario_id = any(v_ids)
     order by cu.validado_em desc
     limit v_cap
  ) t;

  return jsonb_build_object(
    'ok', true,
    'estabelecimento_id', v_estab,
    'clientes', coalesce(v_clientes, '[]'::jsonb),
    'historico', coalesce(v_hist, '[]'::jsonb)
  );
end;
$$;

comment on function public.crm_export_dados(text, text) is
  'CRM-01: dados para exportacao xlsx/pdf. Cap 5000. Sem CPF. Posse via sessao.';

revoke execute on function public.crm_export_dados(text, text) from public, anon;
grant  execute on function public.crm_export_dados(text, text) to authenticated;

-- ------------------------------------------------------------
-- crm_registrar_exportacao — auditoria sem PII
-- ------------------------------------------------------------
create or replace function public.crm_registrar_exportacao(
  p_formato text,
  p_linhas_clientes int,
  p_linhas_historico int,
  p_filtros jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estab  text;
  v_fmt    text := lower(trim(coalesce(p_formato, '')));
  v_id     bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  v_estab := private.crm_estab_da_sessao();
  if v_estab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_estabelecimento');
  end if;

  if v_fmt not in ('xlsx', 'pdf') then
    return jsonb_build_object('ok', false, 'motivo', 'formato_invalido');
  end if;

  insert into private.crm_exportacoes (
    estabelecimento_id, ator_id, formato,
    linhas_clientes, linhas_historico, filtros
  ) values (
    v_estab,
    v_uid,
    v_fmt,
    greatest(coalesce(p_linhas_clientes, 0), 0),
    greatest(coalesce(p_linhas_historico, 0), 0),
    coalesce(p_filtros, '{}'::jsonb)
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

comment on function public.crm_registrar_exportacao(text, int, int, jsonb) is
  'CRM-01: registra exportacao (metadados). Sem PII na linha de auditoria.';

revoke execute on function public.crm_registrar_exportacao(text, int, int, jsonb)
  from public, anon;
grant  execute on function public.crm_registrar_exportacao(text, int, int, jsonb)
  to authenticated;
