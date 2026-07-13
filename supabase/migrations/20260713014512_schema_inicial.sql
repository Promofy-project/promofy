-- ============================================================
-- Promofy — Fase 1 · Migration 1: schema inicial
-- Enums, tabelas e índices. Sem RLS aqui (migration 3) e sem
-- funções/triggers (migration 2).
--
-- Nota de compatibilidade: cupons.id / estabelecimentos.id /
-- categorias.id são TEXT com os ids do mock ('c01', 'e1', slugs)
-- porque /m/cupom/[id] continua lendo o mock nesta fase — ids
-- divergentes quebrariam os links da home. Migração p/ uuid = Fase 2.
-- ============================================================

-- ENUMS ------------------------------------------------------
create type public.papel_usuario           as enum ('consumidor','lojista','admin');
create type public.status_estabelecimento  as enum ('ativo','pendente','suspenso');
create type public.status_cupom            as enum ('ativo','indisponivel','expirado','esgotado');
create type public.tipo_evento_cupom       as enum ('visualizacao','clique','ativacao','validacao');
create type public.status_cupom_usuario    as enum ('ativo','validado','expirado');
create type public.acao_pontos             as enum ('resgate','nps','indicacao','visita');
create type public.status_assinatura       as enum ('ativa','cancelada','expirada');

-- PROFILES (1:1 com auth.users) ------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.papel_usuario not null default 'consumidor',
  nome text not null default '',
  cidade text,
  cpf text,                    -- capturado no cadastro; exibir sempre mascarado
  telefone text,
  nascimento date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- CATEGORIAS -------------------------------------------------
create table public.categorias (
  id text primary key,               -- slugs do mock: alimentacao, fitness...
  label text not null,
  icon text not null,                -- nome do ícone lucide (mapeado na UI)
  gradiente text not null,           -- CSS gradient dos placeholders
  ordem int not null default 0
);

