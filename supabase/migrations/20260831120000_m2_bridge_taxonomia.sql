-- ============================================================
-- Promofy — MARCO 2A · BRIDGE do cutover de taxonomia (14x75)
--
-- Migration NOVA, posterior a 20260830170000. NAO edita nenhuma das sete
-- migrations anteriores da cadeia de taxonomia — todas continuam
-- imutaveis. NAO dropa, NAO renomeia e NAO apaga nada do legado.
--
-- O QUE ESTA MIGRATION E: a metade de BANCO do cutover. Ela nasce
-- ADITIVA de proposito — cada passo aqui e invisivel para o codigo que
-- esta publicado em producao HOJE, e ao mesmo tempo e tudo de que o
-- codigo NOVO precisa para existir. Por isso ela pode (e deve) ir ao ar
-- ANTES do deploy do runtime novo, cumprindo o "banco antes do codigo"
-- do CLAUDE.md sem abrir uma janela em que producao fica quebrada.
--
-- O CONTRATO REAL DA JANELA (HARDENING FINAL corrigiu a primeira versao
-- deste comentario, que dizia "o codigo antigo sobrevive integralmente" —
-- isso NUNCA foi verdade para CRIACAO/RECATEGORIZACAO, e agora esta
-- explicitamente bloqueado, nao so "sobrevivendo por acidente"):
--
--   FUNCIONA sem mudanca nenhuma, entre esta migration hospedada e o
--   runtime novo em producao:
--     · leitura, discovery, navegacao (views P2A/legado intocadas);
--     · resgate/ativacao de cupom existente;
--     · edicao de cupom que NAO muda a categoria (checar_edicao_cupom
--       so trata categoria_nova_id como MATERIAL quando ela de fato
--       muda de valor — ver secao 5);
--     · leitura/escrita do restante do schema, sem relacao com categoria.
--
--   FICA TEMPORARIAMENTE BLOQUEADO, de proposito, so nesta janela:
--     · CRIAR cupom pelo runtime ANTIGO — checar_categoria_nova_cupom
--       (secao 4B) exige categoria_nova_id em todo INSERT de
--       anon/authenticated, e o codigo antigo nunca a preenche;
--     · MUDAR a categoria legada de um cupom via API — checar_
--       categoria_cupom (secao 4) recusa qualquer UPDATE que troque
--       categoria_id de valor (inclusive para NULL), para authenticated/
--       anon/service_role.
--
--   Motivo do bloqueio: nao existe informacao suficiente no modelo
--   ANTIGO para escolher, com seguranca, uma das 75 folhas novas — e
--   inventar essa escolha (de-para arbitrario) e proibido desde a secao
--   3. Isto e um WRITE-FREEZE DELIBERADO E CURTO (a janela entre esta
--   migration e o deploy do runtime novo, minimizada na publicacao),
--   nao um bug nem uma lacuna esquecida.
--
-- Como cada peca cumpre o resto do contrato (o que continua igual):
--   1. as tres views novas: ninguem as le ainda;
--   2. cupons.categoria_id vira nullable: o codigo antigo SEMPRE manda
--      valor num INSERT (o caso que a nulidade existe para servir e o do
--      runtime NOVO), entao a leitura/edicao-sem-categoria do antigo nao
--      muda;
--   3. checar_categoria_cupom ganha uma saida antecipada para NULL — o
--      caminho de EDICAO com valor preenchido e sem mudanca continua
--      validado como antes; so a MUDANCA de valor via API passou a ser
--      recusada (hardening final, secao 4);
--   4. checar_edicao_cupom passa a olhar TAMBEM categoria_nova_id, sem
--      deixar de olhar categoria_id: serve aos dois codigos ao mesmo
--      tempo para o que CONTINUA permitido (edicao sem trocar categoria);
--   5. os grants sao adicao, nunca remocao;
--   6. as policies novas de estabelecimento_categorias_novas espelham as
--      que a juncao LEGADA ja tem — e essa tabela o codigo antigo nao le.
--
-- O QUE ESTA MIGRATION DELIBERADAMENTE NAO FAZ:
--   · NAO poe cupons.categoria_nova_id em NOT NULL. Isso e o CONTRACT, e
--     o contract quebraria a criacao de cupom pelo codigo antigo, que nao
--     preenche a coluna. Ele nasce numa migration SEPARADA
--     (20260831130000) que AINDA NAO EXISTE, e so sera escrita depois de
--     (a) esta migration estar hospedada, (b) o runtime novo estar em
--     producao e (c) o smoke de producao passar. `supabase db push
--     --linked` aplica TODAS as migrations pendentes de uma vez — deixar
--     o contract pronto no diretorio significaria aplica-lo JUNTO com o
--     bridge, que e exatamente o que nao pode acontecer.
--   · NAO dropa public.categorias, estabelecimento_categorias,
--     cupons.categoria_id nem estabelecimentos.categoria_id. O legado
--     inteiro continua no banco como rede de rollback; cleanup fisico e
--     Marco 3.
--   · NAO toca as tres views da TX-P2A (catalogo_filtros,
--     catalogo_categorias, categoria_para_filtro). Elas continuam lendo o
--     legado e servindo o codigo publicado. E por isso que as views novas
--     sao TRES VIEWS NOVAS e nao um "create or replace" das antigas: o
--     modelo novo guarda `tema` (token) onde o antigo guarda `gradiente`
--     (CSS), a FORMA da relacao muda, e mudar a forma de uma view exige
--     DROP/CREATE — que derrubaria o codigo publicado no meio da janela.
--     Expandir, nunca contrair.
-- ============================================================


-- ============================================================
-- 1. PRECONDITIONS — fail-high, antes de qualquer DDL
--
-- Sao ESTRUTURAIS, nao contagens fotografadas. A pergunta certa nao e
-- "ha 14 cupons?" (isso e o baseline de hoje, e muda no primeiro cupom
-- que o cliente criar) e sim "TODO cupom tem folha?". Hardcodar o retrato
-- do hospedado aqui faria a migration falhar em qualquer ambiente que nao
-- fosse aquele instante — inclusive no `db reset` local, onde no momento
-- em que esta migration roda as tabelas de dado ainda estao VAZIAS (o
-- seed.sql so roda depois de TODAS as migrations).
--
-- Vazio satisfaz toda condicao universal abaixo, e esse e o comportamento
-- correto: nao ha nada incompleto quando nao ha nada. Os totais entram
-- como `raise notice` — baseline observavel, nunca contrato.
--
-- As DUAS unicas contagens exatas sao as do CATALOGO (14 segmentos / 75
-- folhas), porque esse dado nao vem de uso do cliente: vem da migration
-- TX-P2C, e existe identico em local e no hospedado.
-- ============================================================
do $$
declare
  v_segmentos int;
  v_folhas int;
  v_cupons int;
  v_cupons_sem_folha int;
  v_cupom_fora_do_join int;
  v_estab int;
  v_estab_sem_principal int;
  v_principal_fora_do_join int;
  v_eventos int;
  v_eventos_com_snapshot int;
  v_eventos_orfaos int;
  v_usos int;
  v_usos_com_snapshot int;
  v_usos_orfaos int;
