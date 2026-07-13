-- ============================================================
-- Promofy — Fase 2 · Migration 5: novos valores de enum
--
-- Arquivo separado de propósito: um valor adicionado por
-- ALTER TYPE ... ADD VALUE não pode ser USADO na mesma transação
-- em que nasce — as migrations seguintes (e o runtime) já o veem.
-- ============================================================

-- Moderação de cupom: novo cupom do lojista nasce 'pendente';
-- o admin aprova na Fase 3. A policy pública da Fase 1 já esconde
-- qualquer status fora de ('ativo','indisponivel').
alter type public.status_cupom add value if not exists 'pendente';

-- Lançamento de bônus no ledger de pontos (ex.: bônus de boas-vindas
-- do usuário de demonstração).
alter type public.acao_pontos add value if not exists 'bonus';
