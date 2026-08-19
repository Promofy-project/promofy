-- ============================================================
-- Promofy — Fase 9/D1 · Migration 33: ciclo de vida do cupom
--
-- O DIAGNÓSTICO QUE ORIGINOU ESTA MIGRATION:
--
-- `esgotado` e `expirado` existiam no enum desde a migration 1 e apareciam
-- nas telas, mas NENHUMA linha de código os gravava. Os dois únicos cupons
-- nesses estados vinham do `seed.sql`, como vitrine — e mediram-se
-- dessincronizados do próprio dado: o "expirado" tinha validade futura e o
-- "esgotado" tinha 500 resgates em `cupom_eventos` e ZERO validações em
-- `cupons_usuario`, que é a contabilidade que de fato governa a admissão.
--
-- Enquanto isso, o esgotamento real acontecia sem deixar rastro no status:
-- `ativar_cupom` recusava com motivo 'esgotado' contando `cupons_usuario`, e
-- o cupom seguia 'ativo' na coluna. O vencimento idem — quem tirava o cupom
-- do catálogo era o filtro `validade_fim >= hoje` na leitura.
--
-- Esta migration faz os dois estados passarem a existir de verdade, cada um
-- pelo caminho que corresponde à sua natureza.
--
-- (1) ESGOTADO — NASCE NA VALIDAÇÃO, porque é lá que o contador cresce.
--
--     `validar_cupom` já serializava a linha do cupom (`for update`) para o
--     recheck autoritativo do limite. A materialização entra DEPOIS do
--     update da ativação, na MESMA transação e sob o MESMO lock: se esta
--     validação é a que alcança `limite_total`, o cupom sai 'esgotado' junto
--     com ela. Não há janela entre "esgotou" e "está marcado como esgotado",
--     e duas validações concorrentes não passam do limite — o lock já
--     garantia isso antes desta migration.
--
--     `limite_total is null` (ilimitado, migration 17) nunca esgota. E a
--     contagem é de `cupons_usuario.status = 'validado'`: `cupom_eventos`
--     NÃO é fonte de limite, é métrica de funil, e confundir as duas foi
--     justamente o que fez o seed parecer esgotado sem estar.
--
-- (2) EXPIRADO — É DERIVADO DA DATA, e continua sendo.
--
--     Não há job periódico aqui, de propósito: um cron que varresse a tabela
--     todo dia só para "deixar a coluna bonita" acrescentaria uma peça
--     móvel, um horário de execução e um modo de falha novos para produzir
--     uma informação que a data já carrega. Quem lê já sabe responder
--     "venceu?" com `validade_fim < hoje_brt()`, e o Portal passa a
--     apresentar isso como o estado "Expirado" (Fase 9/D1, no front).
--
--     O que a coluna PRECISA fazer é fechar o ciclo quando o lojista
--     prorroga: um cupom vencido que ganha validade futura NÃO pode voltar
--     ao ar sozinho — a decisão de produto é explícita, prorrogar passa por
--     moderação. É isso que o trigger abaixo garante, e ele age no único
--     instante em que a resposta muda: o UPDATE.
-- ============================================================