begin
  -- ---------- catalogo: contrato exato (vem da TX-P2C) ----------
  select count(*) into v_segmentos from public.segmentos;
  if v_segmentos <> 14 then
    raise exception 'M2 bridge: segmentos = %, esperado 14 (catalogo da TX-P2C). Abortando.', v_segmentos;
  end if;

  select count(*) into v_folhas from public.categorias_novas;
  if v_folhas <> 75 then
    raise exception 'M2 bridge: categorias_novas = %, esperado 75 (catalogo da TX-P2C). Abortando.', v_folhas;
  end if;

  -- ---------- cupons: TODO cupom tem folha ----------
  select count(*) into v_cupons from public.cupons;

  select count(*) into v_cupons_sem_folha
    from public.cupons where categoria_nova_id is null;
  if v_cupons_sem_folha <> 0 then
    raise exception 'M2 bridge: % cupom(ns) sem categoria_nova_id — o runtime novo nao teria como renderiza-los. Abortando.', v_cupons_sem_folha;
  end if;

  -- ---------- cupons: a folha pertence ao conjunto do estabelecimento ----------
  -- Espelha checar_categoria_nova_cupom. O trigger garante isso para a
  -- linha NOVA; aqui a pergunta e sobre o acervo INTEIRO, que pode ter
  -- sido escrito antes de o trigger existir.
  select count(*) into v_cupom_fora_do_join
    from public.cupons c
   where c.categoria_nova_id is not null
     and not exists (
       select 1 from public.estabelecimento_categorias_novas ecn
        where ecn.estabelecimento_id = c.estabelecimento_id
          and ecn.categoria_id = c.categoria_nova_id
     );
  if v_cupom_fora_do_join <> 0 then
    raise exception 'M2 bridge: % cupom(ns) com categoria_nova_id fora da juncao nova do proprio estabelecimento. Abortando.', v_cupom_fora_do_join;
  end if;

  -- ---------- estabelecimentos: todos classificados ----------
  select count(*) into v_estab from public.estabelecimentos;

  select count(*) into v_estab_sem_principal
    from public.estabelecimentos where categoria_principal_id is null;
  if v_estab_sem_principal <> 0 then
    raise exception 'M2 bridge: % estabelecimento(s) sem categoria_principal_id. Abortando.', v_estab_sem_principal;
  end if;

  select count(*) into v_principal_fora_do_join
    from public.estabelecimentos e
   where e.categoria_principal_id is not null
     and not exists (
       select 1 from public.estabelecimento_categorias_novas ecn
        where ecn.estabelecimento_id = e.id
          and ecn.categoria_id = e.categoria_principal_id
     );
  if v_principal_fora_do_join <> 0 then
    raise exception 'M2 bridge: % principal(is) fora da juncao nova. Abortando.', v_principal_fora_do_join;
  end if;

  -- ---------- snapshots: completos e sem referencia orfa ----------
  -- `count(*) = count(coluna)` e a forma ESTRUTURAL de "nenhum NULL", sem
  -- citar 20508 nem 7 — numeros que crescem a cada evento registrado.
  select count(*), count(categoria_id) into v_eventos, v_eventos_com_snapshot
    from public.cupom_eventos;
  if v_eventos <> v_eventos_com_snapshot then
    raise exception 'M2 bridge: % de % linha(s) de cupom_eventos sem snapshot de categoria. Abortando.',
      v_eventos - v_eventos_com_snapshot, v_eventos;
  end if;

  select count(*) into v_eventos_orfaos
    from public.cupom_eventos ev
   where ev.categoria_id is not null
     and not exists (select 1 from public.categorias_novas cn where cn.id = ev.categoria_id);
  if v_eventos_orfaos <> 0 then
    raise exception 'M2 bridge: % snapshot(s) de cupom_eventos apontando para folha inexistente. Abortando.', v_eventos_orfaos;
  end if;

  select count(*), count(categoria_id) into v_usos, v_usos_com_snapshot
    from public.cupons_usuario;
  if v_usos <> v_usos_com_snapshot then
    raise exception 'M2 bridge: % de % linha(s) de cupons_usuario sem snapshot de categoria. Abortando.',
      v_usos - v_usos_com_snapshot, v_usos;
  end if;

  select count(*) into v_usos_orfaos
    from public.cupons_usuario cu
   where cu.categoria_id is not null
     and not exists (select 1 from public.categorias_novas cn where cn.id = cu.categoria_id);
  if v_usos_orfaos <> 0 then
    raise exception 'M2 bridge: % snapshot(s) de cupons_usuario apontando para folha inexistente. Abortando.', v_usos_orfaos;
  end if;

  raise notice 'M2 bridge preconditions OK. BASELINE (observacao, NAO contrato): segmentos=%, folhas=%, cupons=%, estabelecimentos=%, cupom_eventos=%, cupons_usuario=%.',
    v_segmentos, v_folhas, v_cupons, v_estab, v_eventos, v_usos;
end;
$$;


-- ============================================================
-- 2. AS TRES VIEWS NOVAS — a fronteira que o runtime novo consome
--
-- Espelham, uma a uma, a trinca da TX-P2A, e pela MESMA razao: o contrato
-- e uma RELACAO, nao um calculo. View entra no database.types.ts, compoe
-- com `.in()` do PostgREST, e com security_invoker herda a RLS que ja
-- existe nas tabelas base — sem funcao SECURITY DEFINER nova para
-- auditar. E o app React Native fala com este MESMO PostgREST: a heranca
-- visual (coalesce folha->segmento) resolvida AQUI e uma regra que o
-- nativo nao vai precisar reimplementar.
--
--   catalogo_segmentos   -> o que a UI OFERECE como filtro de descoberta
--   catalogo_folhas      -> as folhas que podem ser ATRIBUIDAS agora
--   folha_para_segmento  -> traducao e resolucao HISTORICA (nao filtra ativo)
--
-- ATIVO: a divisao e a que a TX-P2B ja documentava. `ativo` responde
-- "isto ainda deve ser OFERECIDO?", nunca "esta linha pode ser lida?".
-- As duas primeiras filtram; a terceira NAO — um cupom cuja folha foi
-- desativada depois precisa continuar resolvendo nome/icone/tema, senao
-- todo card historico cai no fallback cinza em silencio, que e
-- exatamente o modo de falha que a TX-P2A existe para impedir.
-- ============================================================

-- Catalogo de SEGMENTOS (chips de descoberta) ------------------
create view public.catalogo_segmentos
with (security_invoker = true) as
select
  s.slug  as slug,
  s.nome  as nome,
  s.icone as icone,
  s.tema  as tema,
  s.ordem as ordem
from public.segmentos s
where s.ativo;

comment on view public.catalogo_segmentos is
  'MARCO 2A: catalogo de SEGMENTOS — o que a descoberta publica oferece como filtro (`?cat=<slug>`). Filtra ativo: e a lista do que pode ser OFERECIDO agora. Sucessora de catalogo_filtros (TX-P2A), que continua existindo servindo o legado ate o cleanup do Marco 3.';

