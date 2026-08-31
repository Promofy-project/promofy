-- ============================================================
-- Promofy — MARCO 2B · CONTRACT da taxonomia (14x75)
--
-- Migration NOVA, posterior a 20260831120000. NÃO edita nenhuma das oito
-- migrations anteriores da cadeia de taxonomia — todas continuam
-- imutáveis. NÃO dropa, NÃO renomeia, NÃO faz cleanup físico do legado.
--
-- CONTEXTO: Marco 2A (120000) foi hospedada, o runtime novo (14x75) está
-- em produção — merge SHA 038fac47cc2ace7f471c6de6b5658382d391e41b (PR
-- #8), deployment dpl_8mhXYvQhQPUTR2PGmmeGMSG2LGt3 READY — e o smoke de
-- produção provou o caminho novo: INSERT authenticated com
-- categoria_nova_id UUID (categoria_id legado NULL), recategorização
-- Restaurante→Pizzaria, moderacao_historico com editado_material. O
-- write-freeze deliberado do bridge está encerrado. Esta é a migration de
-- CONTRACT que o comentário da 120000 previu e deliberadamente NÃO criou
-- antes de agora — a guarda em scripts/test-m2-cutover.ts (item 40c) que
-- falhava se este arquivo aparecesse antes do smoke passar cumpriu seu
-- papel e foi invertida (agora prova que o arquivo EXISTE).
--
-- Esta migration existe só LOCALMENTE até aqui — NÃO foi hospedada, não
-- passou por `supabase db push --linked`, e nada neste trabalho escreveu
-- no Supabase hospedado. Hospedar é decisão de uma fase seguinte, com OK
-- explícito, passo a passo (mesmo fluxo do CLAUDE.md §2).
--
-- O QUE ELA FAZ:
--   A. cupons.categoria_nova_id → NOT NULL. O CONTRACT principal: todo
--      INSERT de cupom, de qualquer papel — inclusive service_role —
--      passa a exigir folha. Até aqui a exigência para anon/authenticated
--      vivia só no trigger checar_categoria_nova_cupom (120000, que
--      isentava service_role de propósito, por ele nunca ser canal da
--      aplicação publicada nesta casa — CLAUDE.md). A partir desta
--      migration a exigência vira também uma constraint física de coluna,
--      que não distingue papel: a isenção do trigger para service_role
--      continua existindo (o trigger não muda), mas deixa de ser a única
--      barreira — a constraint fecha o gap por trás dela. cupons.
--      categoria_id LEGADO não muda: continua nullable, congelado pelo
--      trigger da 120000, rede de rollback até o Marco 3.
--
--   B. cupom_eventos.categoria_id → NOT NULL.
--   C. cupons_usuario.categoria_id → NOT NULL.
--      B e C só são seguros PORQUE A aconteceu primeiro, nesta mesma
--      migration: o trigger que captura o snapshot
--      (capturar_categoria_nova_evento / capturar_categoria_nova_uso,
--      170000) SEMPRE deriva de cupons.categoria_nova_id, incondicional,
--      via `select ... into new.categoria_id from public.cupons where
--      id = new.cupom_id` — e cupom_id é `not null references
--      public.cupons(id) on delete cascade` nas duas tabelas (schema
--      inicial), então todo INSERT de fato/uso aponta para um cupom que
--      existe. Com A em vigor, esse cupom SEMPRE tem categoria_nova_id
--      preenchida — logo não sobra caminho legítimo para o snapshot
--      nascer NULL. A decisão registrada em MIGRATIONS.md/120000
--      ("cupom_eventos.categoria_id continua NULL — [...] um NOT NULL não
--      adicionaria garantia, só um modo de falha novo") estava CORRETA
--      naquele momento: foi escrita quando categoria_nova_id AINDA era
--      nullable, e o risco que ela citava — evento/ativação caindo porque
--      o cupom-fonte não tinha folha ainda — é exatamente o risco que A
--      elimina na origem. Este contract não contradiz aquela decisão,
--      supera a premissa dela.
--
-- O QUE ELA DELIBERADAMENTE NÃO FAZ:
--   · NÃO toca cupons.categoria_id (legado) — continua nullable,
--     congelada pelo trigger da 120000, rede de rollback até o Marco 3.
--   · NÃO toca estabelecimentos.categoria_principal_id — continua
--     nullable. Busca estrutural por `.from("estabelecimentos").insert`
--     em `src/` não encontrou NENHUM caminho de código que crie
--     estabelecimento (só `supabase/seed.sql`, que roda como `postgres`,
--     fora de qualquer grant/RLS). Forçar NOT NULL aqui protegeria um
--     fluxo que não existe no runtime — decisão especulativa demais para
--     este contract. Revisitar quando/se onboarding de estabelecimento
--     nascer.
--   · NÃO dropa nem renomeia public.categorias, estabelecimento_categorias,
--     categorias_novas, cupons.categoria_id, categoria_nova_id. Legado
--     inteiro continua no banco.
--   · NÃO simplifica nem remove checar_categoria_nova_cupom — continua
--     sendo a autoridade de NEGÓCIO (membership no conjunto do
--     estabelecimento, folha ativa, proibição de limpar UUID→NULL via
--     API). A constraint física é defesa em profundidade sobre um
--     invariante mais estreito (a coluna não pode estar vazia), não
--     substituição do trigger.
-- ============================================================


-- ============================================================
-- 1. PRECONDITIONS — fail-high, antes de qualquer DDL
--
-- Estruturais (mesma doutrina da 120000): a pergunta é "toda linha tem
-- categoria?", não "há N linhas?". Os totais de hoje entram só como
-- `raise notice` — baseline observável, nunca contrato. As duas únicas
-- contagens exatas são as do CATÁLOGO (14 segmentos / 75 folhas), porque
-- vêm da TX-P2C e são idênticas em local e hospedado.
-- ============================================================
do $$
declare
  v_segmentos int;
  v_folhas int;
  v_cupons int;
  v_cupons_sem_folha int;
  v_cupom_fora_do_join int;
  v_eventos int;
  v_eventos_com_snapshot int;
  v_eventos_orfaos int;
  v_usos int;
  v_usos_com_snapshot int;
  v_usos_orfaos int;
begin
  select count(*) into v_segmentos from public.segmentos;
  if v_segmentos <> 14 then
    raise exception 'M2 contract: segmentos = %, esperado 14 (catálogo da TX-P2C). Abortando.', v_segmentos;
  end if;

  select count(*) into v_folhas from public.categorias_novas;
  if v_folhas <> 75 then
    raise exception 'M2 contract: categorias_novas = %, esperado 75 (catálogo da TX-P2C). Abortando.', v_folhas;
  end if;

  -- ---------- cupons: pronto para o CONTRACT (A) ----------
  select count(*) into v_cupons from public.cupons;

  select count(*) into v_cupons_sem_folha
    from public.cupons where categoria_nova_id is null;
  if v_cupons_sem_folha <> 0 then
    raise exception 'M2 contract: % cupom(ns) sem categoria_nova_id — SET NOT NULL falharia. Classifique-os antes de aplicar esta migration. Abortando.', v_cupons_sem_folha;
  end if;

  select count(*) into v_cupom_fora_do_join
    from public.cupons c
   where c.categoria_nova_id is not null
     and not exists (
       select 1 from public.estabelecimento_categorias_novas ecn
        where ecn.estabelecimento_id = c.estabelecimento_id
          and ecn.categoria_id = c.categoria_nova_id
     );
  if v_cupom_fora_do_join <> 0 then
    raise exception 'M2 contract: % cupom(ns) com categoria_nova_id fora da junção nova do próprio estabelecimento. Abortando.', v_cupom_fora_do_join;
  end if;

  -- ---------- cupom_eventos: pronto para o CONTRACT (B) ----------
  select count(*), count(categoria_id) into v_eventos, v_eventos_com_snapshot
    from public.cupom_eventos;
  if v_eventos <> v_eventos_com_snapshot then
    raise exception 'M2 contract: % de % linha(s) de cupom_eventos sem snapshot de categoria — SET NOT NULL falharia. Abortando.',
      v_eventos - v_eventos_com_snapshot, v_eventos;
  end if;

  select count(*) into v_eventos_orfaos
    from public.cupom_eventos ev
   where ev.categoria_id is not null
     and not exists (select 1 from public.categorias_novas cn where cn.id = ev.categoria_id);
  if v_eventos_orfaos <> 0 then
    raise exception 'M2 contract: % snapshot(s) de cupom_eventos apontando para folha inexistente. Abortando.', v_eventos_orfaos;
  end if;

  -- ---------- cupons_usuario: pronto para o CONTRACT (C) ----------
  select count(*), count(categoria_id) into v_usos, v_usos_com_snapshot
    from public.cupons_usuario;
  if v_usos <> v_usos_com_snapshot then
    raise exception 'M2 contract: % de % linha(s) de cupons_usuario sem snapshot de categoria — SET NOT NULL falharia. Abortando.',
      v_usos - v_usos_com_snapshot, v_usos;
  end if;

  select count(*) into v_usos_orfaos
    from public.cupons_usuario cu
   where cu.categoria_id is not null
     and not exists (select 1 from public.categorias_novas cn where cn.id = cu.categoria_id);
  if v_usos_orfaos <> 0 then
    raise exception 'M2 contract: % snapshot(s) de cupons_usuario apontando para folha inexistente. Abortando.', v_usos_orfaos;
  end if;

  raise notice 'M2 contract preconditions OK. BASELINE (observação, NÃO contrato): segmentos=%, folhas=%, cupons=%, cupom_eventos=%, cupons_usuario=%.',
    v_segmentos, v_folhas, v_cupons, v_eventos, v_usos;
end;
$$;


-- ============================================================
-- 2. DDL — NOT VALID + VALIDATE + SET NOT NULL (mesmo padrão de duas
-- etapas da 20260802120000/cupons_prazo_ativacao_min): o VALIDATE varre
-- as linhas existentes e falha alto se alguma violar; e, com uma CHECK
-- já validada cobrindo a coluna, o SET NOT NULL subsequente não precisa
-- varrer a tabela de novo (otimização do Postgres desde a 12) — o que
-- importa aqui e no hospedado futuro, quando cupom_eventos já não terá
-- só 20508 linhas. A CHECK temporária é descartada depois de SET NOT
-- NULL, que já é a garantia definitiva.
-- ============================================================

-- ---------- A. cupons.categoria_nova_id ----------
alter table public.cupons
  add constraint cupons_categoria_nova_id_not_null
  check (categoria_nova_id is not null) not valid;
alter table public.cupons
  validate constraint cupons_categoria_nova_id_not_null;
alter table public.cupons
  alter column categoria_nova_id set not null;
alter table public.cupons
  drop constraint cupons_categoria_nova_id_not_null;

-- ---------- B. cupom_eventos.categoria_id ----------
alter table public.cupom_eventos
  add constraint cupom_eventos_categoria_id_not_null
  check (categoria_id is not null) not valid;
alter table public.cupom_eventos
  validate constraint cupom_eventos_categoria_id_not_null;
alter table public.cupom_eventos
  alter column categoria_id set not null;
alter table public.cupom_eventos
  drop constraint cupom_eventos_categoria_id_not_null;

-- ---------- C. cupons_usuario.categoria_id ----------
alter table public.cupons_usuario
  add constraint cupons_usuario_categoria_id_not_null
  check (categoria_id is not null) not valid;
alter table public.cupons_usuario
  validate constraint cupons_usuario_categoria_id_not_null;
alter table public.cupons_usuario
  alter column categoria_id set not null;
alter table public.cupons_usuario
  drop constraint cupons_usuario_categoria_id_not_null;

-- ---------- comentários atualizados (a coluna muda de contrato; o texto
-- "shadow, STAGING" / "NULL até classificado" da 160000/170000 deixou de
-- descrever o estado real). Redefinir o comentário aqui NÃO edita o
-- arquivo daquelas migrations — é uma nova instrução `comment on`, como
-- de costume neste repositório. ----------
comment on column public.cupons.categoria_nova_id is
  'MARCO 2B (CONTRACT): categoria folha UUID — autoridade do runtime desde o Marco 2A, agora fisicamente NOT NULL (todo cupom, de qualquer papel, precisa de folha no INSERT). cupons.categoria_id (legado) permanece nullable, congelada, rede de rollback até o Marco 3.';

comment on column public.cupom_eventos.categoria_id is
  'MARCO 2B (CONTRACT): snapshot da categoria folha do cupom NO MOMENTO do evento — agora NOT NULL, porque cupons.categoria_nova_id (a fonte que trg_cupom_eventos_capturar_categoria sempre lê) também é NOT NULL desde esta migration, fechando a única origem legítima de snapshot NULL. Capturado automaticamente no INSERT, nunca depende do caller. Imutável depois de preenchido (trg_cupom_eventos_categoria_imutavel): UUID→outro UUID nunca.';

comment on column public.cupons_usuario.categoria_id is
  'MARCO 2B (CONTRACT): snapshot da categoria folha do cupom NO MOMENTO da ativação/uso — agora NOT NULL, mesmo contrato de cupom_eventos.categoria_id (ver comentário lá). Capturado automaticamente, imutável depois de preenchido.';

comment on function public.checar_categoria_nova_cupom() is
  'MARCO 1 (+ MARCO 2A HARDENING FINAL + MARCO 2B CONTRACT): valida categoria_nova_id do cupom contra estabelecimento_categorias_novas + ativo, só quando o campo está sendo definido/alterado (nunca retroativo). INSERT de anon/authenticated exige categoria_nova_id preenchida; service_role continua isento DESTE trigger especificamente (não é canal da aplicação publicada nesta casa), mas desde o Marco 2B (20260831130000) a coluna cupons.categoria_nova_id é fisicamente NOT NULL — a isenção do trigger deixou de ser a única barreira para service_role, que agora esbarra na constraint de coluna como qualquer outro papel. Nenhum papel via API (service_role incluído) pode limpar um categoria_nova_id já definido de volta para NULL — esta parte não mudou.';


-- ============================================================
-- 3. POSTCONDITIONS — fail-high, depois do DDL
-- ============================================================
do $$
declare
  v_nullable_cupons text;
  v_nullable_eventos text;
  v_nullable_usuario text;
  v_nullable_cupons_legado text;
  v_nullable_principal text;
  v_cupons_null int;
  v_eventos_null int;
  v_usuario_null int;
  v_segmentos int;
  v_folhas int;
  v_join int;
  v_legado_categorias_existe boolean;
  v_legado_estab_categorias_existe boolean;
  v_categorias_novas_existe boolean;
  v_estab_categorias_novas_existe boolean;
  v_legado_categorias int;
  v_legado_estab_categorias int;
begin
  select is_nullable into v_nullable_cupons
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cupons' and column_name = 'categoria_nova_id';
  if v_nullable_cupons <> 'NO' then
    raise exception 'M2 contract postcondition: cupons.categoria_nova_id is_nullable = % (esperado NO). Abortando.', v_nullable_cupons;
  end if;

  select is_nullable into v_nullable_eventos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cupom_eventos' and column_name = 'categoria_id';
  if v_nullable_eventos <> 'NO' then
    raise exception 'M2 contract postcondition: cupom_eventos.categoria_id is_nullable = % (esperado NO). Abortando.', v_nullable_eventos;
  end if;

  select is_nullable into v_nullable_usuario
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cupons_usuario' and column_name = 'categoria_id';
  if v_nullable_usuario <> 'NO' then
    raise exception 'M2 contract postcondition: cupons_usuario.categoria_id is_nullable = % (esperado NO). Abortando.', v_nullable_usuario;
  end if;

  -- legado continua exatamente como estava: existe, nullable, intocado.
  select is_nullable into v_nullable_cupons_legado
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cupons' and column_name = 'categoria_id';
  if v_nullable_cupons_legado <> 'YES' then
    raise exception 'M2 contract postcondition: cupons.categoria_id (legado) is_nullable = % (esperado YES — não deveria ter mudado). Abortando.', v_nullable_cupons_legado;
  end if;

  -- estabelecimentos.categoria_principal_id: esta migration DELIBERADAMENTE
  -- não toca esta coluna (ver cabeçalho, "O QUE ELA DELIBERADAMENTE NÃO
  -- FAZ") — não existe fluxo de criação de estabelecimento em src/. Prova
  -- estrutural de que continua nullable, não só uma afirmação em comentário.
  select is_nullable into v_nullable_principal
    from information_schema.columns
   where table_schema = 'public' and table_name = 'estabelecimentos' and column_name = 'categoria_principal_id';
  if v_nullable_principal <> 'YES' then
    raise exception 'M2 contract postcondition: estabelecimentos.categoria_principal_id is_nullable = % (esperado YES — não deveria ter mudado). Abortando.', v_nullable_principal;
  end if;

  select count(*) into v_cupons_null from public.cupons where categoria_nova_id is null;
  if v_cupons_null <> 0 then
    raise exception 'M2 contract postcondition: % cupom(ns) com categoria_nova_id NULL depois do SET NOT NULL — impossível, mas fail-high mesmo assim.', v_cupons_null;
  end if;

  select count(*) into v_eventos_null from public.cupom_eventos where categoria_id is null;
  if v_eventos_null <> 0 then
    raise exception 'M2 contract postcondition: % linha(s) de cupom_eventos com categoria_id NULL depois do SET NOT NULL.', v_eventos_null;
  end if;

  select count(*) into v_usuario_null from public.cupons_usuario where categoria_id is null;
  if v_usuario_null <> 0 then
    raise exception 'M2 contract postcondition: % linha(s) de cupons_usuario com categoria_id NULL depois do SET NOT NULL.', v_usuario_null;
  end if;

  -- catálogo e legado: nada disso deveria ter sido tocado por esta migration.
  select count(*) into v_segmentos from public.segmentos;
  select count(*) into v_folhas from public.categorias_novas;
  if v_segmentos <> 14 or v_folhas <> 75 then
    raise exception 'M2 contract postcondition: catálogo mudou (segmentos=%, folhas=%; esperado 14/75). Abortando.', v_segmentos, v_folhas;
  end if;

  select count(*) into v_join from public.estabelecimento_categorias_novas;
  raise notice 'M2 contract postcondition (observação): estabelecimento_categorias_novas = % linhas.', v_join;

  -- Existência da TABELA, não contagem de linhas: categorias/
  -- estabelecimento_categorias são populadas por supabase/seed.sql, não
  -- por migration — em tempo de `db reset` elas estão legitimamente
  -- vazias neste ponto (mesmo raciocínio de "vazio satisfaz condição
  -- universal" da 120000), exatamente como cupons=0 na precondition acima.
  -- O que este contract garante é que a TABELA continua existindo — não
  -- foi dropada nem renomeada.
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'categorias'
  ) into v_legado_categorias_existe;
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'estabelecimento_categorias'
  ) into v_legado_estab_categorias_existe;
  if not v_legado_categorias_existe or not v_legado_estab_categorias_existe then
    raise exception 'M2 contract postcondition: legado (categorias existe=%, estabelecimento_categorias existe=%) — este contract NÃO deveria remover legado. Abortando.', v_legado_categorias_existe, v_legado_estab_categorias_existe;
  end if;

  -- mesma prova de existência para o lado NOVO da taxonomia — nem esta
  -- migration nem nenhuma anterior deveria ter removido nada aqui.
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'categorias_novas'
  ) into v_categorias_novas_existe;
  select exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'estabelecimento_categorias_novas'
  ) into v_estab_categorias_novas_existe;
  if not v_categorias_novas_existe or not v_estab_categorias_novas_existe then
    raise exception 'M2 contract postcondition: taxonomia nova (categorias_novas existe=%, estabelecimento_categorias_novas existe=%) — este contract NÃO deveria remover nenhuma estrutura. Abortando.', v_categorias_novas_existe, v_estab_categorias_novas_existe;
  end if;

  select count(*) into v_legado_categorias from public.categorias;
  select count(*) into v_legado_estab_categorias from public.estabelecimento_categorias;

  raise notice 'M2 contract postconditions OK. cupons.categoria_nova_id, cupom_eventos.categoria_id e cupons_usuario.categoria_id são NOT NULL. cupons.categoria_id e estabelecimentos.categoria_principal_id continuam nullable. Legado (categorias=%, estabelecimento_categorias=%) e taxonomia nova (categorias_novas, estabelecimento_categorias_novas) intactos.',
    v_legado_categorias, v_legado_estab_categorias;
end;
$$;
