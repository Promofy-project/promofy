-- ============================================================
-- Promofy — Fase 5 · Migration 15
--
-- 1) JANELA DE CONSUMO NO SERVIDOR (o item que não é cosmético)
--    Até aqui `ativar_cupom` só checava validade_inicio/validade_fim:
--    um cupom "Seg a Sex, 11h às 15h" podia ser ativado num domingo
--    às 3h, nascia com 5h de prazo e o consumidor PERDIA o cupom.
--    A barreira real passa a ser o servidor (motivo 'fora_da_janela');
--    o botão esmaecido na UI é só espelho.
--
-- 2) PONTOS CREDITADOS NO RETORNO — para a animação "+N" refletir o
--    valor REAL que o banco creditou, nunca um número fixo no cliente.
--
-- 3) USOS POR CUPOM — quantas vezes o usuário já consumiu cada cupom
--    e quantas ainda restam, para o selo "utilizado" aparecer só
--    quando não há mais uso disponível.
--
-- Tudo aditivo: nenhuma chave existente de jsonb muda de forma ou
-- de significado, e nenhuma migration já aplicada é editada.
-- ============================================================

-- ------------------------------------------------------------
-- HELPER: dentro da janela de consumo (dias + horário), fuso BRT
--
-- DECISÃO DE DESIGN — dado malformado é "SEM RESTRIÇÃO" (true),
-- nunca "fora da janela" e NUNCA exceção. Motivo concreto: o form
-- do portal tem `<Input type="time">` sem `required`, então o
-- lojista consegue gravar {"dias":["Sex"],"inicio":"","fim":""}.
-- A coluna não tem CHECK e o lojista ainda pode escrever `horarios`
-- direto via PostgREST (grant por coluna da Fase 3). Um ''::time
-- aqui dentro abortaria a transação de `ativar_cupom` (security
-- definer, sem bloco exception) → 500 → a Server Action devolveria
-- motivo 'erro' e o cupom aprovado ficaria PERMANENTEMENTE
-- inativável, sem diagnóstico. Por isso: saneia, não confia.
--
-- `stable` (lê now(), não escreve). O espelho puro em TS
-- (src/lib/janela.ts) replica estas regras byte a byte — a suíte
-- da Fase 5 prova a paridade caso a caso, inclusive nos malformados.
-- ------------------------------------------------------------
create or replace function public.dentro_da_janela(p_horarios jsonb)
returns boolean
language plpgsql stable set search_path = ''
as $$
declare
  v_agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_dias jsonb;
  v_dia text;
  v_inicio text;
  v_fim text;
  v_hi time;
  v_hf time;
  v_hora time;