-- Catalogo de FOLHAS atribuiveis (portal, /e, admin) -----------
-- `icone`/`tema` ja chegam RESOLVIDOS: NULL na folha significa "herde do
-- segmento", e essa resolucao e regra de MODELO — vive no banco, nao em
-- 75 copias no TypeScript que divergiriam na primeira edicao.
create view public.catalogo_folhas
with (security_invoker = true) as
select
  cn.id                          as categoria_id,
  cn.slug                        as slug,
  cn.nome                        as nome,
  s.slug                         as segmento_slug,
  coalesce(cn.icone, s.icone)    as icone,
  coalesce(cn.tema,  s.tema)     as tema,
  cn.ordem                       as ordem,
  s.ordem                        as segmento_ordem
from public.categorias_novas cn
join public.segmentos s on s.id = cn.segmento_id
where cn.ativo and s.ativo;

comment on view public.catalogo_folhas is
  'MARCO 2A: catalogo de FOLHAS ATRIBUIVEIS — o que se pode ligar a um cupom ou estabelecimento AGORA. `categoria_id` e a chave fisica (uuid) que trafega em cupons.categoria_nova_id e estabelecimento_categorias_novas.categoria_id. Filtra ativo NOS DOIS NIVEIS (folha e segmento): uma folha ativa sob segmento desativado nao e oferecivel. icone/tema ja vem resolvidos pelo coalesce folha->segmento. Para resolver o visual de um cupom EXISTENTE use folha_para_segmento — esta view esconde folha desativada de proposito.';

-- Folha -> segmento + visual, SEM filtro de ativo ---------------
-- E a view do HISTORICO. Devolve toda folha que existe, ativa ou nao,
-- porque as perguntas que ela responde sao sobre o passado: "de que
-- segmento e este cupom?" e "que icone/tema desenho no card dele?".
-- `ativo` e `segmento_ativo` viajam junto para que o form de edicao saiba
-- se a categoria ATUAL do cupom ainda e selecionavel, sem uma consulta a
-- mais.
create view public.folha_para_segmento
with (security_invoker = true) as
select
  cn.id                          as categoria_id,
  cn.slug                        as slug,
  cn.nome                        as nome,
  s.slug                         as segmento_slug,
  coalesce(cn.icone, s.icone)    as icone,
  coalesce(cn.tema,  s.tema)     as tema,
  cn.ativo                       as ativo,
  s.ativo                        as segmento_ativo
from public.categorias_novas cn
join public.segmentos s on s.id = cn.segmento_id;

comment on view public.folha_para_segmento is
  'MARCO 2A: de uma folha (uuid), o segmento a que ela pertence e o visual resolvido. NAO filtra ativo, de proposito: e a view do HISTORICO — cupom cuja folha foi desativada depois continua resolvendo nome/icone/tema e continua aparecendo sob o chip do seu segmento. `ativo`/`segmento_ativo` acompanham para o form de edicao distinguir "categoria atual, mantenha" de "categoria selecionavel". Sucessora de categoria_para_filtro (TX-P2A).';

-- Privilegios --------------------------------------------------
-- Mesmo acesso que segmentos/categorias_novas ja tem: leitura publica,
-- nada de escrita. security_invoker garante que a RLS das tabelas base
-- continua sendo a autoridade — a view nao promove ninguem.
--
-- View SIMPLES e AUTO-ATUALIZAVEL no Postgres: sem o revoke, um
-- insert/update/delete em catalogo_segmentos escreveria em
-- public.segmentos. As outras duas tem JOIN (nao sao auto-atualizaveis),
-- mas levam o mesmo revoke — a defesa nao depende de alguem lembrar qual
-- das tres e simples no dia em que uma delas for reescrita.
revoke all on public.catalogo_segmentos  from public, anon, authenticated;
revoke all on public.catalogo_folhas     from public, anon, authenticated;
revoke all on public.folha_para_segmento from public, anon, authenticated;

grant select on public.catalogo_segmentos  to anon, authenticated;
grant select on public.catalogo_folhas     to anon, authenticated;
grant select on public.folha_para_segmento to anon, authenticated;


-- ============================================================
-- 3. cupons.categoria_id LEGADO — nullable e congelado
--
-- `categoria_id` e `text NOT NULL -> categorias(id)`, e `categorias` tem
-- SEIS linhas. As folhas dos OITO segmentos que nunca existiram no legado
-- (turismo-hotelaria, moda, automotivo, entretenimento, servicos, saude,
-- casa-decoracao, infantil-maternidade) NAO TEM valor legado possivel —
-- e inventar um de-para (turismo -> alimentacao) e proibido: seria uma
-- mentira gravada no banco, que depois nenhum relatorio conseguiria
-- desfazer.
--
-- Entao a coluna vira nullable e a escrita CONGELA:
--   · as linhas de hoje mantem o valor legado INTACTO — e a rede de
--     rollback: o codigo antigo, se voltar, continua lendo o que sempre
--     leu;
--   · cupom novo nasce com categoria_id NULL e categoria_nova_id UUID.
--
-- Sem rename e sem drop, de proposito: os dois quebrariam o codigo
-- publicado no ato, e o rollback deixaria de ser um simples revert.
-- ============================================================
alter table public.cupons alter column categoria_id drop not null;

comment on column public.cupons.categoria_id is
  'LEGADO CONGELADO (MARCO 2A). Era a categoria do cupom ate o cutover; a autoridade agora e categoria_nova_id (folha uuid). Nullable desde o Marco 2A porque as folhas dos 8 segmentos novos nao tem equivalente entre as 6 categorias legadas — e inventar de-para e proibido. Cupom criado a partir do cutover nasce com NULL aqui. As linhas antigas preservam o valor como rede de rollback; a coluna sai fisicamente so no cleanup do Marco 3.';