-- ESTABELECIMENTOS -------------------------------------------
create table public.estabelecimentos (
  id text primary key default gen_random_uuid()::text,  -- 'e1'.. no seed (compat mock)
  owner_id uuid references public.profiles(id) on delete set null,  -- ligado pós seed de usuários
  nome text not null,
  categoria_id text not null references public.categorias(id),
  cidade text not null,
  status public.status_estabelecimento not null default 'pendente',
  rating numeric(2,1) not null default 0,        -- agregado denormalizado (recálculo = Fase 2)
  rating_count int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- CUPONS -----------------------------------------------------
create table public.cupons (
  id text primary key default gen_random_uuid()::text,  -- 'c01'.. no seed (compat /m/cupom/[id])
  estabelecimento_id text not null references public.estabelecimentos(id) on delete cascade,
  titulo text not null,
  categoria_id text not null references public.categorias(id),
  beneficio text not null default '',
  economia numeric(10,2) not null check (economia >= 0),
  preco_de numeric(10,2),
  preco_por numeric(10,2),
  validade_inicio date,                      -- agendamento (spec do cliente)
  validade_fim date not null,
  ocultar_ate_inicio boolean not null default false,
  limite_total int,
  limite_por_usuario int not null default 1,
  prazo_ativacao_horas int not null default 24,
  regras jsonb not null default '[]'::jsonb,     -- string[]
  horarios jsonb not null default '{}'::jsonb,   -- {descricao} | {dias[],inicio,fim}
  status public.status_cupom not null default 'ativo',
  destaque boolean not null default false,
  distancia_km numeric(6,2),                 -- protótipo (geoloc real = fase futura)
  imagem text not null default '',           -- protótipo
  ordem int not null default 0,              -- protótipo: ordem estável da home
  rating numeric(2,1),                       -- protótipo: rating POR CUPOM (mock difere do estabelecimento)
  avaliacoes int not null default 0,         -- protótipo: contagem exibida no card
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- AVALIACOES (FK por id — corrige a referência por nome do mock)
create table public.avaliacoes (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.profiles(id) on delete set null,
  usuario_nome text not null,                -- nome exibido (seed legado tem usuario_id null)
  estabelecimento_id text not null references public.estabelecimentos(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comentario text,
  criado_em timestamptz not null default now()
);

-- CUPOM_EVENTOS (métricas SEMPRE derivadas daqui, nunca contadores soltos)
create table public.cupom_eventos (
  id bigint generated always as identity primary key,
  cupom_id text not null references public.cupons(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete set null,  -- nullable (evento anônimo)
  tipo public.tipo_evento_cupom not null,
  criado_em timestamptz not null default now()
);

-- CUPONS_USUARIO (ciclo do cupom por usuário; ciclo segue mockado na Fase 1)
create table public.cupons_usuario (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  cupom_id text not null references public.cupons(id) on delete cascade,
  status public.status_cupom_usuario not null default 'ativo',
  codigo text not null unique,               -- default setado na migration 2 (função criada lá)
  nps int check (nps between 0 and 10),
  ativado_em timestamptz not null default now(),
  validado_em timestamptz,
  expira_em timestamptz,
  unique (usuario_id, cupom_id)
);

-- PONTOS_TRANSACOES (livro-razão: saldo = SUM(pontos), nunca coluna editável)
create table public.pontos_transacoes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  acao public.acao_pontos not null,
  pontos int not null,
  referencia_id text,                          -- ex.: id de cupons_usuario
  criado_em timestamptz not null default now()
);

-- CONFIG_PONTOS (FONTE ÚNICA da tabela de pontos — resolve a duplicação
-- gamification.ts × admin/configuracoes)
create table public.config_pontos (
  acao public.acao_pontos primary key,
  pontos int not null check (pontos >= 0)
);

-- PLANOS -----------------------------------------------------
create table public.planos (
  id text primary key,                          -- basico|plus|familia|vip
  nome text not null,
  preco numeric(10,2) not null default 0,
  periodo text not null default '',
  descricao text not null default '',
  beneficios jsonb not null default '[]'::jsonb,
  destaque boolean not null default false,
  bloqueado boolean not null default false,
  badge text,
  legenda text,
  ordem int not null default 0
);

-- ASSINATURAS (estrutura pronta; sem pagamento na Fase 1) ----
create table public.assinaturas (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  plano_id text not null references public.planos(id),
  status public.status_assinatura not null default 'ativa',
  inicio timestamptz not null default now(),
  fim timestamptz,
  criado_em timestamptz not null default now()
);

-- ÍNDICES (todas as FKs + buscas: categoria, cidade, validade, RLS)
create index idx_estabelecimentos_owner      on public.estabelecimentos(owner_id);
create index idx_estabelecimentos_categoria  on public.estabelecimentos(categoria_id);
create index idx_estabelecimentos_cidade     on public.estabelecimentos(cidade);
create index idx_cupons_estabelecimento      on public.cupons(estabelecimento_id);
create index idx_cupons_categoria            on public.cupons(categoria_id);
create index idx_cupons_status_validade      on public.cupons(status, validade_fim);
create index idx_avaliacoes_estabelecimento  on public.avaliacoes(estabelecimento_id);
create index idx_avaliacoes_usuario          on public.avaliacoes(usuario_id);
create index idx_cupom_eventos_cupom_tipo    on public.cupom_eventos(cupom_id, tipo);
create index idx_cupom_eventos_usuario       on public.cupom_eventos(usuario_id);
create index idx_cupons_usuario_usuario      on public.cupons_usuario(usuario_id);
create index idx_cupons_usuario_cupom        on public.cupons_usuario(cupom_id);
create index idx_pontos_usuario              on public.pontos_transacoes(usuario_id);
create index idx_assinaturas_usuario         on public.assinaturas(usuario_id);
create index idx_assinaturas_plano           on public.assinaturas(plano_id);
create unique index uniq_assinatura_ativa    on public.assinaturas(usuario_id) where status = 'ativa';
