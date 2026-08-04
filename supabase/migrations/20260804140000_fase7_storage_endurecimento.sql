-- ============================================================
-- Promofy — Fase 7 · Migration 23: fecha dois furos da migration 22
--
-- Achados da revisão de segurança do próprio C4, ANTES de qualquer deploy.
-- Migration nova em vez de editar a 22 porque a 22 já foi aplicada (no QA), e
-- `db push` não reaplica versão já registrada — editar deixaria os ambientes
-- divergentes em silêncio, que é pior do que uma migration a mais.
--
-- ------------------------------------------------------------
-- FURO 1 (ALTO) — DELETE + INSERT burla a remoderação
-- ------------------------------------------------------------
-- A 22 removeu a policy de UPDATE argumentando que, sem ela, "o único jeito de
-- mudar o que o consumidor vê é escrever `cupons.imagem`". A afirmação estava
-- ERRADA: ela cobre a sobrescrita, não o par apagar+recriar.
--
-- O lojista fala Storage REST direto com o próprio JWT (a ANON_KEY está no
-- bundle). Então:
--   1. sobe foto, cupom é aprovado e fica `ativo`;
--   2. DELETE do objeto  (permitido: "dono apaga");
--   3. INSERT na MESMA chave com outros bytes  (permitido: "dono sobe").
-- `cupons.imagem` nunca muda → `checar_edicao_cupom` não dispara → o cupom
-- segue `ativo` e o consumidor passa a ver conteúdo que ninguém moderou.
-- `upsert:false` não protege: é flag do cliente, não controle de servidor.
--
-- CORREÇÃO: o DELETE passa a exigir que o objeto NÃO esteja referenciado por um
-- cupom já moderado. Os usos legítimos continuam:
--   * limpar arquivo órfão de um insert que falhou → não referenciado, apaga;
--   * trocar a imagem → sobe chave NOVA e grava em `cupons.imagem` (o que
--     dispara o trigger e rebaixa para `pendente`); a chave antiga deixa de ser
--     referenciada e só então pode ser apagada.
--
-- ------------------------------------------------------------
-- FURO 2 (MÉDIO) — a forma do nome só era garantida pela Action
-- ------------------------------------------------------------
-- `PATH_IMAGEM_RE` vivia só em `src/lib/imagem-cupom.ts`, e a Action não é
-- fronteira de confiança para quem fala HTTP. A policy de INSERT exigia apenas
-- pasta própria e um nível — nada sobre o nome. Um lojista podia guardar
-- qualquer blob de 2 MiB em `<sua-pasta>/qualquer-coisa.bin`, público para
-- sempre e nunca referenciado por cupom nenhum: hospedagem grátis sob o domínio
-- do projeto, invisível para a moderação.
--
-- Não é XSS — `allowed_mime_types` mantém a resposta em `image/*` e SVG está
-- fora —, mas é abuso de marca. A regex vai para o banco, que é a fronteira.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.schemata where schema_name = 'storage'
  ) then
    raise notice 'Fase 7/M23: schema `storage` ausente — endurecimento nao aplicado (local sem storage).';
    return;
  end if;

  -- Helper `security definer`: a policy precisa enxergar cupons de QUALQUER
  -- dono para decidir. Sob RLS o lojista só veria os seus, e um objeto
  -- referenciado por cupom alheio pareceria livre — falha para o lado errado.
  execute $f$
    create or replace function private.imagem_de_cupom_moderado(p_name text)
    returns boolean
    language sql
    security definer stable set search_path = ''
    as $body$
      select exists (
        select 1 from public.cupons c
        where c.imagem = p_name
          -- `pendente` e `rejeitado` não estão no catálogo público: apagar a
          -- imagem deles não engana consumidor nenhum.
          and c.status not in ('pendente', 'rejeitado')
      );
    $body$
  $f$;
  execute 'revoke execute on function private.imagem_de_cupom_moderado(text) from public, anon';
  execute 'grant execute on function private.imagem_de_cupom_moderado(text) to authenticated';

  -- ---------- INSERT: agora exige a FORMA do nome ----------
  execute 'drop policy if exists "cupom-imagens: dono sobe" on storage.objects';
  execute $p$
    create policy "cupom-imagens: dono sobe"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'cupom-imagens'
        and array_length(storage.foldername(name), 1) = 1
        -- Espelha PATH_IMAGEM_RE de src/lib/imagem-cupom.ts. Duplicação
        -- deliberada: a Action valida para dar mensagem boa, o banco valida
        -- porque é a fronteira real.
        and name ~ '^[a-z0-9-]+/[0-9a-f]{32}\.(jpg|png|webp)$'
        and (
          (select private.owns_estabelecimento((storage.foldername(name))[1]))
          or (select private.is_admin())
        )
      )
  $p$;

  -- ---------- DELETE: não apaga imagem de cupom já moderado ----------
  execute 'drop policy if exists "cupom-imagens: dono apaga" on storage.objects';
  execute $p$
    create policy "cupom-imagens: dono apaga"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'cupom-imagens'
        and array_length(storage.foldername(name), 1) = 1
        and (
          (select private.owns_estabelecimento((storage.foldername(name))[1]))
          or (select private.is_admin())
        )
        -- O admin passa: moderação e correção operacional precisam alcançar.
        and (
          (select private.is_admin())
          or not (select private.imagem_de_cupom_moderado(name))
        )
      )
  $p$;

  raise notice 'Fase 7/M23: INSERT exige a forma do nome; DELETE nao alcanca imagem de cupom moderado.';
end
$$;