-- ============================================================
-- 4. checar_categoria_cupom() — saida antecipada para NULL
--
-- Trigger da Fase 4 (migration 12). Ele valida `categoria_id` contra a
-- juncao LEGADA, e faz isso incondicionalmente: hoje, um INSERT com
-- categoria_id NULL bateria no `not exists` e levantaria
-- 'categoria_fora_do_conjunto'. Ou seja: sem esta mudanca, o passo 3
-- acima (drop not null) seria decorativo — o trigger continuaria
-- impedindo o cupom novo de nascer.
--
-- O caminho COM valor preenchido continua validado exatamente como antes,
-- byte por byte. E isso que mantem o codigo antigo funcionando durante a
-- janela: ele sempre manda valor, e para ele nada mudou.
--
-- O trigger em si (trg_cupom_categoria_no_conjunto) nao e recriado — so o
-- corpo da funcao muda, via `create or replace`.
-- ============================================================
create or replace function public.checar_categoria_cupom()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_via_api boolean := auth.role() is not null;
begin
  -- MARCO 2A (HARDENING FINAL): fecha a outra metade do congelamento —
  -- ate aqui categoria_id so tinha side aberto para NULL; nada impedia
  -- authenticated/anon/service_role RECATEGORIZAR pela porta legada via
  -- PostgREST direto (INSERT sempre passou por aqui; so faltava travar o
  -- UPDATE que muda o valor). `auth.role()` distingue os dois mundos sem
  -- o efeito colateral de SECURITY DEFINER sobre current_user (dentro de
  -- uma funcao DEFINER, current_user vira o DONO da funcao — sempre
  -- 'postgres' — entao nunca serviria para saber quem chamou; auth.role()
  -- le a GUC de JWT que o PostgREST seta por requisicao e que migration/
  -- seed.sql via psql simplesmente nao tem, ficando NULL). Medido nesta
  -- auditoria: 'postgres'/'postgres' (current_user/session_user) via
  -- psql direto; 'postgres'/'authenticator' via PostgREST em QUALQUER
  -- papel — so auth.role() realmente diferencia anon/authenticated/
  -- service_role de administrativo.
  --
  -- A checagem roda ANTES do "is null" mais abaixo (uma troca para NULL
  -- tambem e recategorizacao) e ANTES da validacao de conjunto — mas so
  -- DISPARA quando o valor novo e o tipo de escrita que TERIA sucesso sob
  -- as regras de sempre (nulo, ou dentro do conjunto legado): uma
  -- recategorizacao para um valor que JA seria invalido no legado
  -- continua caindo no erro de sempre (categoria_fora_do_conjunto), sem
  -- trocar o texto de um erro que os testes de negativo da Fase 4 ja
  -- verificam literalmente. So passa a existir um erro NOVO onde antes
  -- existia um SUCESSO — nunca onde ja existia falha.
  if v_via_api
     and tg_op = 'UPDATE'
     and new.categoria_id is distinct from old.categoria_id
     and (
       new.categoria_id is null
       or exists (
         select 1 from public.estabelecimento_categorias ec
         where ec.estabelecimento_id = new.estabelecimento_id
           and ec.categoria_id = new.categoria_id
       )
     )
  then
    raise exception 'categoria_id_legado_congelada'
      using hint = 'categoria_id legado esta congelado desde o Marco 2A e nao pode mudar de valor (nem para NULL) via API. Para recategorizar um cupom, use categoria_nova_id — o que tambem aciona a remoderacao (checar_edicao_cupom).';
  end if;

  -- MARCO 2A: categoria_id legado congelado. NULL significa "este cupom
  -- e do modelo novo" — quem o valida e checar_categoria_nova_cupom
  -- (migration 20260830160000), contra a juncao NOVA. Nao ha o que
  -- checar contra a juncao legada, e exigir um valor legado aqui
  -- impediria qualquer cupom nas 8 familias novas de existir.
  if new.categoria_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.estabelecimento_categorias ec
    where ec.estabelecimento_id = new.estabelecimento_id
      and ec.categoria_id = new.categoria_id
  ) then
    raise exception 'categoria_fora_do_conjunto'
      using hint = 'A categoria do cupom deve ser uma das categorias do estabelecimento.';
  end if;
  return new;
end;
$$;

revoke execute on function public.checar_categoria_cupom() from public, anon, authenticated;

comment on function public.checar_categoria_cupom() is
  'Fase 4 + MARCO 2A (+ HARDENING FINAL): valida cupons.categoria_id (LEGADO) contra estabelecimento_categorias legado. Retorna cedo quando categoria_id e NULL — cupom do modelo novo, validado por checar_categoria_nova_cupom contra a juncao nova. Chamada via API (anon/authenticated/service_role, detectado por auth.role() nao nulo) nao pode mais MUDAR o valor de categoria_id (nem para NULL) num UPDATE — legado congelado tambem no banco, nao so por convencao do codigo novo. Contexto administrativo (auth.role() nulo: migration, seed.sql via psql, db reset) passa incondicionalmente, como sempre.';


-- ============================================================
-- 4B. checar_categoria_nova_cupom() — HARDENING FINAL da janela bridge
--
-- Esta funcao nasceu na migration 20260830160000 (HOSPEDADA, IMUTAVEL).
-- Este bloco a redefine via `create or replace` NESTA migration ainda
-- LOCAL — mesmo padrao ja usado acima para checar_categoria_cupom e mais
-- abaixo para checar_edicao_cupom, ambas tambem nascidas em migrations
-- anteriores e ambas redefinidas aqui, nunca editadas no arquivo original.
--
-- O GAP QUE ISTO FECHA: sem esta mudanca, entre a 120000 hospedada e o
-- runtime novo (criarCupomAction/editarCupomAction) em producao, um
-- INSERT do codigo ANTIGO — que so manda categoria_id, nunca
-- categoria_nova_id — nasceria com categoria_nova_id NULL: um cupom
-- REAL, PERMANENTE, orfao do modelo novo. Nao ha mapping seguro
-- categoria_id -> folha para corrigir isso depois (a mesma razao de
-- fundo que tornou proibido inventar de-para para o categoria_id
-- legado — ver secao 3 acima), e um cupom assim bloquearia para sempre
-- a precondition da migration de CONTRACT (20260831130000).
--
-- item 1 — INSERT sem folha, restrito ao canal que a APLICACAO de fato
-- usa (anon/authenticated: o que uma Server Action roda em nome de quem
-- esta logado). service_role FICA DE FORA deste item especifico, e a
-- razao esta escrita no proprio CLAUDE.md deste repo: "A service_role
-- NUNCA e provisionada em plataforma de build (...) so scripts/, que
-- rodam no Node local" — aqui ele e o papel de ~30 fixtures de
-- regressao (test-rls, fase3, fase4, fase5, fase6, fase6.5, fase9,
-- fase9c, fase9d1 — todas ANTERIORES ao Marco 1, testando janela/
-- limites/moderacao/ciclo-de-vida, nada de taxonomia) que criam cupom
-- so com categoria_id. Bloquear tambem service_role fecharia zero
-- caminho que a aplicacao publicada usa e quebraria essas suites
-- inteiras sem necessidade — o service_role desta casa nunca e o
-- "codigo antigo em producao" que o gap descreve.
--
-- item 2 — ninguem LIMPA o shadow via API, em NENHUM papel (aqui
-- service_role ENTRA: ele e operador de teste/migracao, nao sinonimo de
-- "pode desfazer o cutover"). So dispara numa limpeza de verdade
-- (UUID -> NULL); INSERT sem valor (old e NULL, sempre, numa linha
-- nova) e NULL -> NULL nunca acionam esta condicao.
--
-- Auth.role() e o mesmo discriminador administrativo x API usado acima
-- em checar_categoria_cupom — ver o comentario daquela funcao para a
-- medicao completa (current_user vira o DONO da funcao dentro de
-- SECURITY DEFINER e nunca serviria para isto).
-- ============================================================
create or replace function public.checar_categoria_nova_cupom()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ativo boolean;
  v_role text := auth.role();
