-- ============================================================
-- Promofy — CLIENT-RETURNS-02 · descoberta do consumidor
--
-- Aditivo. Janela schema-novo + código-antigo: colunas novas têm
-- default (tipo_promocao='desconto', bairro='', lat/lng null,
-- valor_compra_minimo null). Código antigo ignora as colunas.
--
-- NÃO edita 20260902120000 nem 20260902130000.
-- ============================================================

-- 1. Tipo de promoção explícito (não se infere de título/regex)
create type public.tipo_promocao as enum (
  'desconto',
  'leve_mais_pague_menos',
  'frete_gratis'
);

alter table public.cupons
  add column if not exists tipo_promocao public.tipo_promocao not null default 'desconto',
  add column if not exists valor_compra_minimo numeric(10,2);

alter table public.cupons
  drop constraint if exists cupons_valor_compra_minimo_ck;
alter table public.cupons
  add constraint cupons_valor_compra_minimo_ck
  check (valor_compra_minimo is null or valor_compra_minimo >= 0);

comment on column public.cupons.tipo_promocao is
  'CLIENT-RETURNS-02: tipo comercial explícito. Default desconto é o tipo genérico do schema, não adivinhação de título.';
comment on column public.cupons.valor_compra_minimo is
  'CLIENT-RETURNS-02: piso de compra em R$. NULL = sem mínimo.';

grant update (tipo_promocao, valor_compra_minimo) on public.cupons to authenticated;

-- 2. Geo pública do estabelecimento (consumidor NÃO persiste lat/lng)
alter table public.estabelecimentos
  add column if not exists bairro text not null default '',
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.estabelecimentos
  drop constraint if exists estabelecimentos_latitude_ck;
alter table public.estabelecimentos
  add constraint estabelecimentos_latitude_ck
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.estabelecimentos
  drop constraint if exists estabelecimentos_longitude_ck;
alter table public.estabelecimentos
  add constraint estabelecimentos_longitude_ck
  check (longitude is null or (longitude >= -180 and longitude <= 180));

alter table public.estabelecimentos
  drop constraint if exists estabelecimentos_geo_par_ck;
alter table public.estabelecimentos
  add constraint estabelecimentos_geo_par_ck
  check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  );

comment on column public.estabelecimentos.bairro is
  'CLIENT-RETURNS-02: bairro público. Vazio = não informado. Nunca inventado em runtime.';
comment on column public.estabelecimentos.latitude is
  'CLIENT-RETURNS-02: lat pública do ponto de venda. NULL se incompleto. Paridade com longitude.';
comment on column public.estabelecimentos.longitude is
  'CLIENT-RETURNS-02: lng pública do ponto de venda. NULL se incompleto. Paridade com latitude.';

grant update (bairro, latitude, longitude) on public.estabelecimentos to authenticated;

create index if not exists idx_estabelecimentos_cidade_bairro
  on public.estabelecimentos (cidade, bairro);

