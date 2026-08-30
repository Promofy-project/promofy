-- ============================================================
-- Promofy — TX-P2B · Schema STAGING da taxonomia nova
--
-- Cria a ESTRUTURA do modelo novo (segmento -> categoria folha) para
-- provar que ele está correto ANTES de existir catálogo real dentro
-- dele. NÃO é o cutover.
--
-- O que esta migration deliberadamente NÃO faz:
--   · não insere os 14 segmentos nem as ~75 categorias (isso é TX-P2C);
--   · não altera public.categorias legado — ele segue sendo a AUTORIDADE
--     do runtime;
--   · não altera o corpo de catalogo_filtros / catalogo_categorias /
--     categoria_para_filtro (migration 20260829120000, já hospedada e
--     imutável) — as três continuam lendo o legado;
--   · não toca cupons.categoria_id, estabelecimentos.categoria_id nem
--     estabelecimento_categorias.categoria_id.
--
-- Nenhuma tela lê `segmentos` ou `categorias_novas`. São tabelas de
-- staging: existem para o DDL ser auditado com testes reais antes de
-- carregarem dado de produto.
-- ============================================================

-- ------------------------------------------------------------
-- Token de tema visual
--
-- `tema` NÃO é CSS. Hoje `public.categorias.gradiente` guarda
-- 'linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)' — string livre que
-- o banco não valida e que amarra o schema a uma decisão de front (e ao
-- CSS da web, num projeto cujo destino é React Native). O modelo novo
-- guarda um TOKEN; quem traduz token -> gradiente/estilo é a camada de
-- apresentação, web ou nativa.
--
-- DOMAIN e não enum: `alter type ... add value` não deixa usar o valor
-- novo na mesma transação em que nasce (armadilha já paga nas migrations
-- 5 e 8 deste projeto). Estender um domain é
-- `alter domain ... drop constraint` + `add constraint` numa migration
-- comum. DOMAIN e não duas CHECKs iguais: a mesma verdade em dois
-- lugares vira duas verdades no primeiro dia em que alguém edita uma só.
--
-- O vocabulário abaixo está FECHADO para o catálogo definitivo de §5.1
-- (14 segmentos / 75 categorias folhas): um token por segmento, nomeado
-- pelo matiz. TX-P2C carrega o catálogo dentro deste vocabulário e NÃO
-- precisa estendê-lo. Se algum dia precisar, entra por migration NOVA
-- com `alter domain ... drop constraint` + `add constraint`, nunca por
-- texto livre.
--
--   Alimentação            -> laranja      Educação                -> indigo
--   Fitness e Saúde        -> verde        Pet                     -> ambar
--   Automotivo             -> grafite      Serviços                -> cinza
--   Beleza e Bem Estar     -> rosa         Saúde                   -> vermelho
--   Entretenimento         -> roxo         Casa e Decoração        -> terra
--   Turismo e Hotelaria    -> ciano        Infantil e Maternidade  -> amarelo
--   Moda                   -> violeta
--   Eletrônicos            -> azul
--
-- São DESIGN TOKENS, não CSS: nada de hex, rgb ou gradient aqui, e o
-- nome do segmento também não é tema (`alimentacao` não é um token).
-- ------------------------------------------------------------
create domain public.tema_visual as text
  check (value in (
    'laranja',   -- Alimentação
    'verde',     -- Fitness e Saúde
    'grafite',   -- Automotivo
    'rosa',      -- Beleza e Bem Estar
    'roxo',      -- Entretenimento
    'ciano',     -- Turismo e Hotelaria
    'violeta',   -- Moda
    'azul',      -- Eletrônicos
    'indigo',    -- Educação
    'ambar',     -- Pet
    'cinza',     -- Serviços
    'vermelho',  -- Saúde
    'terra',     -- Casa e Decoração
    'amarelo'    -- Infantil e Maternidade
  ));