begin
  if tg_op = 'INSERT' and v_role in ('anon', 'authenticated') and new.categoria_nova_id is null then
    raise exception 'categoria_nova_obrigatoria_no_runtime'
      using hint = 'Cupom criado pela aplicacao precisa de categoria_nova_id (folha uuid) — categoria_id legado sozinho nao e mais suficiente desde o Marco 2A.';
  end if;

  if v_role is not null and old.categoria_nova_id is not null and new.categoria_nova_id is null then
    raise exception 'categoria_nova_nao_pode_ser_limpa_via_api'
      using hint = 'categoria_nova_id nao pode ser apagada via API depois de definida. Para trocar de folha, grave outro uuid — nunca NULL.';
  end if;

  if new.categoria_nova_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.estabelecimento_categorias_novas ecn
     where ecn.estabelecimento_id = new.estabelecimento_id
       and ecn.categoria_id = new.categoria_nova_id
  ) then
    raise exception 'categoria_nova_fora_do_conjunto'
      using hint = 'categoria_nova_id do cupom precisa ser uma das categorias do estabelecimento em estabelecimento_categorias_novas.';
  end if;

  select (cn.ativo and s.ativo) into v_ativo
    from public.categorias_novas cn
    join public.segmentos s on s.id = cn.segmento_id
   where cn.id = new.categoria_nova_id;

  if v_ativo is not true then
    raise exception 'categoria_nova_inativa_para_nova_selecao'
      using hint = 'categoria e segmento precisam estar ativos para uma NOVA seleção de categoria_nova_id. Categoria já em uso que foi desativada depois não invalida o cupom existente — esta checagem só roda quando categoria_nova_id está sendo definida/alterada.';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_categoria_nova_cupom() from public, anon, authenticated;

comment on function public.checar_categoria_nova_cupom() is
  'MARCO 1 (+ MARCO 2A HARDENING FINAL): valida categoria_nova_id do cupom contra estabelecimento_categorias_novas + ativo, só quando o campo está sendo definido/alterado (nunca retroativo). Desde o hardening final: INSERT de anon/authenticated exige categoria_nova_id preenchida (fecha o gap de orfão na janela bridge->runtime; service_role fica isento, por não ser canal da aplicação nesta casa); e nenhum papel via API (service_role incluído) pode limpar um categoria_nova_id já definido de volta para NULL.';

drop trigger if exists trg_cupons_categoria_nova_no_conjunto on public.cupons;
create trigger trg_cupons_categoria_nova_no_conjunto
  before insert or update of categoria_nova_id, estabelecimento_id on public.cupons
  for each row execute function public.checar_categoria_nova_cupom();


-- ============================================================
-- 5. checar_edicao_cupom() — a matriz passa a enxergar a folha UUID
--
-- Esta e a mudanca menos obvia e a mais importante desta migration.
--
-- A funcao da Fase 6.5 pergunta duas coisas sobre `categoria_id`:
--   v_mudou_algo -> "vale a pena calcular a matriz?" (um UPDATE que nao
--                   mudou nada retorna cedo e nao paga as contagens)
--   v_material   -> "isto rebaixa o cupom ativo para moderacao e entra
--                   em moderacao_historico como 'editado_material'?"
--
-- Depois do cutover a categoria viaja em `categoria_nova_id`. Se a funcao
-- continuasse cega para essa coluna, trocar a categoria de um cupom seria
-- um update "que nao mudou nada": retorno antecipado, ZERO registro no
-- historico e ZERO rebaixamento para moderacao. Um lojista poderia
-- publicar em "Restaurante", ter o cupom aprovado, e migra-lo para
-- "Academia" sem que nenhum moderador visse — via o form OU via PostgREST
-- direto, ja que `categoria_nova_id` ganha grant de UPDATE no passo 6.
-- Concedar o grant sem esta mudanca abriria o buraco.
--
-- As DUAS colunas ficam nas duas perguntas. Nao e redundancia: e o que
-- faz a mesma funcao servir ao codigo ANTIGO (que mexe em categoria_id) e
-- ao NOVO (que mexe em categoria_nova_id) durante a janela em que os dois
-- podem existir. O resto do corpo e identico ao da migration 20 — este
-- `create or replace` foi gerado a partir do arquivo original, com
-- exatamente estas duas insercoes.
-- ============================================================
create or replace function public.checar_edicao_cupom()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_validacoes int;
  v_ativas int;
  v_max_por_usuario int;
  v_ultima_expira timestamptz;
  v_material boolean := false;
  v_mudou_algo boolean := false;
  v_dias_velho jsonb;
  v_dias_novo jsonb;
  v_ini_velho time;
  v_fim_velho time;
  v_ini_novo time;
  v_fim_novo time;
