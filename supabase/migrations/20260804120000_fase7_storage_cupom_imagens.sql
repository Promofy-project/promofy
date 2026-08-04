-- ============================================================
-- Promofy — Fase 7 · Migration 22: bucket de imagens do cupom (C4)
--
-- GUARDA NO TOPO, E POR QUÊ
--
-- O `[storage]` local está DESLIGADO: o gate da Fase 7 mediu que o CLI 2.111.0
-- puxa o mesmo `storage-api:v1.67.8` cujo healthcheck derruba o stack, o que
-- quebraria o `db:reset` — primeiro passo do `npm run verify`. Sem storage, o
-- schema `storage` nem existe, e um `insert into storage.buckets` cru abortaria
-- TODA migration local. Daí o bloco só rodar quando o schema existe.
--
-- Isso NÃO cria um buraco silencioso: a suíte `test:fase7:storage` assere
-- bucket E policies no projeto de QA. Se o schema existir e as policies não,
-- ela falha alto — em vez de o upload ficar aberto sem ninguém notar.
--
-- A PASTA É O ESTABELECIMENTO, NÃO O CUPOM
--
-- Mudança em relação ao desenho da Fase 6.5. Com `<cupom_id>/`, o predicado
-- precisaria de uma subquery em `cupons` e o upload exigiria que o cupom já
-- existisse — o que forçava criar → subir → PATCH, e esse PATCH dispara o
-- trigger da migration 20 gravando um `editado_material` espúrio em todo cupom
-- novo com imagem. Com `<estabelecimento_id>/` o predicado é direto e o upload
-- acontece ANTES do insert, então `imagem` entra no mesmo INSERT.
--
-- NÃO EXISTE POLICY DE UPDATE. É DELIBERADO.
--
-- Achado da revisão adversarial desta fase, e é o buraco que a pasta por
-- estabelecimento abriria se ignorado: com UPDATE liberado, o lojista
-- sobrescreveria os BYTES do caminho que um cupom ATIVO referencia. Como
-- `cupons.imagem` não mudaria, o trigger não dispararia, e a imagem que o
-- consumidor vê num cupom aprovado trocaria SEM remoderação — anulando a
-- moderação de imagem inteira.
--
-- Com UPDATE negado por ausência de policy (RLS nega por padrão) + nome
-- aleatório novo a cada upload + `upsert: false` na Action, o único jeito de
-- mudar o que o consumidor vê é escrever `cupons.imagem` — que dispara o
-- trigger e rebaixa `ativo → pendente`. DELETE fica, para limpar o arquivo
-- substituído.
--
-- POR QUE O SELECT NÃO FICA ABERTO (achado herdado da 6.5)
--
-- Em bucket público a LEITURA da imagem é servida por `/object/public` e não
-- passa por RLS. A policy de SELECT governa a LISTAGEM (`.list()`). Liberá-la
-- não compra nada para a exibição e publica o índice: com a ANON_KEY (que está
-- no bundle), qualquer um faria `.list('')` e receberia os caminhos de imagens
-- de cupons `pendente`/`rejeitado` de outros lojistas, que a RLS de `cupons`
-- esconde. O hash de 32 hex não é a credencial — é a segunda barreira; a
-- primeira é a listagem ser fechada.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.schemata where schema_name = 'storage'
  ) then
    raise notice
      'Fase 7/C4: schema `storage` ausente — bucket e policies NAO aplicados. '
      'Esperado no ambiente local ([storage] desligado pelo gate). '
      'No hospedado/QA isto indicaria Storage desabilitado no projeto.';
    return;
  end if;

  -- ---------- BUCKET ----------
  -- Idempotente: o bucket NAO sobrevive a um `db reset` local (o CLI o recria
  -- a partir do config.toml), mas no hospedado ele persiste — e a migration
  -- pode reaplicar.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'cupom-imagens',
    'cupom-imagens',
    true,
    2097152,                                          -- 2 MiB
    array['image/jpeg', 'image/png', 'image/webp']    -- SVG jamais: carrega script
  )
  on conflict (id) do update set
    public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  -- ---------- POLICIES ----------
  -- O MESMO predicado nas tres operacoes permitidas. `array_length = 1` exige
  -- a forma exata `<estabelecimento>/<arquivo>`: sem objeto na raiz do bucket
  -- (onde foldername devolve vazio e o dono seria indefinido) e sem subpastas.
  execute 'drop policy if exists "cupom-imagens: dono lista" on storage.objects';
  execute $p$
    create policy "cupom-imagens: dono lista"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'cupom-imagens'
        and array_length(storage.foldername(name), 1) = 1
        and (
          (select private.owns_estabelecimento((storage.foldername(name))[1]))
          or (select private.is_admin())
        )
      )
  $p$;

  execute 'drop policy if exists "cupom-imagens: dono sobe" on storage.objects';
  execute $p$
    create policy "cupom-imagens: dono sobe"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'cupom-imagens'
        and array_length(storage.foldername(name), 1) = 1
        and (
          (select private.owns_estabelecimento((storage.foldername(name))[1]))
          or (select private.is_admin())
        )
      )
  $p$;

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
      )
  $p$;

  -- UPDATE: nenhuma policy, de proposito (ver cabecalho). Se alguem um dia
  -- adicionar uma, a suite falha — ela assere a AUSENCIA, nao so a presenca
  -- das outras tres.
  execute 'drop policy if exists "cupom-imagens: dono troca" on storage.objects';

  raise notice 'Fase 7/C4: bucket cupom-imagens e 3 policies (select/insert/delete) aplicados.';
end
$$;
