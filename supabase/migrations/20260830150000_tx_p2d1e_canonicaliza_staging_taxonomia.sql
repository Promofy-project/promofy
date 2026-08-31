-- ============================================================
-- Promofy — TX-P2D1E · Canonicaliza o staging da taxonomia antes dos
-- shadows do cutover (TX-P2D2+)
--
-- Migration NOVA, posterior a 20260830140000 (hospedada e imutável).
-- NÃO edita 20260829120000 / 20260830120000 / 20260830130000 /
-- 20260830140000 — todas continuam intocadas. Esta migration corrige,
-- por forward migration, três dívidas do contrato de staging que a
-- TX-P2B/TX-P2C nasceram com nomes/regras pré-canônicos:
--
--   1. `segmentos.icon` / `categorias_novas.icon_override` /
--      `categorias_novas.tema_override` → renomeadas para o nome físico
--      canônico (`icone` em ambas as tabelas, `tema` em categorias_novas).
--      NULL em categoria continua significando "herdar do segmento" —
--      só o NOME da coluna muda, não a semântica.
--   2. `public.tema_visual` deixa de ser whitelist fechada nos 14 tokens
--      iniciais e passa a validar FORMATO (slug minúsculo, sem CSS) —
--      os 14 tokens do seed (`docs/taxonomia/catalogo-v1.json`) eram
--      vocabulário inicial, nunca o teto do domain. Produto pode
--      introduzir tokens novos sem migration de DDL.
--   3. `categorias_novas.segmento_id` ganha trigger de imutabilidade
--      INCONDICIONAL — o comentário original da TX-P2B (migration
--      120000, imutável) documentava que o bloqueio de hoje vinha só da
--      ausência de grant de UPDATE, e que um trigger "entraria no
--      cutover". Ele entra aqui, antes dos shadows, porque shadows vão
--      começar a escrever nessa tabela e a garantia não pode continuar
--      dependendo de ausência de grant.
--
-- NÃO toca: cupons, cupom_eventos, cupons_usuario, pontos_transacoes,
-- estabelecimentos, estabelecimento_categorias — o TX-P2D1 já convergiu
-- o hospedado para os 14 cupons canônicos, e esta migration não mexe em
-- nada disso. NÃO faz cutover: as três views da TX-P2A continuam lendo
-- `public.categorias` legado, e nenhuma tela passa a ler `segmentos` ou
-- `categorias_novas`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. RENAME FÍSICO — dado, NULLs, constraints (por atnum) e UUIDs
-- preservados automaticamente pelo RENAME COLUMN. Só os NOMES das
-- constraints CHECK são atualizados manualmente abaixo, para o nome
-- não ficar enganoso (a expressão em si já segue a coluna renomeada
-- automaticamente).
-- ------------------------------------------------------------
alter table public.segmentos rename column icon to icone;
alter table public.segmentos rename constraint segmentos_icon_nao_vazio to segmentos_icone_nao_vazio;

alter table public.categorias_novas rename column icon_override to icone;
alter table public.categorias_novas rename column tema_override to tema;
alter table public.categorias_novas rename constraint categorias_novas_icon_override_nao_vazio to categorias_novas_icone_nao_vazio;

comment on table public.segmentos is
  'TX-P2B (STAGING): segmentos da taxonomia nova — o nível que a descoberta pública oferece como filtro. Ainda NÃO lido por nenhuma tela; o runtime segue em public.categorias legado. Colunas canônicas (TX-P2D1E): icone, tema.';

comment on table public.categorias_novas is
  'TX-P2B (STAGING): categorias FOLHA da taxonomia nova, cada uma em exatamente um segmento. Nome temporário de propósito — vira public.categorias só no cutover (TX-P2D). Visual: icone/tema NULL significa herdar do segmento. Reparenting de segmento_id é INCONDICIONALMENTE imutável (TX-P2D1E) — ver comentário da coluna e o trigger trg_categorias_novas_impedir_reparent.';