begin
  -- Caminhos que passam intactos, pelo mesmo critério da migration 19:
  --   * auth.uid() null  -> seed.sql (psql), service_role das suítes e do
  --     seed-users, manutenção via SQL;
  --   * admin            -> moderação e correção operacional.
  -- Atenção: dentro de uma RPC `security definer` chamada pelo LOJISTA o
  -- auth.uid() continua sendo o do lojista (não vira null), então
  -- reenviar_cupom_moderacao (migration 21) É avaliado aqui — e deve ser,
  -- porque ele só mexe em `status`, que não é material.
  if v_uid is null or (select private.is_admin()) then
    return new;
  end if;

  -- ---------- helpers de "mudou?" ----------
  -- `is distinct from` cobre NULL dos dois lados (limite ilimitado).
  v_mudou_algo :=
        new.titulo              is distinct from old.titulo
     or new.beneficio           is distinct from old.beneficio
     or new.categoria_id        is distinct from old.categoria_id
     -- M2: a folha UUID entra na MESMA pergunta. Sem isto, trocar de
     -- categoria depois do cutover seria um update "que nao mudou nada"
     -- e a funcao devolveria cedo, pulando toda a matriz abaixo.
     or new.categoria_nova_id   is distinct from old.categoria_nova_id
     or new.economia            is distinct from old.economia
     or new.economia_variavel   is distinct from old.economia_variavel
     or new.taxas               is distinct from old.taxas
     or new.formas_consumo      is distinct from old.formas_consumo
     or new.horarios            is distinct from old.horarios
     or new.regras              is distinct from old.regras
     or new.imagem              is distinct from old.imagem
     or new.validade_inicio     is distinct from old.validade_inicio
     or new.validade_fim        is distinct from old.validade_fim
     or new.ocultar_ate_inicio  is distinct from old.ocultar_ate_inicio
     or new.prazo_ativacao_horas is distinct from old.prazo_ativacao_horas
     or new.limite_por_usuario  is distinct from old.limite_por_usuario
     or new.limite_total        is distinct from old.limite_total;

  if not v_mudou_algo then
    return new; -- update no-op (ex.: só `atualizado_em`) não paga nada
  end if;

  -- ---------- estado do consumo ----------
  select count(*) filter (where status = 'validado'),
         count(*) filter (where status = 'ativo' and expira_em > now()),
         max(expira_em) filter (where status = 'ativo' and expira_em > now())
    into v_validacoes, v_ativas, v_ultima_expira
    from public.cupons_usuario
   where cupom_id = old.id;

  -- ---------- ECONOMIA: imutável com QUALQUER validação ----------
  -- `economia_consumidor()` soma cupons.economia em tempo de LEITURA
  -- (migration 18). Alterar aqui reescreveria retroativamente o total já
  -- exibido a todo consumidor que validou este cupom.
  if v_validacoes > 0
     and (new.economia is distinct from old.economia
          or new.economia_variavel is distinct from old.economia_variavel) then
    raise exception
      'A economia não pode mudar: % cliente(s) já validaram este cupom e o valor entra no total economizado deles.',
      v_validacoes
      using errcode = 'P0601';
  end if;

  -- ---------- PROMESSA AO CONSUMIDOR: imutável com ativação viva ----------
  -- É o que está escrito na folha que o cliente vai apresentar no balcão.
  if v_ativas > 0
     and (new.beneficio is distinct from old.beneficio
          or new.taxas is distinct from old.taxas
          or new.formas_consumo is distinct from old.formas_consumo) then
    raise exception
      'Benefício, taxas e formas de consumo não podem mudar agora: % cliente(s) têm este cupom ativo. A última ativação vence em %.',
      v_ativas, to_char(v_ultima_expira at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
      using errcode = 'P0602';
  end if;

  -- ---------- LIMITE POR USUÁRIO: nunca abaixo do já consumido ----------
  -- NULL (ilimitado) é sempre permitido — é o teto máximo.
  if new.limite_por_usuario is not null
     and new.limite_por_usuario is distinct from old.limite_por_usuario then
    select coalesce(max(qtd), 0) into v_max_por_usuario
      from (
        select count(*) as qtd
          from public.cupons_usuario
         where cupom_id = old.id
           and (status = 'validado' or (status = 'ativo' and expira_em > now()))
         group by usuario_id
      ) t;
    if new.limite_por_usuario < v_max_por_usuario then
      raise exception
        'O limite por cliente não pode ficar abaixo de %: já há cliente que usou esse tanto.',
        v_max_por_usuario
        using errcode = 'P0603';
    end if;
  end if;

  -- ---------- LIMITE TOTAL: nunca abaixo das validações ----------
  if new.limite_total is not null
     and new.limite_total is distinct from old.limite_total
     and new.limite_total < v_validacoes then
    raise exception
      'O limite total não pode ficar abaixo de %: é quanto já foi resgatado.',
      v_validacoes
      using errcode = 'P0604';
  end if;

  -- ---------- VALIDADE: com ativação viva, só estende ----------
  if v_ativas > 0 and new.validade_fim < old.validade_fim then
    raise exception
      'A validade não pode ser encurtada agora: % cliente(s) têm este cupom ativo.',
      v_ativas
      using errcode = 'P0605';
  end if;

  -- ---------- JANELA: com ativação viva, só amplia ----------
  -- Compara com a MESMA tolerância de `dentro_da_janela` (Fase 5): dado
  -- malformado é "sem restrição". Ampliar = passar a valer em mais
  -- instantes; qualquer coisa que reduza é bloqueada.
  if v_ativas > 0 and new.horarios is distinct from old.horarios then
    v_dias_velho := case when jsonb_typeof(old.horarios -> 'dias') = 'array'
                         then old.horarios -> 'dias' else '[]'::jsonb end;
    v_dias_novo  := case when jsonb_typeof(new.horarios -> 'dias') = 'array'
                         then new.horarios -> 'dias' else '[]'::jsonb end;

    -- dias: o novo tem de ser "sem restrição" ([]) ou conter todos os antigos
    if jsonb_array_length(v_dias_novo) > 0
       and not (v_dias_novo @> v_dias_velho) then
      raise exception
        'Os dias de consumo não podem ser reduzidos agora: % cliente(s) têm este cupom ativo.',
        v_ativas
        using errcode = 'P0606';
    end if;

    -- horário: só valida quando AMBOS os lados têm faixa legível; faixa
    -- nova ausente/inválida = sem restrição = ampliação (permitida).
    v_ini_velho := public.hora_ou_null(old.horarios ->> 'inicio');
    v_fim_velho := public.hora_ou_null(old.horarios ->> 'fim');
    v_ini_novo  := public.hora_ou_null(new.horarios ->> 'inicio');
    v_fim_novo  := public.hora_ou_null(new.horarios ->> 'fim');

    if v_ini_velho is not null and v_fim_velho is not null
       and v_ini_novo is not null and v_fim_novo is not null then
      -- Faixa que cruza a meia-noite é conservadoramente tratada como
      -- estreitamento quando muda: comparar contenção em janela circular
      -- daria margem a erro sutil, e o lojista espera no máximo o prazo de
      -- ativação (mínimo de 5h) para editar.
      if v_ini_velho > v_fim_velho or v_ini_novo > v_fim_novo then
        raise exception
          'O horário não pode mudar agora: % cliente(s) têm este cupom ativo.',
          v_ativas
          using errcode = 'P0606';
      end if;
      if v_ini_novo > v_ini_velho or v_fim_novo < v_fim_velho then
        raise exception
          'O horário só pode ser ampliado agora: % cliente(s) têm este cupom ativo.',
          v_ativas
          using errcode = 'P0606';
      end if;
    end if;
  end if;

  -- ---------- MATERIALIDADE: volta para moderação ----------
  -- Material = o que o consumidor lê ou o que muda onde o cupom aparece.
  -- `titulo` fica de fora por decisão de produto (typo não deve rebaixar);
  -- em compensação, TODA edição de cupom ativo é registrada abaixo.
  v_material :=
        new.beneficio         is distinct from old.beneficio
     or new.economia          is distinct from old.economia
     or new.economia_variavel is distinct from old.economia_variavel
     or new.categoria_id      is distinct from old.categoria_id
     -- M2: trocar a folha UUID e MATERIAL, exatamente como trocar o
     -- categoria_id legado sempre foi. Sem isto o cutover abriria um
     -- caminho de recategorizacao sem remoderacao e sem historico.
     or new.categoria_nova_id is distinct from old.categoria_nova_id
     or new.taxas             is distinct from old.taxas
     or new.formas_consumo    is distinct from old.formas_consumo
     or new.horarios          is distinct from old.horarios
     or new.regras            is distinct from old.regras
     or new.imagem            is distinct from old.imagem;

  -- O REGISTRO vale para QUALQUER status. É o que fecha o ciclo do C5: um
  -- cupom rejeitado que volta para a fila precisa mostrar ao admin SE o
  -- lojista corrigiu alguma coisa antes de reenviar — sem isso o histórico
  -- fica "rejeitado → reenviado" e o moderador reabre no escuro.
  new.moderacao_historico := coalesce(old.moderacao_historico, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
         'em', now(),
         'acao', case when v_material then 'editado_material' else 'editado' end,
         'por', v_uid
       ));

  -- O REBAIXAMENTO, não: só cupom ATIVO volta para moderação. Um cupom
  -- 'rejeitado' editado NÃO vira 'pendente' sozinho — quem decide quando
  -- reenviar é o lojista, pelo botão explícito (reenviar_cupom_moderacao).
  -- Rebaixar aqui roubaria dele a chance de fazer vários ajustes antes de
  -- submeter de novo.
  if old.status = 'ativo' and v_material then
    new.status := 'pendente';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_edicao_cupom() from public, anon, authenticated;