comment on domain public.tema_visual is
  'TX-P2B: token de tema visual do catálogo (NUNCA CSS). Vocabulário FECHADO nos 14 tokens do catálogo definitivo (§5.1), um por segmento. A camada de apresentação traduz token -> gradiente/estilo, para o schema não amarrar o app nativo ao CSS da web. Estender = migration nova com alter domain, não texto livre.';

-- ------------------------------------------------------------
-- SEGMENTOS — o nível que a descoberta pública oferece como filtro
-- ------------------------------------------------------------
create table public.segmentos (
  id uuid primary key default gen_random_uuid(),   -- identidade TÉCNICA
  slug text not null,                              -- handle ESTÁVEL e público
  nome text not null,                              -- rótulo, muda sem mudar identidade
  icon text not null,                              -- nome de ícone (lucide na web)
  tema public.tema_visual not null,
  ordem integer not null,
  ativo boolean not null default true,             -- desativa, NUNCA apaga
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Slug é dado explícito do catálogo, nunca derivado do nome: renomear
  -- "Saúde" para "Saúde & Bem-estar" não pode quebrar um `?cat=saude`
  -- que já está em link compartilhado.
  constraint segmentos_slug_formato
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint segmentos_nome_nao_vazio
    check (length(btrim(nome)) > 0),
  constraint segmentos_icon_nao_vazio
    check (length(btrim(icon)) > 0),
  constraint segmentos_ordem_nao_negativa
    check (ordem >= 0)
);

-- Slug de segmento é ÚNICO GLOBAL: é o handle que aparece em `?cat=` e
-- que `categoria_para_filtro` devolve. Este unique também É o índice de
-- busca por slug — não existe índice separado para isso.
create unique index segmentos_slug_key on public.segmentos (slug);

comment on table public.segmentos is
  'TX-P2B (STAGING): segmentos da taxonomia nova — o nível que a descoberta pública oferece como filtro. Ainda NÃO lido por nenhuma tela; o runtime segue em public.categorias legado.';

-- ------------------------------------------------------------
-- CATEGORIAS_NOVAS — as folhas (futura public.categorias)
--
-- Nome deliberadamente temporário: enquanto o legado `public.categorias`
-- for a autoridade, duas tabelas de categoria coexistem, e um nome
-- ambíguo aqui seria a mesma colisão semântica que o TX-P2AF teve de
-- corrigir. O rename para `categorias` é o cutover (TX-P2D).
-- ------------------------------------------------------------
create table public.categorias_novas (
  id uuid primary key default gen_random_uuid(),
  segmento_id uuid not null
    references public.segmentos (id) on delete restrict,
  slug text not null,
  nome text not null,

  -- Visual HERDADO por omissão. Copiar icon/tema do segmento para ~75
  -- linhas criaria 75 cópias para manter sincronizadas — e a primeira
  -- que divergisse silenciosamente seria um bug de UI sem causa
  -- aparente. NULL = "use o do segmento"; a resolução é da view/app.
  icon_override text null,
  tema_override public.tema_visual null,

  ordem integer not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint categorias_novas_slug_formato
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categorias_novas_nome_nao_vazio
    check (length(btrim(nome)) > 0),
  -- override é opcional, mas se vier não pode vir vazio: '' seria um
  -- ícone inexistente disfarçado de override deliberado.
  constraint categorias_novas_icon_override_nao_vazio
    check (icon_override is null or length(btrim(icon_override)) > 0),
  constraint categorias_novas_ordem_nao_negativa
    check (ordem >= 0)
);

-- Slug de CATEGORIA é único DENTRO do segmento, não global: o modelo tem
-- de suportar "outros" em mais de um segmento (a decisão de produto sobre
-- "Outros" não está tomada — a arquitetura não pode ser o que a impede).
--
-- Este unique tem `segmento_id` como coluna à esquerda, então serve
-- também: (a) às buscas "categorias do segmento X" e (b) à checagem da
-- FK no ON DELETE RESTRICT. Postgres NÃO indexa FK automaticamente, e é
-- por isso que não existe um índice solto em `segmento_id` aqui — seria
-- redundante com este.
create unique index categorias_novas_segmento_slug_key
  on public.categorias_novas (segmento_id, slug);