comment on column public.categorias_novas.segmento_id is
  'Segmento dono da folha. REPARENTING é INCONDICIONALMENTE proibido (TX-P2D1E) — trg_categorias_novas_impedir_reparent recusa qualquer UPDATE que mude este valor, independente de grant, de a categoria já ter cupom, de estar ativa, ou de quem executa (inclusive service_role). Não depende mais de ausência de grant de UPDATE, como documentava o comentário original da TX-P2B. Mover uma folha de segmento é: desativar a categoria antiga + criar uma nova.';

-- ------------------------------------------------------------
-- 2. DOMAIN tema_visual — de whitelist fechada para validação de
-- FORMATO. Os 14 valores do seed continuam válidos (todos batem com o
-- novo regex), então a troca de constraint é transacional e segura: o
-- `add constraint` abaixo valida TODO uso atual do domain (segmentos.tema
-- e categorias_novas.tema, já renomeada) antes de confirmar.
--
-- `tema_visual_check` é o nome auto-gerado da constraint original
-- (`create domain ... as text check (...)` sem nome explícito) —
-- confirmado via catálogo antes de escrever esta migration, não
-- hardcodado às cegas.
-- ------------------------------------------------------------
alter domain public.tema_visual drop constraint tema_visual_check;

alter domain public.tema_visual add constraint tema_visual_formato
  check (
    value ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
    and length(value) <= 50
  );

comment on domain public.tema_visual is
  'TX-P2B/TX-P2D1E: token de tema visual do catálogo (NUNCA CSS — sem hex, rgb ou gradient). A camada de apresentação traduz token -> gradiente/estilo, para o schema não amarrar o app nativo ao CSS da web. Formato: slug minúsculo (^[a-z][a-z0-9]*(-[a-z0-9]+)*$), até 50 caracteres — os 14 valores do catálogo definitivo (§5.1: laranja, verde, grafite, rosa, roxo, ciano, violeta, azul, indigo, ambar, cinza, vermelho, terra, amarelo) são o VOCABULÁRIO INICIAL do seed, não uma whitelist fechada de produto. Token novo entra por dado (INSERT/UPDATE), nunca precisa de migration de DDL.';

-- ------------------------------------------------------------
-- 3. Trigger de reparenting incondicional.
--
-- BEFORE trigger dispara para QUALQUER role que execute o UPDATE —
-- inclusive service_role — porque o mecanismo de trigger do Postgres
-- não é gated por EXECUTE da função (isso só importaria se alguém
-- tentasse chamar a função como RPC direta, o que não faz sentido fora
-- de contexto de trigger, daí o revoke abaixo). O que de fato bloqueia
-- o UPDATE é a trigger function levantando exceção — não depende de
-- grant, de a categoria ter cupom, de estar ativa, nem de histórico.
-- ------------------------------------------------------------
create or replace function public.impedir_reparent_categoria_nova()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.segmento_id is distinct from old.segmento_id then
    raise exception 'reparenting_proibido'
      using hint = 'segmento_id de categorias_novas é incondicionalmente imutável. Para mover uma categoria de segmento: desative a categoria antiga e crie uma nova.';
  end if;
  return new;
end;
$$;

revoke execute on function public.impedir_reparent_categoria_nova() from public, anon, authenticated;

comment on function public.impedir_reparent_categoria_nova() is
  'TX-P2D1E: bloqueia incondicionalmente UPDATE de categorias_novas.segmento_id. Não depende de grant, de a categoria estar em uso, de ativo, nem de quem executa — inclusive service_role. Mover categoria de segmento é desativar + criar nova.';

drop trigger if exists trg_categorias_novas_impedir_reparent on public.categorias_novas;
create trigger trg_categorias_novas_impedir_reparent
  before update of segmento_id on public.categorias_novas
  for each row execute function public.impedir_reparent_categoria_nova();