comment on function public.checar_edicao_cupom() is
  'Fase 6.5 + MARCO 2A: matriz de imutabilidade + materialidade na edicao de cupom. Barreira real (cobre o PostgREST direto, nao so a Server Action). Desde o Marco 2A avalia categoria_nova_id (folha uuid) ALEM de categoria_id (legado), nas duas perguntas — "mudou algo?" e "e material?" — para que trocar de categoria depois do cutover produza o MESMO efeito de moderacao que sempre produziu, e para que a mesma funcao sirva ao codigo antigo e ao novo durante a janela.';


-- ============================================================
-- 6. GRANT de UPDATE em cupons.categoria_nova_id
--
-- O `authenticated` JA tem INSERT nesta coluna: ela nasceu na migration
-- 20260830160000 e herdou o grant de INSERT que existe no nivel da
-- tabela (aquela migration revogou UPDATE, nunca INSERT). Criar cupom
-- com folha ja funciona hoje.
--
-- Falta so o UPDATE, sem o qual a EDICAO de categoria devolveria
-- "permission denied for column categoria_nova_id". Uma unica coluna —
-- nenhuma outra e aberta, e o `revoke update on table` da Fase 3 continua
-- valendo para todo o resto.
--
-- A barreira de verdade nao e o grant: e o trigger do passo 5 (que agora
-- rebaixa para moderacao) somado a checar_categoria_nova_cupom (que exige
-- a folha no conjunto do estabelecimento e ativa). O grant so abre a
-- porta que essas duas guardam.
-- ============================================================
grant update (categoria_nova_id) on public.cupons to authenticated;


-- ============================================================
-- 7. estabelecimento_categorias_novas — a juncao vira operavel
--
-- A migration 20260830160000 criou a tabela como SHADOW: leitura publica
-- irrestrita e nenhuma escrita, porque ninguem a lia nem a escrevia. Ao
-- virar a fonte do runtime, os dois lados precisam alcancar a fronteira
-- que a juncao LEGADA ja tem — nao e hardening novo, e a regressao que o
-- proprio cutover introduz se nada for feito.
--
-- 7.1 LEITURA. Hoje: `using (true)`. A juncao legada restringe anon a
-- estabelecimento ATIVO. Trocar a fonte sem trocar a policy passaria a
-- expor ao anonimo os ids de estabelecimentos pendentes/suspensos — que
-- a tabela `estabelecimentos` esconde (`using (status = 'ativo')`). E a
-- segunda policy nao e cosmetica: `/e/cupom/novo` precisa listar as
-- categorias do lojista mesmo com o estabelecimento PENDENTE, e e
-- exatamente isso que "dono e admin leem" garante no legado.
--
-- 7.2 ESCRITA. Espelha a decisao da Fase 4: SO ADMIN. O grant vai para
-- `authenticated` porque e o unico papel que o PostgREST conhece; quem
-- restringe e a POLICY. Lojista com insert/delete poderia se auto-vincular
-- as 75 folhas sem moderacao e deletar a propria principal.
--
-- Os invariantes continuam sendo do BANCO, e aqui eles ja sao mais fortes
-- que no legado: impedir_remover_categoria_do_conjunto_em_uso (migration
-- 20260830160000) recusa remover a principal vigente ou uma categoria em
-- uso por cupom. No legado essa regra vive so na Server Action.
-- ============================================================

-- 7.1 leitura --------------------------------------------------
drop policy "estabelecimento_categorias_novas: leitura publica"
  on public.estabelecimento_categorias_novas;

create policy "estab_categorias_novas: publico le de estabelecimento ativo"
  on public.estabelecimento_categorias_novas for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.estabelecimentos e
      where e.id = estabelecimento_id and e.status = 'ativo'
    )
  );

create policy "estab_categorias_novas: dono e admin leem"
  on public.estabelecimento_categorias_novas for select
  to authenticated
  using (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  );

-- 7.2 escrita (so admin) ---------------------------------------
grant insert, delete on public.estabelecimento_categorias_novas to authenticated;

create policy "estab_categorias_novas: admin insere"
  on public.estabelecimento_categorias_novas for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "estab_categorias_novas: admin remove"
  on public.estabelecimento_categorias_novas for delete
  to authenticated
  using ((select private.is_admin()));

-- Sem policy de UPDATE e sem grant de UPDATE: mudar a chave de um vinculo
-- e sempre "remover um e criar outro". A ausencia e deliberada.


-- ============================================================
-- 8. Vinculo NOVO exige folha ATIVA (a outra ponta de `ativo`)
--
-- `ativo` controla NOVA SELECAO. O modelo ja tinha essa regra do lado do
-- CUPOM (checar_categoria_nova_cupom exige folha e segmento ativos quando
-- categoria_nova_id e definida), mas nao do lado do ESTABELECIMENTO:
-- nada impedia vincular um estabelecimento a uma folha desativada, e dali
-- a checagem do cupom passaria a recusar cupons naquela categoria — um
-- vinculo que existe e nao serve para nada, descoberto so na hora de
-- criar o cupom.
--
-- Simetria com a regra do cupom, inclusive na parte que NAO faz: a
-- checagem so roda quando o vinculo esta sendo CRIADO ou tem a chave
-- alterada. Uma folha desativada DEPOIS nao invalida o vinculo que ja
-- existe — senao o admin nao conseguiria mais mexer no conjunto de um
-- estabelecimento so porque uma categoria antiga saiu de catalogo, e o
-- lojista perderia a categoria historica do proprio cupom.
--
-- Server-side de proposito: o frontend tambem filtra (catalogo_folhas so
-- devolve ativas), mas o PostgREST direto ignora o frontend.
-- ============================================================
create or replace function public.checar_categoria_nova_ativa_no_vinculo()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ativo boolean;
begin
  select (cn.ativo and s.ativo) into v_ativo
    from public.categorias_novas cn
    join public.segmentos s on s.id = cn.segmento_id
   where cn.id = new.categoria_id;

  if v_ativo is not true then
    raise exception 'categoria_nova_inativa_para_novo_vinculo'
      using hint = 'A categoria e o segmento precisam estar ativos para um NOVO vinculo de estabelecimento. Vinculo que ja existe e teve a categoria desativada depois NAO e invalidado — esta checagem so roda quando o vinculo esta sendo criado ou tem a chave alterada.';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_categoria_nova_ativa_no_vinculo() from public, anon, authenticated;

comment on function public.checar_categoria_nova_ativa_no_vinculo() is
  'MARCO 2A: exige folha e segmento ATIVOS para um NOVO vinculo em estabelecimento_categorias_novas. Simetrico a checar_categoria_nova_cupom, e igualmente nao-retroativo: so dispara em INSERT ou em UPDATE que muda categoria_id.';

drop trigger if exists trg_estab_categorias_novas_exige_ativa on public.estabelecimento_categorias_novas;
create trigger trg_estab_categorias_novas_exige_ativa
  before insert or update of categoria_id on public.estabelecimento_categorias_novas
  for each row execute function public.checar_categoria_nova_ativa_no_vinculo();


