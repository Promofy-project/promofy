-- ============================================================
-- Promofy — Fase 6 · Migration 16: campos novos do cupom (C1)
--
-- Pedido dos devs/cliente: o cadastro de cupom precisa de taxas
-- aplicáveis, formas de consumo, "ilimitado" explícito por usuário e
-- total, e prazo de ativação com mínimo de 5h.
--
-- Tudo ADITIVO: colunas com default, nenhum backfill, nenhuma linha
-- reescrita. Isso importa porque o deploy é coreografado banco-antes-
-- código: existe uma janela em que este schema roda com o código
-- ANTIGO em produção, e ele não conhece nenhuma destas colunas.
-- ============================================================

-- ------------------------------------------------------------
-- TAXAS e FORMAS DE CONSUMO — jsonb (array de rótulos), não colunas.
--
-- POR QUÊ jsonb E NÃO COLUNA BOOLEANA POR TAXA:
--   1. o vocabulário é do cliente e vai mudar (já se falou em taxa de
--      serviço em %, pedido mínimo, "retirada em 2h"); com coluna, cada
--      palavra nova é uma migration e um `db:types` — com jsonb, é uma
--      linha no módulo puro src/lib/cupom-campos.ts;
--   2. os dois campos são MULTIVALORADOS por natureza ("entrega e
--      serviço não entram", "no local ou delivery"), e um array diz isso
--      sem N colunas correlacionadas que podem ficar incoerentes;
--   3. já existe precedente no schema — `regras` e `horarios` são jsonb
--      pelo mesmo motivo, e `horarios` provou na Fase 5 que jsonb com
--      SANEAMENTO no servidor é seguro.
--
-- O preço do jsonb é não ter CHECK de domínio: quem garante o
-- vocabulário é o servidor (criarCupomAction sanea contra a whitelist).
-- Não usamos CHECK aqui de propósito — a Fase 5 mostrou que restringir
-- jsonb no banco transforma dado sujo em EXCEÇÃO, e exceção dentro de
-- `security definer` sem bloco `exception` vira 500 e cupom inativável.
-- A regra é a mesma daquela fase: valor fora do vocabulário é IGNORADO
-- na exibição, nunca quebra a tela.
--
-- Semântica de `taxas` (decidida com o usuário): são as taxas que NÃO
-- estão cobertas pelo benefício — o consumidor lê "Não inclui: entrega".
-- ------------------------------------------------------------
alter table public.cupons
  add column if not exists taxas jsonb not null default '[]'::jsonb,
  add column if not exists formas_consumo jsonb not null default '[]'::jsonb;

comment on column public.cupons.taxas is
  'Fase 6: taxas NÃO cobertas pelo benefício — array de rótulos ("entrega","embalagem","servico"). Vocabulário canônico e saneamento em src/lib/cupom-campos.ts.';
comment on column public.cupons.formas_consumo is
  'Fase 6: como o cupom pode ser consumido — array de rótulos ("local","delivery","retirada"). Vazio = não informado.';

-- ------------------------------------------------------------
-- ILIMITADO POR USUÁRIO — NULL, o mesmo vocabulário de limite_total.
--
-- `limite_total int` já é nullable e NULL já significa "sem teto"
-- (o seed usa isso em 10 dos 12 cupons, e `ativar_cupom` já testa
-- `is not null` antes de contar). `limite_por_usuario` era
-- `not null default 1` — não havia como dizer "ilimitado".
--
-- Alinhar os dois no MESMO vocabulário evita inventar um terceiro
-- (booleano separado, ou sentinela tipo -1) que precisaria ser mantido
-- em sincronia com o inteiro. O default 1 continua: cupom criado sem
-- dizer nada segue com 1 uso por pessoa, como sempre foi.
--
-- NÃO HÁ BACKFILL, e isso é regra e não acaso: se esta migration
-- pusesse algum cupom existente em NULL, todo consumidor que já validou
-- aquele cupom veria o selo "Utilizado" mentiroso enquanto o código
-- antigo estivesse no ar (ele lê `restantes > 0`, e NULL > 0 é false).
-- ------------------------------------------------------------
alter table public.cupons
  alter column limite_por_usuario drop not null;

comment on column public.cupons.limite_por_usuario is
  'Usos por pessoa. NULL = ilimitado (mesmo vocabulário de limite_total). Default 1.';

-- ------------------------------------------------------------
-- PRAZO DE ATIVAÇÃO — mínimo de 5h, no banco.
--
-- A regra vive na `criarCupomAction`, mas a action não é o único
-- caminho: `prazo_ativacao_horas` ESTÁ no grant de UPDATE por coluna da
-- Fase 3, então o lojista pode `PATCH /rest/v1/cupons` direto e gravar
-- 1h — e um cupom com 1h de prazo é um cupom que o consumidor perde
-- (era exatamente a classe de problema que a Fase 5 atacou na janela).
-- O CHECK fecha esse caminho.
--
-- `not valid` + `validate` em dois passos de propósito: o `validate`
-- varre as linhas existentes e FALHA ALTO se alguma violar, em vez de
-- a migration passar e a regra ficar valendo só para linha nova. No
-- hospedado isso é o gate — se reprovar, o push para antes de aplicar
-- (ver o baseline somente-leitura em scripts/_baseline-hosted.ts).
-- ------------------------------------------------------------
alter table public.cupons
  add constraint cupons_prazo_ativacao_min
  check (prazo_ativacao_horas >= 5) not valid;

alter table public.cupons validate constraint cupons_prazo_ativacao_min;

-- ------------------------------------------------------------
-- GRANTS — colunas novas NÃO herdam o grant por coluna da Fase 3.
--
-- `20260721120100_fase3_cupons_grants.sql` fez `revoke update on table`
-- + `grant update (lista)`. Coluna criada DEPOIS fica de fora da lista,
-- então sem isto o lojista não consegue editar taxas/formas nem pelo
-- caminho legítimo. (E é por isso que `publicado_em`, criada na Fase 4,
-- segue corretamente fora — só a RPC de aprovação a escreve.)
--
-- `limite_por_usuario` já estava na lista; não precisa ser re-concedida.
-- ------------------------------------------------------------
grant update (taxas, formas_consumo) on public.cupons to authenticated;
