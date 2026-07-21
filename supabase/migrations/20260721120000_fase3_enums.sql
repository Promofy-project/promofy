-- ============================================================
-- Promofy — Fase 3 · Migration 8: enums da moderação
--
-- Adiciona 'rejeitado' a status_cupom (cupom recusado pelo admin).
-- ISOLADO do uso (mesmo padrão de fase2_enums): `ALTER TYPE ADD VALUE`
-- não pode ser usado na MESMA transação em que é adicionado — as RPCs
-- e leituras que referenciam 'rejeitado' vivem em migrations/código
-- posteriores.
--
-- 'rejeitado' NÃO reaproveita 'indisponivel': a policy pública
-- ("cupons: publico le visiveis de estabelecimento ativo") exige
-- status in ('ativo','indisponivel'), então 'indisponivel' APARECE no
-- catálogo. 'rejeitado' fica fora → invisível ao público, como deve.
-- ============================================================

alter type public.status_cupom add value if not exists 'rejeitado';