-- ============================================================
-- 9. POSTCONDITIONS — nada de sucesso parcial silencioso
--
-- Estruturais, como as preconditions: comparam as views com as tabelas
-- base em vez de esperar 14/75 fotografados, para continuarem valendo
-- quando o catalogo crescer.
-- ============================================================
do $$
declare
  v_seg_view int;
  v_seg_ativos int;
  v_folhas_view int;
  v_folhas_ativas int;
  v_mapa_view int;
  v_folhas_todas int;
  v_nullable text;
  v_grant int;
  v_policy_antiga int;
  v_policies_novas int;
  v_edicao_ve_folha boolean;
  v_categoria_aceita_null boolean;
  v_categoria_congela_update boolean;
  v_nova_exige_insert boolean;
  v_nova_bloqueia_clear boolean;
  v_trigger_ativa int;
begin
  -- views x tabelas base
  select count(*) into v_seg_view    from public.catalogo_segmentos;
  select count(*) into v_seg_ativos  from public.segmentos where ativo;
  if v_seg_view <> v_seg_ativos then
    raise exception 'M2 bridge: catalogo_segmentos tem % linhas, segmentos ativos sao %. Abortando.', v_seg_view, v_seg_ativos;
  end if;

  select count(*) into v_folhas_view from public.catalogo_folhas;
  select count(*) into v_folhas_ativas
    from public.categorias_novas cn
    join public.segmentos s on s.id = cn.segmento_id
   where cn.ativo and s.ativo;
  if v_folhas_view <> v_folhas_ativas then
    raise exception 'M2 bridge: catalogo_folhas tem % linhas, folhas atribuiveis sao %. Abortando.', v_folhas_view, v_folhas_ativas;
  end if;

  select count(*) into v_mapa_view   from public.folha_para_segmento;
  select count(*) into v_folhas_todas from public.categorias_novas;
  if v_mapa_view <> v_folhas_todas then
    raise exception 'M2 bridge: folha_para_segmento tem % linhas, folhas existentes sao % — a view do historico NAO pode filtrar ativo. Abortando.', v_mapa_view, v_folhas_todas;
  end if;

  -- heranca visual resolvida (nenhum icone/tema nulo atravessa a fronteira)
  if exists (select 1 from public.catalogo_folhas where icone is null or tema is null)
     or exists (select 1 from public.folha_para_segmento where icone is null or tema is null) then
    raise exception 'M2 bridge: ha folha com icone/tema NULL apos o coalesce — a heranca do segmento nao resolveu. Abortando.';
  end if;

  -- cupons.categoria_id nullable
  select is_nullable into v_nullable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cupons' and column_name = 'categoria_id';
  if v_nullable is distinct from 'YES' then
    raise exception 'M2 bridge: cupons.categoria_id continua NOT NULL (is_nullable=%). Abortando.', v_nullable;
  end if;

  -- cupons.categoria_nova_id continua NULLABLE — o contract e outra migration
  select is_nullable into v_nullable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'cupons' and column_name = 'categoria_nova_id';
  if v_nullable is distinct from 'YES' then
    raise exception 'M2 bridge: categoria_nova_id ficou NOT NULL aqui. O contract e a migration 20260831130000, que so nasce POS-DEPLOY — o codigo antigo nao preenche esta coluna e pararia de criar cupom. Abortando.';
  end if;

  -- grant de update na folha
  select count(*) into v_grant
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'cupons'
     and column_name = 'categoria_nova_id' and privilege_type = 'UPDATE'
     and grantee = 'authenticated';
  if v_grant <> 1 then
    raise exception 'M2 bridge: grant de UPDATE em cupons.categoria_nova_id ausente. Abortando.';
  end if;

  -- policies da juncao nova
  select count(*) into v_policy_antiga
    from pg_policies
   where schemaname = 'public' and tablename = 'estabelecimento_categorias_novas'
     and policyname = 'estabelecimento_categorias_novas: leitura publica';
  if v_policy_antiga <> 0 then
    raise exception 'M2 bridge: a policy `using (true)` da juncao nova continua existindo. Abortando.';
  end if;

  select count(*) into v_policies_novas
    from pg_policies
   where schemaname = 'public' and tablename = 'estabelecimento_categorias_novas'
     and policyname like 'estab_categorias_novas:%';
  if v_policies_novas <> 4 then
    raise exception 'M2 bridge: juncao nova tem % policies novas, esperado 4 (publico/dono+admin/insere/remove). Abortando.', v_policies_novas;
  end if;

  -- as duas funcoes realmente mudaram de corpo
  select prosrc like '%categoria_nova_id%' into v_edicao_ve_folha
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'checar_edicao_cupom';
  if v_edicao_ve_folha is not true then
    raise exception 'M2 bridge: checar_edicao_cupom nao enxerga categoria_nova_id — trocar categoria escaparia da remoderacao. Abortando.';
  end if;

  select prosrc like '%new.categoria_id is null%' into v_categoria_aceita_null
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'checar_categoria_cupom';
  if v_categoria_aceita_null is not true then
    raise exception 'M2 bridge: checar_categoria_cupom nao tem a saida antecipada para NULL — nenhum cupom novo conseguiria nascer. Abortando.';
  end if;

  -- HARDENING FINAL: as duas funcoes realmente ganharam o freeze/gate.
  select prosrc like '%categoria_id_legado_congelada%' into v_categoria_congela_update
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'checar_categoria_cupom';
  if v_categoria_congela_update is not true then
    raise exception 'M2 bridge: checar_categoria_cupom nao bloqueia mudanca de categoria_id via API — legado nao esta congelado no banco. Abortando.';
  end if;

  select prosrc like '%categoria_nova_obrigatoria_no_runtime%' into v_nova_exige_insert
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'checar_categoria_nova_cupom';
  if v_nova_exige_insert is not true then
    raise exception 'M2 bridge: checar_categoria_nova_cupom nao exige categoria_nova_id no INSERT de anon/authenticated — o gap de orfao na janela bridge->runtime continua aberto. Abortando.';
  end if;

  select prosrc like '%categoria_nova_nao_pode_ser_limpa_via_api%' into v_nova_bloqueia_clear
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'checar_categoria_nova_cupom';
  if v_nova_bloqueia_clear is not true then
    raise exception 'M2 bridge: checar_categoria_nova_cupom nao bloqueia limpar categoria_nova_id via API. Abortando.';
  end if;

  -- trigger do vinculo ativo
  select count(*) into v_trigger_ativa
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal
     and c.relname = 'estabelecimento_categorias_novas'
     and t.tgname = 'trg_estab_categorias_novas_exige_ativa';
  if v_trigger_ativa <> 1 then
    raise exception 'M2 bridge: trigger trg_estab_categorias_novas_exige_ativa ausente. Abortando.';
  end if;

  raise notice 'M2 bridge postconditions OK. views: catalogo_segmentos=%, catalogo_folhas=%, folha_para_segmento=%. categoria_id nullable, categoria_nova_id AINDA NULLABLE (contract nao aplicado).',
    v_seg_view, v_folhas_view, v_mapa_view;
end;
$$;
