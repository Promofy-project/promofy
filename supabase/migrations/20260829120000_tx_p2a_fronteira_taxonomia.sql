-- ============================================================
-- Promofy — TX-P2A · Fronteira estável da taxonomia
--
-- NÃO cria segmentos, NÃO cria categorias folha, NÃO muda o
-- significado de public.categorias. Cria SOMENTE o contrato que
-- as telas passarão a consumir, para que o cutover (TX-P2B/D)
-- troque o CORPO destas views sem que o cliente mude de novo.
--
-- TX-P2AF: a auditoria achou uma colisão semântica na primeira versão
-- desta migration — havia UMA view de catálogo servindo ao mesmo tempo
-- o filtro público (vira segmento) e a categoria operacional do admin/
-- portal (vira folha). Hoje as duas coincidem porque
-- `public.categorias` é as duas coisas ao mesmo tempo; o cutover as
-- separa. Por isso agora são TRÊS views, não duas:
--
--   catalogo_filtros      → o que a UI OFERECE como filtro de descoberta
--                           (hoje: categorias legado; depois: segmentos)
--   catalogo_categorias   → as categorias FÍSICAS que podem ser ligadas
--                           a estabelecimento/cupom (admin, form do
--                           portal) (hoje: categorias legado; depois:
--                           categorias folha)
--   categoria_para_filtro → de uma categoria FÍSICA (`categoria_id`),
--                           o slug do FILTRO que a representa na
--                           descoberta (hoje: identidade; depois:
--                           folha → segmento)
--
-- `catalogo_filtros` e `catalogo_categorias` são idênticas hoje e
-- PROPOSITALMENTE duplicadas: fundi-las obrigaria a desfundi-las no
-- cutover, no pior momento possível. Nenhuma delas referencia a outra.
--
-- Por que view e não RPC: o contrato é uma RELAÇÃO, não um cálculo.
-- View entra no database.types.ts, compõe com `.in()` do PostgREST,
-- e com security_invoker herda a RLS que já existe em `categorias`
-- — sem função SECURITY DEFINER nova para auditar. Nenhuma regra de
-- visibilidade de cupom é duplicada aqui: o cutover quebraria apenas
-- o PREDICADO `cupons.categoria_id = <slug>`, e é só ele que estas
-- views escondem.
-- ============================================================

-- Catálogo de FILTROS públicos (descoberta) -------------------
-- "O que o usuário escolhe para filtrar." Hoje = categorias legado;
-- depois do cutover = os 14 segmentos. `slug` é o identificador
-- público da fronteira; a PK física nunca atravessa.
create view public.catalogo_filtros
with (security_invoker = true) as
select
  c.id        as slug,
  c.label     as label,
  c.icon      as icon,
  c.gradiente as gradiente,
  c.ordem     as ordem
from public.categorias c;

comment on view public.catalogo_filtros is
  'TX-P2A: catálogo de FILTROS públicos (chips de descoberta). Hoje = '
  'public.categorias; após o cutover passa a ler public.segmentos. '
  'NÃO usar para popular opções de categoria operacional (admin/portal) '
  '— ver catalogo_categorias.';

-- Catálogo de CATEGORIAS operacionais (admin, portal) ----------
-- "As categorias físicas que podem ser ligadas a um estabelecimento
-- ou cupom." Hoje = identidade sobre categorias legado; depois do
-- cutover = as categorias folha (o que hoje é `categoria_id` físico
-- continuará sendo `categoria_id` físico — só o corpo muda de tabela).
-- `categoria_id` é a chave que casa com `cupons.categoria_id` e
-- `estabelecimento_categorias.categoria_id`; `slug` é o slug ESTÁVEL
-- da própria categoria/folha — hoje coincide com `categoria_id` por
-- serem a mesma coisa, e essa coincidência TERMINA no cutover.
create view public.catalogo_categorias
with (security_invoker = true) as
select
  c.id        as categoria_id,
  c.id        as slug,
  c.label     as label,
  c.icon      as icon,
  c.gradiente as gradiente,
  c.ordem     as ordem
from public.categorias c;

comment on view public.catalogo_categorias is
  'TX-P2A: catálogo de CATEGORIAS operacionais (admin edita vínculo '
  'estabelecimento↔categoria; portal usa no form de cupom). `categoria_id` '
  'é a chave física — casa com cupons.categoria_id e '
  'estabelecimento_categorias.categoria_id. Hoje = public.categorias; '
  'após o cutover passa a ler as categorias folha. NÃO é o catálogo de '
  'filtros — ver catalogo_filtros.';

-- Categoria física → slug do FILTRO ----------------------------
-- Traduz `cupons.categoria_id` (físico) no slug do FILTRO que o
-- representa na descoberta — é o que faz `?cat=<slug>` e o visual do
-- card sobreviverem ao cutover. Hoje identidade (toda categoria É seu
-- próprio filtro); depois do cutover, folha → segmento (N:1).
create view public.categoria_para_filtro
with (security_invoker = true) as
select
  c.id as categoria_id,
  c.id as filtro_slug
from public.categorias c;

comment on view public.categoria_para_filtro is
  'TX-P2A: de uma categoria FÍSICA (categoria_id), o slug do FILTRO '
  '(catalogo_filtros) que a representa na descoberta pública. Hoje '
  'identidade sobre public.categorias; após o cutover vira folha → '
  'segmento (N categorias físicas podem apontar para o mesmo filtro).';

-- Privilégios ---------------------------------------------------
-- Espelha exatamente o acesso que `categorias` já tem hoje: leitura
-- pública (a policy "categorias: leitura publica" libera anon), nada
-- de escrita. security_invoker garante que a RLS da tabela base
-- continua sendo a autoridade — a view não promove ninguém.
--
-- View simples é AUTO-ATUALIZÁVEL no Postgres: sem o revoke, um
-- insert/update/delete na view escreveria em public.categorias.
revoke all on public.catalogo_filtros      from public, anon, authenticated;
revoke all on public.catalogo_categorias   from public, anon, authenticated;
revoke all on public.categoria_para_filtro from public, anon, authenticated;

grant select on public.catalogo_filtros      to anon, authenticated;
grant select on public.catalogo_categorias   to anon, authenticated;
grant select on public.categoria_para_filtro to anon, authenticated;