begin
  -- sem objeto de horários (null, array, escalar) → sem restrição
  if p_horarios is null or jsonb_typeof(p_horarios) <> 'object' then
    return true;
  end if;

  -- ---------- DIA DA SEMANA ----------
  -- Só restringe quando `dias` é um array NÃO vazio. Escalar ("Seg"),
  -- objeto, ausente ou [] = sem restrição de dia (mesma tolerância de
  -- diasDeJson em src/lib/data/cupons.ts).
  v_dias := p_horarios -> 'dias';
  if jsonb_typeof(v_dias) = 'array' and jsonb_array_length(v_dias) > 0 then
    -- isodow: 1=Seg … 7=Dom — mesma ordem de DIAS_SEMANA (src/lib/dias.ts)
    v_dia := (array['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])[
      extract(isodow from v_agora)::int
    ];
    if not exists (
      select 1
        from jsonb_array_elements_text(v_dias) as d
       where d = v_dia
          or (v_dia = 'Sáb' and d = 'Sab')  -- tolera o label sem acento
    ) then
      return false;
    end if;
  end if;

  -- ---------- HORÁRIO ----------
  -- NUNCA castar direto: string vazia ou lixo = sem restrição de hora.
  v_inicio := nullif(btrim(coalesce(p_horarios ->> 'inicio', '')), '');
  v_fim    := nullif(btrim(coalesce(p_horarios ->> 'fim', '')), '');
  if v_inicio is null or v_fim is null
     or v_inicio !~ '^[0-9]{1,2}:[0-9]{2}$'
     or v_fim    !~ '^[0-9]{1,2}:[0-9]{2}$' then
    return true;
  end if;

  v_hi := v_inicio::time;
  v_hf := v_fim::time;
  -- truncar ao minuto é OBRIGATÓRIO: sem isso um cupom 00:00–23:59
  -- (o padrão que o /e grava) ficaria bloqueado de 23:59:01 a 23:59:59
  v_hora := (date_trunc('minute', v_agora))::time;

  if v_hi <= v_hf then
    return v_hora >= v_hi and v_hora <= v_hf;
  else
    -- janela que cruza a meia-noite (ex.: 22:00–02:00)
    return v_hora >= v_hi or v_hora <= v_hf;
  end if;
end;
$$;

comment on function public.dentro_da_janela(jsonb) is
  'Fase 5: o cupom pode ser consumido AGORA (fuso America/Sao_Paulo)? horarios malformado = sem restrição, nunca exceção.';

-- ------------------------------------------------------------
-- ATIVAR CUPOM — idêntica à Fase 2, mais a checagem de janela.
--
-- Diferenças em relação a 20260713112043_fase2_rpcs.sql:
--   * `c.horarios` entra no select do cupom;
--   * bloco novo logo DEPOIS de 'fora_da_validade' → 'fora_da_janela'.
-- O ramo idempotente (ja_ativo) continua ANTES da checagem: quem já
-- tem ativação vigente reabre o mesmo código mesmo fora da janela —
-- não se perde o que já foi ativado dentro dela.
-- ------------------------------------------------------------
create or replace function public.ativar_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cupom record;
  v_row public.cupons_usuario%rowtype;
  v_consumidas int;
  v_validacoes int;
  v_tentativa int := 0;
  v_constraint text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  -- expiração lazy: libera a vaga de ativações vencidas
  update public.cupons_usuario
     set status = 'expirado'
   where usuario_id = v_uid and cupom_id = p_cupom_id
     and status = 'ativo' and expira_em <= now();

  -- já existe ativação vigente → idempotente (reabre o mesmo código)
  select * into v_row
    from public.cupons_usuario
   where usuario_id = v_uid and cupom_id = p_cupom_id and status = 'ativo';
  if found then
    return jsonb_build_object('ok', true, 'ja_ativo', true,
      'estado', public.estado_cupom_json(v_row));
  end if;

  select c.id, c.status, c.validade_inicio, c.validade_fim,
         c.limite_por_usuario, c.limite_total, c.prazo_ativacao_horas,
         c.horarios, e.status as est_status
    into v_cupom
    from public.cupons c
    join public.estabelecimentos e on e.id = c.estabelecimento_id
   where c.id = p_cupom_id;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v_cupom.status <> 'ativo' or v_cupom.est_status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;
  if (v_cupom.validade_inicio is not null and v_cupom.validade_inicio > public.hoje_brt())
     or v_cupom.validade_fim < public.hoje_brt() then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_validade');
  end if;

  -- FASE 5: dia/horário de consumo do cupom (barreira real; a UI só espelha)
  if not public.dentro_da_janela(v_cupom.horarios) then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela');
  end if;

  -- limite por usuário: validadas + ativas vigentes consomem vaga;
  -- expiradas liberam (interpretação documentada no relatório da fase)
  select count(*) into v_consumidas
    from public.cupons_usuario
   where usuario_id = v_uid and cupom_id = p_cupom_id
     and (status = 'validado' or (status = 'ativo' and expira_em > now()));
  if v_consumidas >= v_cupom.limite_por_usuario then
    return jsonb_build_object('ok', false, 'motivo', 'limite_usuario');
  end if;

  -- limite total (checagem de admissão; a autoritativa é na validação)
  if v_cupom.limite_total is not null then
    select count(*) into v_validacoes
      from public.cupons_usuario
     where cupom_id = p_cupom_id and status = 'validado';
    if v_validacoes >= v_cupom.limite_total then
      return jsonb_build_object('ok', false, 'motivo', 'esgotado');
    end if;
  end if;

  -- insert com tratamento de corrida/colisão por constraint
  loop
    begin
      insert into public.cupons_usuario (usuario_id, cupom_id, expira_em)
      values (v_uid, p_cupom_id,
              now() + make_interval(hours => coalesce(v_cupom.prazo_ativacao_horas, 5)))
      returning * into v_row;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'uniq_cupons_usuario_ativo' then
        -- corrida: outra requisição do mesmo usuário venceu → idempotente
        select * into v_row
          from public.cupons_usuario
         where usuario_id = v_uid and cupom_id = p_cupom_id and status = 'ativo';
        if found then
          return jsonb_build_object('ok', true, 'ja_ativo', true,
            'estado', public.estado_cupom_json(v_row));
        end if;
        raise;
      elsif v_constraint = 'cupons_usuario_codigo_key' then
        v_tentativa := v_tentativa + 1;
        if v_tentativa > 2 then raise; end if;
        -- loop de novo: o default gera outro código
      else
        raise;
      end if;
    end;
  end loop;

  -- evento de ativação na MESMA transação (métricas derivadas)
  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, 'ativacao');

  return jsonb_build_object('ok', true, 'ja_ativo', false,
    'estado', public.estado_cupom_json(v_row));
