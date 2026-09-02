-- ============================================================
-- Promofy — CLIENT-RETURNS-01 · logo do estabelecimento
--
-- O portal lia o estabelecimento da sessão (honesto) mas não gravava
-- nada. `nome` e `cidade` já eram graváveis (grant da migration 12).
-- Faltava um lugar para a LOGO: a coluna não existia, e o bucket
-- `cupom-imagens` já isola por pasta `<estabelecimento_id>/`.
--
-- Reusar o bucket NÃO é gambiarra: o path é o mesmo contrato de
-- `cupons.imagem` (`<estab_id>/<32 hex>.<ext>`), as policies de
-- insert/select/delete já são por dono, e `urlPublicaImagem` valida
-- o prefixo. Sem bucket novo, sem policy nova, sem URL solta.
--
-- Galeria (várias fotos do local/produto) NÃO entra aqui: exigiria
-- ordem, legenda e distinção lugar×produto — modelagem própria.
-- ============================================================

alter table public.estabelecimentos
  add column if not exists logo text not null default '';

comment on column public.estabelecimentos.logo is
  'Caminho no bucket cupom-imagens, mesmo formato de cupons.imagem: <estab_id>/<32 hex>.<ext>. Vazio = sem logo.';

-- Grant acumulativo (o de nome/cidade já existe). Sem isto o UPDATE
-- via PostgREST do lojista ignoraria a coluna nova em silêncio.
grant update (logo) on public.estabelecimentos to authenticated;
