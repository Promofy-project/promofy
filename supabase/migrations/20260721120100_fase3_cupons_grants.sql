-- ============================================================
-- Promofy — Fase 3 · Migration 9: grant por coluna em cupons
--   (correção de segurança — fecha o auto-approve pelo lojista)
--
-- PROBLEMA: a policy "cupons: lojista atualiza os proprios" (Fase 1)
-- permite UPDATE de QUALQUER coluna do próprio cupom, e cupons — ao
-- contrário de estabelecimentos — NÃO tinha grant por coluna. Logo o
-- lojista podia `PATCH /rest/v1/cupons?id=eq.<seu-cupom> {status:ativo}`
-- e AUTO-APROVAR o próprio cupom pendente (ou reverter um rejeitado),
-- contornando toda a moderação do admin.
--
-- CORREÇÃO (espelha estabelecimentos, migration 3): revoke de tabela +
-- grant por coluna, EXCLUINDO `status` e `estabelecimento_id`. A mudança
-- de status passa a ser exclusiva das RPCs security definer de admin
-- (aprovar_cupom/rejeitar_cupom). O lojista segue editando o conteúdo do
-- próprio cupom (título, benefício, economia, validade, limites, etc.).
--
-- (revoke por coluna é no-op no Postgres quando há grant de tabela — por
--  isso revoga-se a tabela inteira e concede-se coluna a coluna.)
-- ============================================================

revoke update on table public.cupons from authenticated, anon;

grant update (
  titulo,
  categoria_id,
  beneficio,
  economia,
  preco_de,
  preco_por,
  validade_inicio,
  validade_fim,
  ocultar_ate_inicio,
  limite_total,
  limite_por_usuario,
  prazo_ativacao_horas,
  regras,
  horarios,
  destaque,
  distancia_km,
  imagem,
  ordem,
  rating,
  avaliacoes,
  atualizado_em
) on public.cupons to authenticated;