end;
$$;

-- ------------------------------------------------------------
-- RESPONDER NPS — idêntica à Fase 2, mais 'pontos' no retorno.
--
-- 'pontos' = o que REALMENTE foi creditado nesta chamada (vem do
-- RETURNING do insert). Se o insert não gravou (índice único de
-- idempotência) ou se já havia resposta, devolve 0 — o cliente não
-- pode animar "+30" sem crédito por trás.
-- ------------------------------------------------------------
create or replace function public.responder_nps(p_row_id bigint, p_nota int)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v public.cupons_usuario%rowtype;
  v_pontos int;
  v_creditado int;
  v_saldo int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;
  if p_nota is null or p_nota < 0 or p_nota > 10 then
    return jsonb_build_object('ok', false, 'motivo', 'nota_invalida');
  end if;

  select * into v from public.cupons_usuario
   where id = p_row_id and usuario_id = v_uid
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v.status <> 'validado' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_validado');
  end if;

  if v.nps is not null then
    select coalesce(sum(pontos), 0) into v_saldo
      from public.pontos_transacoes where usuario_id = v_uid;
    return jsonb_build_object('ok', true, 'ja_respondido', true,
      'saldo', v_saldo, 'pontos', 0);
  end if;

  update public.cupons_usuario set nps = p_nota where id = v.id;

  select pontos into v_pontos from public.config_pontos where acao = 'nps';
  insert into public.pontos_transacoes (usuario_id, acao, pontos, referencia_id)
  values (v_uid, 'nps', coalesce(v_pontos, 0), v.id::text)
  on conflict do nothing  -- cinto extra sobre o índice único
  returning pontos into v_creditado;

  select coalesce(sum(pontos), 0) into v_saldo
    from public.pontos_transacoes where usuario_id = v_uid;

  return jsonb_build_object('ok', true, 'ja_respondido', false,
    'saldo', v_saldo, 'pontos', coalesce(v_creditado, 0));
end;
$$;

