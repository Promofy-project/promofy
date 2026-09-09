-- ============================================================
-- Promofy — CLIENT-RETURNS-03 · galeria do PERFIL do estabelecimento
--
-- O QUE ESTA MIGRATION É, E O QUE ELA NÃO É
--
-- É a galeria do PERFIL: fotos do local, do ambiente, dos produtos e do
-- cardápio — o complemento visual do negócio, esclarecido pelo cliente na
-- call de 02/09. NÃO é galeria de cupom, não é a imagem principal do cupom
-- (`cupons.imagem`) e não é a logo (`estabelecimentos.logo`, migration 37).
-- A 37 adiou explicitamente este desenho ("exigiria ordem, legenda e
-- distinção lugar×produto — modelagem própria"); é ele que chega aqui.
--
-- SEM BUCKET NOVO, SEM POLICY DE STORAGE NOVA
--
-- O bucket `cupom-imagens` já é, na prática, o bucket do ESTABELECIMENTO: a
-- pasta é `<estabelecimento_id>/` desde a migration 22 (a decisão de pasta
-- por estabelecimento, e não por cupom, está documentada lá), a logo já o
-- reutiliza desde a 37, e as três policies (select/insert/delete) já provam
-- posse por `private.owns_estabelecimento((storage.foldername(name))[1])`.
-- A migration 23 já exige a FORMA do nome no INSERT
-- (`^[a-z0-9-]+/[0-9a-f]{32}\.(jpg|png|webp)$`).
--
-- Consequência: a galeria não abre UMA superfície de storage nova. Subir para
-- a pasta de outro estabelecimento continua barrado pela policy de INSERT que
-- já existe; apagar arquivo alheio, pela de DELETE. Um bucket `galeria-*`
-- exigiria replicar as três policies e o endurecimento da 23 — três chances
-- novas de divergir, zero garantia a mais.
--
-- Um efeito da 23 fica REGISTRADO em vez de contornado: o DELETE do objeto é
-- recusado quando aquele caminho estiver referenciado por um cupom já
-- moderado. Como a Action grava caminhos NOVOS e aleatórios, isso só acontece
-- se o próprio lojista apontar `cupons.imagem` para um arquivo da galeria —
-- dentro do próprio tenant. Nesse caso a LINHA da galeria some (o consumidor
-- deixa de ver) e o objeto fica órfão no bucket. Falha parcial previsível,
-- não silenciosa: ver `src/lib/actions/galeria-estab.ts`.
--
-- A PASTA É PROVADA DUAS VEZES, E A SEGUNDA É AQUI
--
-- `estabelecimento_galeria.imagem` guarda CAMINHO, nunca URL — mesma decisão
-- de `cupons.imagem` e `estabelecimentos.logo`: URL no banco seria um alvo
-- escrevível apontando para fora. E o CHECK exige que o caminho comece pela
-- pasta do PRÓPRIO `estabelecimento_id` da linha. Isso não é redundância
-- decorativa: sem ele, um lojista com posse de `e1` poderia inserir uma linha
-- de `e1` apontando para `e2/<hash>.jpg` e exibir a foto do vizinho no
-- próprio perfil. A policy de INSERT prova quem é o dono da LINHA; o CHECK
-- prova que o ARQUIVO é da mesma pasta. As duas juntas fecham o par.
--
-- UPDATE SÓ DE `ordem`. É DELIBERADO.
--
-- Mesmo espírito da ausência de policy de UPDATE no storage (migration 22).
-- Com `grant update` de tabela, o lojista repontaria `imagem` de uma linha já
-- publicada para outro arquivo — trocando o que o consumidor vê sem passar
-- por lugar nenhum. Reordenar é a única mutação legítima de uma linha
-- existente; trocar foto é remover + adicionar. Por isso:
-- `revoke update on table` + `grant update (ordem)` — o inverso (revoke por
-- coluna) é NO-OP no Postgres quando existe grant de tabela.
--
-- GUARD TÉCNICO, NÃO REGRA COMERCIAL
--
-- 12 imagens por estabelecimento. Não veio do cliente e não é plano/preço: é
-- proteção operacional contra uma galeria de 500 fotos derrubando o perfil.
-- Vive no trigger (fronteira real) e em `src/lib/galeria-estabelecimento.ts`
-- (mensagem ao lojista). Se um dia virar regra de produto, muda nos dois —
-- estão citados um no outro.
-- ============================================================

-- ------------------------------------------------------------
-- TABELA
-- ------------------------------------------------------------
create table public.estabelecimento_galeria (
  id                 uuid primary key default gen_random_uuid(),
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  -- CAMINHO no bucket `cupom-imagens`, mesmo contrato de `cupons.imagem`.
  imagem             text not null,
  ordem              int  not null default 0 check (ordem >= 0),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  -- Espelha PATH_IMAGEM_RE (src/lib/imagem-cupom.ts) e a policy de INSERT do
  -- storage (migration 23). Duplicação deliberada: a Action valida para dar
  -- mensagem boa, o banco valida porque é a fronteira real.
  constraint estabelecimento_galeria_forma_do_caminho
    check (imagem ~ '^[a-z0-9-]+/[0-9a-f]{32}\.(jpg|png|webp)$'),

  -- O arquivo é da pasta do próprio estabelecimento da linha. Sem isto, posse
  -- da linha não implicaria posse do arquivo (ver cabeçalho).
  constraint estabelecimento_galeria_arquivo_da_propria_pasta
    check (starts_with(imagem, estabelecimento_id || '/')),

  -- O mesmo arquivo não entra duas vezes. Como o caminho já carrega a pasta,
  -- unicidade global é unicidade por estabelecimento — e ainda impede que uma
  -- remoção de um lado apague o objeto que o outro lado ainda exibe.
  constraint estabelecimento_galeria_arquivo_unico unique (imagem)
);

comment on table public.estabelecimento_galeria is
  'CLIENT-RETURNS-03: galeria do PERFIL do estabelecimento (local, ambiente, produtos, cardapio). NAO e galeria de cupom.';
comment on column public.estabelecimento_galeria.imagem is
  'Caminho no bucket cupom-imagens: <estabelecimento_id>/<32 hex>.<ext>. Nunca URL.';
comment on column public.estabelecimento_galeria.ordem is
  'Posicao na galeria (0 = primeira). Empate desempata por criado_em, id — ordem sempre deterministica.';

-- O caminho de leitura é sempre "a galeria deste estabelecimento, em ordem".
create index estabelecimento_galeria_estab_ordem_idx
  on public.estabelecimento_galeria (estabelecimento_id, ordem, criado_em, id);

create trigger trg_estab_galeria_atualizado_em
  before update on public.estabelecimento_galeria
  for each row execute function public.set_atualizado_em();

-- ------------------------------------------------------------
-- GUARD TÉCNICO: teto de imagens por estabelecimento
--
-- `security definer` para contar a galeria INTEIRA daquele estabelecimento
-- sem depender da RLS de quem insere. Sob a RLS do chamador o número seria o
-- mesmo hoje (o dono vê as próprias), mas um teto que depende do que o
-- chamador ENXERGA é um teto que fura na primeira policy nova.
-- ------------------------------------------------------------
create or replace function private.checar_limite_galeria()
returns trigger
language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  v_max int := 12;   -- GUARD TÉCNICO — ver MAX_IMAGENS_GALERIA em src/lib/galeria-estabelecimento.ts
  v_qtd int;
begin
  select count(*) into v_qtd
    from public.estabelecimento_galeria
   where estabelecimento_id = new.estabelecimento_id;

  if v_qtd >= v_max then
    raise exception 'galeria_cheia: limite tecnico de % imagens por estabelecimento', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger trg_estab_galeria_limite
  before insert on public.estabelecimento_galeria
  for each row execute function private.checar_limite_galeria();

-- ------------------------------------------------------------
-- GRANTS + RLS
-- ------------------------------------------------------------
alter table public.estabelecimento_galeria enable row level security;

revoke all on table public.estabelecimento_galeria from anon, authenticated;
grant  select on table public.estabelecimento_galeria to anon, authenticated;
grant  insert, delete on table public.estabelecimento_galeria to authenticated;
-- Só `ordem`. Repontar `imagem` ou mudar `estabelecimento_id` de uma linha já
-- publicada trocaria o que o consumidor vê sem passar por lugar nenhum.
grant  update (ordem) on table public.estabelecimento_galeria to authenticated;

-- Leitura pública: EXATAMENTE a visibilidade do perfil
-- ("estabelecimentos: publico le ativos", migration 3). Perfil escondido,
-- galeria escondida — sem um segundo contrato para divergir do primeiro.
create policy "estab_galeria: publico le de estabelecimento ativo"
  on public.estabelecimento_galeria for select to anon, authenticated
  using (
    exists (
      select 1 from public.estabelecimentos e
       where e.id = estabelecimento_id
         and e.status = 'ativo'
    )
  );

-- O dono lê a própria mesmo com estabelecimento `pendente`/`suspenso` — é o
-- que faz o portal e o /e funcionarem antes da aprovação (mesmo raciocínio da
-- policy de leitura do próprio estabelecimento, migration 3).
create policy "estab_galeria: dono e admin leem a propria"
  on public.estabelecimento_galeria for select to authenticated
  using (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  );

create policy "estab_galeria: dono insere na propria"
  on public.estabelecimento_galeria for insert to authenticated
  with check (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  );

-- USING **e** WITH CHECK: sem o WITH CHECK, um UPDATE poderia mover a linha
-- para fora do alcance de quem a alterou. Aqui só `ordem` é gravável (grant
-- por coluna acima), mas a policy não depende disso para estar correta.
create policy "estab_galeria: dono reordena a propria"
  on public.estabelecimento_galeria for update to authenticated
  using (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  )
  with check (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  );

create policy "estab_galeria: dono remove da propria"
  on public.estabelecimento_galeria for delete to authenticated
  using (
    (select private.owns_estabelecimento(estabelecimento_id))
    or (select private.is_admin())
  );

-- ------------------------------------------------------------
-- RPC: persistir a ordem inteira, de uma vez
--
-- Reordenar por UPDATEs soltos via PostgREST daria N viagens sem transação:
-- uma falha no meio deixaria a galeria com ordem parcial. Aqui é um comando
-- só, atômico, e a posse é provada a partir das PRÓPRIAS LINHAS.
--
-- MULTI-ESTABELECIMENTO: o estabelecimento NÃO é adivinhado a partir da
-- sessão (`order by id limit 1`, como faz o CRM) — ele é DERIVADO das linhas
-- enviadas e depois confrontado com a posse. Um lojista com cinco
-- estabelecimentos reordena a galeria de qualquer um deles sem que esta
-- função precise escolher um. Não conserta o problema multi-estab global do
-- app, mas não o amplia.
-- ------------------------------------------------------------
create or replace function public.reordenar_galeria_estabelecimento(p_ids uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  v_uid    uuid := (select auth.uid());
  v_achou  int;
  v_min    text;
  v_max    text;
  v_total  int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('ok', false, 'motivo', 'lista_vazia');
  end if;

  -- `count(distinct id)`: uma lista com id repetido não fecha a conta e cai
  -- em `nao_encontrado` em vez de gravar ordem torta.
  select count(distinct g.id), min(g.estabelecimento_id), max(g.estabelecimento_id)
    into v_achou, v_min, v_max
    from public.estabelecimento_galeria g
   where g.id = any(p_ids);

  if v_achou is distinct from array_length(p_ids, 1) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  -- Lista misturando estabelecimentos: recusa. Reordenar é uma operação
  -- DENTRO de uma galeria.
  if v_min is distinct from v_max then
    return jsonb_build_object('ok', false, 'motivo', 'mistura_estabelecimentos');
  end if;

  if not (
    (select private.owns_estabelecimento(v_min))
    or (select private.is_admin())
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado');
  end if;

  -- A lista tem de ser a galeria COMPLETA. Uma lista parcial produziria
  -- posições duplicadas com as linhas que ficaram de fora.
  select count(*) into v_total
    from public.estabelecimento_galeria g
   where g.estabelecimento_id = v_min;

  if v_total is distinct from v_achou then
    return jsonb_build_object('ok', false, 'motivo', 'lista_incompleta');
  end if;

  update public.estabelecimento_galeria g
     set ordem = t.pos - 1
    from unnest(p_ids) with ordinality as t(gid, pos)
   where g.id = t.gid;

  return jsonb_build_object('ok', true, 'estabelecimento_id', v_min, 'total', v_total);
end;
$fn$;

comment on function public.reordenar_galeria_estabelecimento(uuid[]) is
  'CLIENT-RETURNS-03: grava a ordem inteira da galeria de UM estabelecimento, atomicamente. Posse derivada das linhas, nunca da URL nem do form.';

revoke execute on function public.reordenar_galeria_estabelecimento(uuid[]) from public, anon;
grant  execute on function public.reordenar_galeria_estabelecimento(uuid[]) to authenticated;