comment on table public.categorias_novas is
  'TX-P2B (STAGING): categorias FOLHA da taxonomia nova, cada uma em exatamente um segmento. Nome temporário de propósito — vira public.categorias só no cutover (TX-P2D). Visual: icon_override / tema_override NULL significa herdar do segmento.';

comment on column public.categorias_novas.segmento_id is
  'Segmento dono da folha. REPARENTING é proibido depois de a categoria estar em uso: hoje isso é garantido por ausência total de grant de UPDATE (ninguém além de service_role escreve no catálogo). No cutover, quando cupons.categoria_id passar a apontar para cá, entra o trigger defensivo que recusa mudar segmento_id de categoria com cupom.';

-- ------------------------------------------------------------
-- atualizado_em — reusa a função da migration 3 (não duplicar)
-- ------------------------------------------------------------
create trigger trg_segmentos_atualizado_em
  before update on public.segmentos
  for each row execute function public.set_atualizado_em();

create trigger trg_categorias_novas_atualizado_em
  before update on public.categorias_novas
  for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- PRIVILÉGIOS
--
-- Default privileges do Supabase dão ALL a anon/authenticated em tabela
-- nova — revogar tudo antes de conceder o mínimo (padrão das migrations
-- 3 e 12 deste repo).
--
-- Catálogo é SOMENTE LEITURA para todo mundo, inclusive admin: neste
-- estágio o catálogo muda por migration, não por DML de aplicação. Não
-- existe CRUD de taxonomia neste WP, então não existe grant de escrita
-- para sustentar — inclusive porque é isso que hoje torna o reparenting
-- de `segmento_id` impossível na prática.
-- ------------------------------------------------------------
revoke all on table public.segmentos        from anon, authenticated;
revoke all on table public.categorias_novas from anon, authenticated;

grant select on table public.segmentos        to anon, authenticated;
grant select on table public.categorias_novas to anon, authenticated;

-- ------------------------------------------------------------
-- RLS
--
-- Contrato escolhido (A): a TABELA é catálogo de referência e devolve
-- TODAS as linhas; quem filtra `ativo` é a FRONTEIRA, onde a pergunta é
-- "isto ainda deve ser OFERECIDO?".
--
-- Por que não filtrar `ativo` aqui: `ativo` responde "posso criar cupom
-- novo nesta categoria / mostro este chip?", e NÃO "esta linha pode ser
-- lida?". Um cupom criado sob uma categoria depois desativada continua
-- existindo, e o card dele precisa resolver label/ícone/tema. Se a RLS
-- escondesse a linha, `categoria_para_filtro` deixaria de traduzir a
-- categoria física do cupom, `filtroSlugDe` devolveria undefined e TODO
-- card histórico cairia no fallback cinza — exatamente o modo de falha
-- silencioso que o TX-P2A existe para impedir. Relatório que agrupa
-- cupom antigo por categoria quebraria do mesmo jeito, e o app React
-- Native fala com o MESMO PostgREST (não há "usa o servidor" como
-- escapatória).
--
-- Isto também preserva o comportamento de hoje: a policy
-- "categorias: leitura publica" é `using (true)`. Como estas tabelas vão
-- SUBSTITUIR aquela, divergir agora seria comprar uma regressão no
-- cutover.
--
-- No cutover, a divisão fica:
--   catalogo_filtros      -> filtra ativo (o que a UI oferece)
--   catalogo_categorias   -> filtra ativo (o que se pode atribuir)
--   categoria_para_filtro -> NÃO filtra ativo (traduz histórico também)
-- ------------------------------------------------------------
alter table public.segmentos        enable row level security;
alter table public.categorias_novas enable row level security;

create policy "segmentos: leitura publica"
  on public.segmentos for select to anon, authenticated
  using (true);

create policy "categorias_novas: leitura publica"
  on public.categorias_novas for select to anon, authenticated
  using (true);

-- Sem policy de INSERT/UPDATE/DELETE: sem grant, não há caminho de
-- escrita para anon/authenticated. A ausência é deliberada, não
-- esquecimento.