-- ------------------------------------------------------------
-- (1) VALIDAR CUPOM — mesma função da migration 7, com o carimbo do
--     esgotamento no fim. Tudo que já existia continua idêntico: posse,
--     cupom próprio, idempotência, expiração lazy da ativação, recheck
--     autoritativo do limite, evento de validação e crédito de pontos.
-- ------------------------------------------------------------
create or replace function public.validar_cupom(p_codigo text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v record;
  v_validacoes int;
  v_pontos int;
  v_cliente record;
begin
  if v_uid is null
     or not exists (select 1 from public.estabelecimentos where owner_id = v_uid) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  select cu.id, cu.usuario_id, cu.cupom_id, cu.status, cu.expira_em, cu.codigo,
         c.titulo, c.beneficio, c.limite_total, e.owner_id
    into v
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
    join public.estabelecimentos e on e.id = c.estabelecimento_id
   where cu.codigo = v_codigo
     for update of cu;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v.owner_id <> v_uid then
    return jsonb_build_object('ok', false, 'motivo', 'outro_estabelecimento');
  end if;
  if v.usuario_id = v_uid then
    -- lojista não valida (nem pontua) o próprio cupom
    return jsonb_build_object('ok', false, 'motivo', 'cupom_proprio');
  end if;
  if v.status = 'validado' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_validado');
  end if;
  if v.status = 'expirado' then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if v.expira_em <= now() then
    update public.cupons_usuario set status = 'expirado' where id = v.id;
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;

  -- recheck AUTORITATIVO do limite total, serializado pela linha do cupom
  if v.limite_total is not null then
    perform 1 from public.cupons where id = v.cupom_id for update;
    select count(*) into v_validacoes
      from public.cupons_usuario
     where cupom_id = v.cupom_id and status = 'validado';
    if v_validacoes >= v.limite_total then
      return jsonb_build_object('ok', false, 'motivo', 'esgotado');
    end if;
  end if;

  update public.cupons_usuario
     set status = 'validado', validado_em = now()
   where id = v.id;

  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (v.cupom_id, v.usuario_id, 'validacao');

  select pontos into v_pontos from public.config_pontos where acao = 'resgate';
  insert into public.pontos_transacoes (usuario_id, acao, pontos, referencia_id)
  values (v.usuario_id, 'resgate', coalesce(v_pontos, 0), v.id::text);
  -- (índice único usuario/acao/referencia garante 1 crédito por resgate)

  -- ---------- FASE 9/D1: o esgotamento vira estado ----------
  -- Recontagem DEPOIS do update: v_validacoes acima é "antes desta", e o que
  -- importa aqui é se ESTA validação foi a que fechou a campanha. Sob o
  -- mesmo `for update` de cima — nenhuma concorrente entra no meio.
  --
  -- Só toca cupom 'ativo': um cupom já 'esgotado' não precisa ser remarcado,
  -- e 'pendente'/'rejeitado'/'excluido' não são estados que o balcão deva
  -- reescrever (validar um código continua funcionando para eles, porque a
  -- promessa foi feita quando o cupom estava no ar — ver migration 32).
  if v.limite_total is not null then
    select count(*) into v_validacoes
      from public.cupons_usuario
     where cupom_id = v.cupom_id and status = 'validado';
    if v_validacoes >= v.limite_total then
      update public.cupons
         set status = 'esgotado',
             atualizado_em = now(),
             moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
               || jsonb_build_array(jsonb_build_object(
                    'em', now(),
                    'acao', 'esgotado',
                    'por', null,
                    'validacoes', v_validacoes
                  ))
       where id = v.cupom_id and status = 'ativo';
    end if;
  end if;

  select nome, cpf into v_cliente from public.profiles where id = v.usuario_id;

  return jsonb_build_object('ok', true, 'dados', jsonb_build_object(
    'codigo', v.codigo,
    'titulo', v.titulo,
    'beneficio', v.beneficio,
    'cliente_nome', coalesce(v_cliente.nome, ''),
    'cliente_cpf', public.mascarar_cpf(v_cliente.cpf),
    'validado_em', now()
  ));
end;
$$;

comment on function public.validar_cupom(text) is
  'Fase 2 + 9/D1: valida o código no balcão, credita pontos e — quando esta validação alcança limite_total — carimba o cupom como esgotado na mesma transação.';

-- ------------------------------------------------------------
-- (2) CICLO DE VIDA NA EDIÇÃO — validade ↔ status
--
-- Trigger SEPARADO do `checar_edicao_cupom` (migration 20) de propósito:
-- aquele é a matriz de imutabilidade, uma barreira que RECUSA; este é uma
-- regra de coerência, que AJUSTA. Misturar os dois faria uma função de 250
-- linhas responder a duas perguntas diferentes, e obrigaria a reescrevê-la
-- inteira para mudar meia regra.
--
-- A ordem importa e está garantida: o Postgres dispara triggers de mesmo
-- tipo em ordem alfabética de NOME, e `trg_cupons_ciclo_vida` vem depois de
-- `trg_cupons_checar_edicao`. Ou seja, este roda com o `new` já validado (e
-- já possivelmente rebaixado para 'pendente' pela materialidade), e tem a
-- última palavra sobre a relação entre validade e status.
--
-- AGE PARA TODOS, inclusive service_role e seed: não é regra de permissão
-- (aí a isenção do admin faria sentido, como na 20), é coerência de dado.
-- Um cupom 'ativo' com validade vencida é um estado que não deveria existir,
-- independentemente de quem escreveu.
-- ------------------------------------------------------------
create or replace function public.aplicar_ciclo_vida_cupom()
returns trigger
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_hoje date := public.hoje_brt();
  v_estava_vencido boolean;
begin
  -- "estava vencido" = o estado ANTERIOR já não valia mais, seja porque a
  -- coluna dizia 'expirado', seja porque a data dizia (o caso comum: o
  -- cupom vence sozinho e ninguém toca nele até o lojista voltar).
  v_estava_vencido :=
       old.status = 'expirado'
    or (old.status = 'ativo' and old.validade_fim < v_hoje);

  -- (a) PRORROGAÇÃO → volta para a fila, nunca direto ao ar.
  --     Decisão de produto da D1: expirado é a MESMA campanha continuando,
  --     então preserva id, métricas e histórico — mas não pula a moderação.
  if v_estava_vencido and new.validade_fim >= v_hoje
     and new.status in ('ativo', 'expirado') then
    new.status := 'pendente';
    new.moderacao_historico := coalesce(new.moderacao_historico, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
           'em', now(),
           'acao', 'prorrogado',
           'por', auth.uid(),
           'validade_fim', new.validade_fim
         ));

  -- (b) VENCIMENTO → o estado alcança a data.
  --     Só a partir de 'ativo': 'pendente' e 'rejeitado' têm ciclo próprio
  --     (o lojista ainda está mexendo), e 'excluido' é arquivo — nenhum
  --     deles deve ser reescrito por uma data.
  elsif new.status = 'ativo' and new.validade_fim < v_hoje then
    new.status := 'expirado';
  end if;

  return new;
end;
$$;

revoke execute on function public.aplicar_ciclo_vida_cupom() from public, anon, authenticated;

drop trigger if exists trg_cupons_ciclo_vida on public.cupons;
create trigger trg_cupons_ciclo_vida
  before update on public.cupons
  for each row execute function public.aplicar_ciclo_vida_cupom();

comment on function public.aplicar_ciclo_vida_cupom() is
  'Fase 9/D1: coerência validade↔status. Vencido que ganha data futura volta para moderação (pendente); ativo com data vencida vira expirado.';