-- ------------------------------------------------------------
-- MEU ESTADO CONSUMIDOR — idêntica à Fase 2, mais:
--   * `pontos_resgate` em cada item de `estados` (quanto o banco
--     creditou por AQUELE resgate — dispara a animação "+N" quando
--     o polling detecta ativo → validado);
--   * `usos`: agregado por cupom com consumidos/limite/restantes.
--
-- `consumidos` usa EXATAMENTE a mesma expressão de ativar_cupom
-- (validado OU ativo vigente) — se divergir, o selo da UI mente
-- sobre a regra que o servidor aplica.
--
-- Continua SECURITY INVOKER: `pontos_transacoes` é lida sob a policy
-- "usuario_id = auth.uid()" e o join em `cupons` sob a RLS do
-- catálogo. Cupom cujo estabelecimento foi suspenso simplesmente
-- some de `usos` → a UI não mostra selo (falha para o lado seguro).
--
-- `estado_cupom_json` NÃO é alterada de propósito: ela é `immutable`
-- e também roda dentro de ativar_cupom. O enriquecimento é feito
-- aqui, por merge de jsonb, só no caminho de leitura.
-- ------------------------------------------------------------
create or replace function public.meu_estado_consumidor()
returns jsonb
language sql stable
security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'usuario', (
      select jsonb_build_object('nome', nome, 'cpf_mascarado', public.mascarar_cpf(cpf))
        from public.profiles where id = (select auth.uid())
    ),
    'saldo', (
      select coalesce(sum(pontos), 0)::int
        from public.pontos_transacoes where usuario_id = (select auth.uid())
    ),
    'config', (
      select coalesce(jsonb_object_agg(acao::text, pontos), '{}'::jsonb)
        from public.config_pontos
    ),
    'estados', coalesce((
      select jsonb_agg(
               public.estado_cupom_json(cu) || jsonb_build_object(
                 'pontos_resgate', coalesce((
                   select pt.pontos
                     from public.pontos_transacoes pt
                    where pt.usuario_id = cu.usuario_id
                      and pt.acao = 'resgate'
                      and pt.referencia_id = cu.id::text
                    limit 1
                 ), 0)
               )
               order by cu.ativado_em desc)
        from public.cupons_usuario cu
       where cu.usuario_id = (select auth.uid())
         and (cu.status = 'validado' or (cu.status = 'ativo' and cu.expira_em > now()))
    ), '[]'::jsonb),
    'usos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'cupom_id', u.cupom_id,
               'consumidos', u.consumidos,
               'limite', u.limite,
               'restantes', greatest(u.limite - u.consumidos, 0)
             ))
        from (
          select cu.cupom_id,
                 count(*) filter (
                   where cu.status = 'validado'
                      or (cu.status = 'ativo' and cu.expira_em > now())
                 )::int as consumidos,
                 max(c.limite_por_usuario)::int as limite
            from public.cupons_usuario cu
            join public.cupons c on c.id = cu.cupom_id
           where cu.usuario_id = (select auth.uid())
           group by cu.cupom_id
        ) u
    ), '[]'::jsonb)
  );
$$;

-- ------------------------------------------------------------
-- GRANTS
--
-- `create or replace function` PRESERVA dono e grants das funções
-- já existentes; o bloco abaixo é reafirmação idempotente (barato,
-- e documenta a intenção junto do corpo novo).
--
-- `dentro_da_janela` é nova: pura sobre um argumento jsonb, não lê
-- tabela nenhuma. O grant a `authenticated` existe para a suíte
-- provar a paridade SQL↔TS caso a caso — inclusive nos malformados,
-- onde o valor do teste é justamente mostrar que o SQL devolve
-- booleano em vez de levantar exceção.
-- ------------------------------------------------------------
revoke execute on function public.dentro_da_janela(jsonb) from public, anon;
grant execute on function public.dentro_da_janela(jsonb) to authenticated;

revoke execute on function
  public.ativar_cupom(text),
  public.responder_nps(bigint, int),
  public.meu_estado_consumidor()
from public, anon;

grant execute on function
  public.ativar_cupom(text),
  public.responder_nps(bigint, int),
  public.meu_estado_consumidor()
to authenticated;