-- 3. Preferências (tokens canônicos, 1 linha por usuário)
create table if not exists public.preferencias_usuario (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  objetivos text[] not null default '{}',
  segmentos text[] not null default '{}',
  categorias text[] not null default '{}',
  locais jsonb not null default '[]'::jsonb,
  estilo_consumo text[] not null default '{}',
  dias text[] not null default '{}',
  beneficio_preferido text[] not null default '{}',
  gamificacao text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

alter table public.preferencias_usuario enable row level security;

revoke all on table public.preferencias_usuario from public, anon;
grant select, insert, update on table public.preferencias_usuario to authenticated;

create policy "preferencias: dono le"
  on public.preferencias_usuario for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "preferencias: dono insere"
  on public.preferencias_usuario for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "preferencias: dono atualiza"
  on public.preferencias_usuario for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- 4. Consentimento versionável (finalidade + versão + timestamps)
create table if not exists public.consentimentos_usuario (
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  finalidade text not null,
  versao text not null,
  concedido_em timestamptz,
  revogado_em timestamptz,
  primary key (usuario_id, finalidade),
  constraint consentimentos_finalidade_ck check (char_length(finalidade) between 1 and 64),
  constraint consentimentos_versao_ck check (char_length(versao) between 1 and 16)
);

alter table public.consentimentos_usuario enable row level security;

revoke all on table public.consentimentos_usuario from public, anon;
grant select, insert, update on table public.consentimentos_usuario to authenticated;

create policy "consentimentos: dono le"
  on public.consentimentos_usuario for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "consentimentos: dono insere"
  on public.consentimentos_usuario for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "consentimentos: dono atualiza"
  on public.consentimentos_usuario for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- 5. Aceite versionado de documento (trilha; sem update/delete)
create table if not exists public.aceites_documento (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  documento text not null,
  versao text not null,
  aceito_em timestamptz not null default now(),
  unique (usuario_id, documento, versao),
  constraint aceites_documento_ck check (char_length(documento) between 1 and 64),
  constraint aceites_versao_ck check (char_length(versao) between 1 and 16)
);

alter table public.aceites_documento enable row level security;

revoke all on table public.aceites_documento from public, anon;
grant select, insert on table public.aceites_documento to authenticated;

create policy "aceites: dono le"
  on public.aceites_documento for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "aceites: dono insere"
  on public.aceites_documento for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy "aceites: admin le todos"
  on public.aceites_documento for select to authenticated
  using ((select private.is_admin()));

-- 6. Signup grava aceite só quando o metadata declara aceite
--    (a Action exige o checkbox ANTES do signUp).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  role_claim text := new.raw_app_meta_data->>'role';
  nasc text := new.raw_user_meta_data->>'nascimento';
  aceito text := coalesce(new.raw_user_meta_data->>'aceito_termos', '');
  doc text := coalesce(nullif(new.raw_user_meta_data->>'termos_documento', ''), 'termos_consumidor');
  ver text := coalesce(nullif(new.raw_user_meta_data->>'termos_versao', ''), '2.0');
  papel public.papel_usuario;
begin
  papel := case when role_claim in ('consumidor','lojista','admin')
                then role_claim::public.papel_usuario
                else 'consumidor'::public.papel_usuario end;
  insert into public.profiles (id, role, nome, cidade, cpf, telefone, nascimento)
  values (
    new.id,
    papel,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    new.raw_user_meta_data->>'cidade',
    new.raw_user_meta_data->>'cpf',
    new.raw_user_meta_data->>'telefone',
    case when nasc ~ '^\d{4}-\d{2}-\d{2}$' then nasc::date else null end
  );
  if papel = 'consumidor' and aceito in ('1', 'true', 'sim') then
    insert into public.aceites_documento (usuario_id, documento, versao)
    values (new.id, doc, ver)
    on conflict (usuario_id, documento, versao) do nothing;
  end if;
  return new;
end;
$$;

-- 7. Agregados de descoberta (batch, sem N+1, sem vazar usuario_id)
create index if not exists idx_cupom_eventos_criado_tipo
  on public.cupom_eventos (criado_em, tipo);

create or replace function public.sinais_descoberta(p_desde timestamptz)
returns table(cupom_id text, validacoes bigint, ativacoes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.cupom_id,
         count(*) filter (where e.tipo = 'validacao')::bigint as validacoes,
         count(*) filter (where e.tipo = 'ativacao')::bigint as ativacoes
    from public.cupom_eventos e
    join public.cupons c on c.id = e.cupom_id
    join public.estabelecimentos est on est.id = c.estabelecimento_id
   where e.criado_em >= p_desde
     and e.tipo in ('validacao', 'ativacao')
     and c.status in ('ativo', 'indisponivel')
     and est.status = 'ativo'
   group by e.cupom_id;
$$;

revoke execute on function public.sinais_descoberta(timestamptz) from public;
grant execute on function public.sinais_descoberta(timestamptz) to anon, authenticated;

comment on function public.sinais_descoberta(timestamptz) is
  'CLIENT-RETURNS-02: contagem batch de validacao/ativacao desde p_desde, só catálogo visível. Sem usuario_id.';

create or replace function public.estoque_cupons()
returns table(cupom_id text, limite_total int, consumidos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id,
         c.limite_total,
         (
           select count(*)::bigint
             from public.cupons_usuario u
            where u.cupom_id = c.id
              and (
                u.status = 'validado'
                or (u.status = 'ativo' and u.expira_em > now())
              )
         ) as consumidos
    from public.cupons c
    join public.estabelecimentos est on est.id = c.estabelecimento_id
   where c.status in ('ativo', 'indisponivel')
     and est.status = 'ativo'
     and c.limite_total is not null;
$$;

revoke execute on function public.estoque_cupons() from public;
grant execute on function public.estoque_cupons() to anon, authenticated;

comment on function public.estoque_cupons() is
  'CLIENT-RETURNS-02: estoque batch dos cupons COM limite. Ilimitado não aparece — nunca vira escassez.';

-- 8. checar_edicao_cupom — mesma matriz M2 + tipo/mínimo
create or replace function public.checar_edicao_cupom()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_validacoes int;
  v_ativas int;
  v_max_por_usuario int;
  v_ultima_expira timestamptz;
  v_material boolean := false;
  v_mudou_algo boolean := false;
  v_dias_velho jsonb;
  v_dias_novo jsonb;
  v_ini_velho time;
  v_fim_velho time;
  v_ini_novo time;
  v_fim_novo time;
begin
  if v_uid is null or (select private.is_admin()) then
    return new;
  end if;

  v_mudou_algo :=
        new.titulo              is distinct from old.titulo
     or new.beneficio           is distinct from old.beneficio
     or new.categoria_id        is distinct from old.categoria_id
     or new.categoria_nova_id   is distinct from old.categoria_nova_id
     or new.economia            is distinct from old.economia
     or new.economia_variavel   is distinct from old.economia_variavel
     or new.taxas               is distinct from old.taxas
     or new.formas_consumo      is distinct from old.formas_consumo
     or new.tipo_promocao       is distinct from old.tipo_promocao
     or new.valor_compra_minimo is distinct from old.valor_compra_minimo
     or new.horarios            is distinct from old.horarios
     or new.regras              is distinct from old.regras
     or new.imagem              is distinct from old.imagem
     or new.validade_inicio     is distinct from old.validade_inicio
     or new.validade_fim        is distinct from old.validade_fim
     or new.ocultar_ate_inicio  is distinct from old.ocultar_ate_inicio
     or new.prazo_ativacao_horas is distinct from old.prazo_ativacao_horas
     or new.limite_por_usuario  is distinct from old.limite_por_usuario
     or new.limite_total        is distinct from old.limite_total;

  if not v_mudou_algo then
    return new;
  end if;

  select count(*) filter (where status = 'validado'),
         count(*) filter (where status = 'ativo' and expira_em > now()),
         max(expira_em) filter (where status = 'ativo' and expira_em > now())
    into v_validacoes, v_ativas, v_ultima_expira
    from public.cupons_usuario
   where cupom_id = old.id;

  if v_validacoes > 0
     and (new.economia is distinct from old.economia
          or new.economia_variavel is distinct from old.economia_variavel) then
    raise exception
      'A economia não pode mudar: % cliente(s) já validaram este cupom e o valor entra no total economizado deles.',
      v_validacoes
      using errcode = 'P0601';
  end if;

  if v_ativas > 0
     and (new.beneficio is distinct from old.beneficio
          or new.taxas is distinct from old.taxas
          or new.formas_consumo is distinct from old.formas_consumo
          or new.tipo_promocao is distinct from old.tipo_promocao
          or new.valor_compra_minimo is distinct from old.valor_compra_minimo) then
    raise exception
      'Benefício, taxas, formas de consumo, tipo e valor mínimo não podem mudar agora: % cliente(s) têm este cupom ativo. A última ativação vence em %.',
      v_ativas, to_char(v_ultima_expira at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
      using errcode = 'P0602';
  end if;

  if new.limite_por_usuario is not null
     and new.limite_por_usuario is distinct from old.limite_por_usuario then
    select coalesce(max(qtd), 0) into v_max_por_usuario
      from (
        select count(*) as qtd
          from public.cupons_usuario
         where cupom_id = old.id
           and (status = 'validado' or (status = 'ativo' and expira_em > now()))
         group by usuario_id
      ) t;
    if new.limite_por_usuario < v_max_por_usuario then
      raise exception
        'O limite por cliente não pode ficar abaixo de %: já há cliente que usou esse tanto.',
        v_max_por_usuario
        using errcode = 'P0603';
    end if;
  end if;

  if new.limite_total is not null
     and new.limite_total is distinct from old.limite_total
     and new.limite_total < v_validacoes then
    raise exception
      'O limite total não pode ficar abaixo de %: é quanto já foi resgatado.',
      v_validacoes
      using errcode = 'P0604';
  end if;

  if v_ativas > 0 and new.validade_fim < old.validade_fim then
    raise exception
      'A validade não pode ser encurtada agora: % cliente(s) têm este cupom ativo.',
      v_ativas
      using errcode = 'P0605';
  end if;

  if v_ativas > 0 and new.horarios is distinct from old.horarios then
    v_dias_velho := case when jsonb_typeof(old.horarios -> 'dias') = 'array'
                         then old.horarios -> 'dias' else '[]'::jsonb end;
    v_dias_novo  := case when jsonb_typeof(new.horarios -> 'dias') = 'array'
                         then new.horarios -> 'dias' else '[]'::jsonb end;

    if jsonb_array_length(v_dias_novo) > 0
       and not (v_dias_novo @> v_dias_velho) then
      raise exception
        'Os dias de consumo não podem ser reduzidos agora: % cliente(s) têm este cupom ativo.',
        v_ativas
        using errcode = 'P0606';
    end if;

    v_ini_velho := public.hora_ou_null(old.horarios ->> 'inicio');
    v_fim_velho := public.hora_ou_null(old.horarios ->> 'fim');
    v_ini_novo  := public.hora_ou_null(new.horarios ->> 'inicio');
    v_fim_novo  := public.hora_ou_null(new.horarios ->> 'fim');

    if v_ini_velho is not null and v_fim_velho is not null
       and v_ini_novo is not null and v_fim_novo is not null then
      if v_ini_velho > v_fim_velho or v_ini_novo > v_fim_novo then
        raise exception
          'O horário não pode mudar agora: % cliente(s) têm este cupom ativo.',
          v_ativas
          using errcode = 'P0606';
      end if;
      if v_ini_novo > v_ini_velho or v_fim_novo < v_fim_velho then
        raise exception
          'O horário só pode ser ampliado agora: % cliente(s) têm este cupom ativo.',
          v_ativas
          using errcode = 'P0606';
      end if;
    end if;
  end if;

  v_material :=
        new.beneficio         is distinct from old.beneficio
     or new.economia          is distinct from old.economia
     or new.economia_variavel is distinct from old.economia_variavel
     or new.categoria_id      is distinct from old.categoria_id
     or new.categoria_nova_id is distinct from old.categoria_nova_id
     or new.taxas             is distinct from old.taxas
     or new.formas_consumo    is distinct from old.formas_consumo
     or new.tipo_promocao     is distinct from old.tipo_promocao
     or new.valor_compra_minimo is distinct from old.valor_compra_minimo
     or new.horarios          is distinct from old.horarios
     or new.regras            is distinct from old.regras
     or new.imagem            is distinct from old.imagem;

  new.moderacao_historico := coalesce(old.moderacao_historico, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
         'em', now(),
         'acao', case when v_material then 'editado_material' else 'editado' end,
         'por', v_uid
       ));

  if old.status = 'ativo' and v_material then
    new.status := 'pendente';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_edicao_cupom() from public, anon, authenticated;

comment on function public.checar_edicao_cupom() is
  'Fase 6.5 + MARCO 2A + CLIENT-RETURNS-02: matriz de imutabilidade. Passa a enxergar tipo_promocao e valor_compra_minimo (mudou? / material? / promessa com ativação viva).';

-- 9. admin_editar_cupom — mesmos campos CR-01 + tipo/mínimo
create or replace function public.admin_editar_cupom(
  p_cupom_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.cupons%rowtype;
  v_uid uuid := (select auth.uid());
  v_chave text;
  v_proibidos text[] := array[
    'estabelecimento_id',
    'id',
    'status',
    'categoria_id',
    'moderacao_historico',
    'criado_em'
  ];
  v_permitidos text[] := array[
    'titulo',
    'beneficio',
    'economia',
    'economia_variavel',
    'validade_inicio',
    'validade_fim',
    'ocultar_ate_inicio',
    'prazo_ativacao_horas',
    'regras',
    'taxas',
    'formas_consumo',
    'horarios',
    'imagem',
    'limite_total',
    'limite_por_usuario',
    'categoria_nova_id',
    'tipo_promocao',
    'valor_compra_minimo'
  ];
  v_titulo text;
  v_folha uuid;
  v_nchaves int;
  v_tipo text;
begin
  if not (select private.is_admin()) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return jsonb_build_object('ok', false, 'motivo', 'patch_invalido');
  end if;

  select count(*) into v_nchaves from jsonb_object_keys(p_patch);
  if v_nchaves = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'patch_invalido');
  end if;

  for v_chave in select jsonb_object_keys(p_patch)
  loop
    if v_chave = any (v_proibidos) or v_chave <> all (v_permitidos) then
      return jsonb_build_object('ok', false, 'motivo', 'campo_proibido');
    end if;
  end loop;

  select * into v_row
    from public.cupons
   where id = p_cupom_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  if p_patch ? 'titulo' then
    v_titulo := nullif(btrim(p_patch ->> 'titulo'), '');
    if v_titulo is null then
      return jsonb_build_object('ok', false, 'motivo', 'titulo_vazio');
    end if;
    v_row.titulo := v_titulo;
  end if;

  if p_patch ? 'beneficio' then
    v_row.beneficio := coalesce(p_patch ->> 'beneficio', '');
  end if;

  if p_patch ? 'economia' then
    v_row.economia := (p_patch ->> 'economia')::numeric;
  end if;

  if p_patch ? 'economia_variavel' then
    v_row.economia_variavel := (p_patch ->> 'economia_variavel')::boolean;
  end if;

  if p_patch ? 'validade_inicio' then
    if nullif(p_patch ->> 'validade_inicio', '') is null then
      v_row.validade_inicio := null;
    else
      v_row.validade_inicio := (p_patch ->> 'validade_inicio')::date;
    end if;
  end if;

  if p_patch ? 'validade_fim' then
    if nullif(p_patch ->> 'validade_fim', '') is null then
      return jsonb_build_object('ok', false, 'motivo', 'validade_vazia');
    end if;
    v_row.validade_fim := (p_patch ->> 'validade_fim')::date;
  end if;

  if p_patch ? 'ocultar_ate_inicio' then
    v_row.ocultar_ate_inicio := (p_patch ->> 'ocultar_ate_inicio')::boolean;
  end if;

  if p_patch ? 'prazo_ativacao_horas' then
    v_row.prazo_ativacao_horas := (p_patch ->> 'prazo_ativacao_horas')::integer;
  end if;

  if p_patch ? 'regras' and jsonb_typeof(p_patch -> 'regras') = 'array' then
    v_row.regras := p_patch -> 'regras';
  end if;

  if p_patch ? 'taxas' and jsonb_typeof(p_patch -> 'taxas') = 'array' then
    v_row.taxas := p_patch -> 'taxas';
  end if;

  if p_patch ? 'formas_consumo' and jsonb_typeof(p_patch -> 'formas_consumo') = 'array' then
    v_row.formas_consumo := p_patch -> 'formas_consumo';
  end if;

  if p_patch ? 'horarios' and jsonb_typeof(p_patch -> 'horarios') = 'object' then
    v_row.horarios := p_patch -> 'horarios';
  end if;

  if p_patch ? 'imagem' then
    v_row.imagem := coalesce(p_patch ->> 'imagem', '');
  end if;

  if p_patch ? 'limite_total' then
    if p_patch ->> 'limite_total' is null or p_patch ->> 'limite_total' = '' then
      v_row.limite_total := null;
    else
      v_row.limite_total := (p_patch ->> 'limite_total')::integer;
    end if;
  end if;

  if p_patch ? 'limite_por_usuario' then
    if p_patch ->> 'limite_por_usuario' is null or p_patch ->> 'limite_por_usuario' = '' then
      v_row.limite_por_usuario := null;
    else
      v_row.limite_por_usuario := (p_patch ->> 'limite_por_usuario')::integer;
    end if;
  end if;

  if p_patch ? 'categoria_nova_id' then
    begin
      v_folha := (p_patch ->> 'categoria_nova_id')::uuid;
    exception when invalid_text_representation then
      return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
    end;
    if not exists (
      select 1
        from public.estabelecimento_categorias_novas j
       where j.estabelecimento_id = v_row.estabelecimento_id
         and j.categoria_id = v_folha
    ) then
      return jsonb_build_object('ok', false, 'motivo', 'categoria_invalida');
    end if;
    v_row.categoria_nova_id := v_folha;
  end if;

  if p_patch ? 'tipo_promocao' then
    v_tipo := p_patch ->> 'tipo_promocao';
    if v_tipo not in ('desconto', 'leve_mais_pague_menos', 'frete_gratis') then
      return jsonb_build_object('ok', false, 'motivo', 'tipo_invalido');
    end if;
    v_row.tipo_promocao := v_tipo::public.tipo_promocao;
  end if;

  if p_patch ? 'valor_compra_minimo' then
    if p_patch ->> 'valor_compra_minimo' is null or p_patch ->> 'valor_compra_minimo' = '' then
      v_row.valor_compra_minimo := null;
    else
      v_row.valor_compra_minimo := (p_patch ->> 'valor_compra_minimo')::numeric;
    end if;
  end if;

  v_row.moderacao_historico := coalesce(v_row.moderacao_historico, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
         'em', now(),
         'acao', 'editado_admin',
         'por', v_uid::text
       ));

  update public.cupons
     set titulo = v_row.titulo,
         beneficio = v_row.beneficio,
         economia = v_row.economia,
         economia_variavel = v_row.economia_variavel,
         validade_inicio = v_row.validade_inicio,
         validade_fim = v_row.validade_fim,
         ocultar_ate_inicio = v_row.ocultar_ate_inicio,
         prazo_ativacao_horas = v_row.prazo_ativacao_horas,
         regras = v_row.regras,
         taxas = v_row.taxas,
         formas_consumo = v_row.formas_consumo,
         horarios = v_row.horarios,
         imagem = v_row.imagem,
         limite_total = v_row.limite_total,
         limite_por_usuario = v_row.limite_por_usuario,
         categoria_nova_id = v_row.categoria_nova_id,
         tipo_promocao = v_row.tipo_promocao,
         valor_compra_minimo = v_row.valor_compra_minimo,
         moderacao_historico = v_row.moderacao_historico,
         atualizado_em = now()
   where id = p_cupom_id;

  return jsonb_build_object('ok', true, 'id', p_cupom_id);
end;
$$;

revoke execute on function public.admin_editar_cupom(text, jsonb) from public, anon;
grant execute on function public.admin_editar_cupom(text, jsonb) to authenticated;

comment on function public.admin_editar_cupom(text, jsonb) is
  'CLIENT-RETURNS-01/02: admin corrige campos permitidos, inclusive tipo_promocao e valor_compra_minimo. Nao muda estabelecimento_id/status.';
