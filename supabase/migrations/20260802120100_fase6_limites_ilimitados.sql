-- ============================================================
-- Promofy — Fase 6 · Migration 17: limite por usuário ILIMITADO (C1)
--
-- A migration 16 permitiu `limite_por_usuario = NULL`. Esta ensina as
-- duas RPCs que leem esse número a tratar NULL como "sem teto" — e,
-- mais importante, PUBLICA a decisão "ainda posso usar?" como campo do
-- contrato, em vez de deixar cada tela derivá-la por conta própria.
--
-- POR QUE `pode_reusar` EXISTE (achado da revisão adversarial, o único
-- que sobreviveu à verificação cética — corrigido ANTES da primeira
-- linha de código de aplicação):
--
--   O plano dizia "com limite NULL, `restantes` vem null e o selo
--   'utilizado' não aparece". Os dois pedaços eram falsos:
--
--   a) `greatest(u.limite - u.consumidos, 0)` com limite NULL devolve
--      **0**, não null — GREATEST ignora NULL. Ou seja, a implementação
--      natural entrega exatamente o valor que significa "acabou".
--   b) `cupom-selo-utilizado.tsx` fazia `if (uso.restantes > 0) return
--      null`. Tanto `null > 0` quanto `0 > 0` são FALSE em JS, então o
--      selo "Utilizado" RENDERIZA — o oposto do documentado.
--   c) `cupom-acao-usar.tsx` decidia só por `status === 'validado'` e
--      nunca lia `usos`. Sendo o ÚNICO ponto de ativação do app, depois
--      da 1ª validação não existiria caminho de UI para a 2ª: o cupom
--      ilimitado subiria inerte, com o servidor aceitando e a tela não
--      oferecendo.
--   d) `UsoCupomDTO` tipava `restantes: number` e o jsonb entra por
--      `as unknown as` — `tsc --noEmit` passaria verde com null em
--      runtime. O compilador não pegaria nada disso.
--
--   A correção é a mesma doutrina da Fase 5 (`usos`, `pontos_resgate`):
--   quando a UI precisa de uma decisão, quem decide é o SERVIDOR e o
--   valor viaja no contrato. `pode_reusar` é escrito como a negação
--   literal da checagem de `ativar_cupom` logo abaixo — uma regra, uma
--   expressão, dois lugares que não podem divergir sem o teste quebrar.
--
-- NOME: `pode_reusar`, não `pode_ativar`. É SÓ a cota por usuário —
-- validade, janela de consumo, `esgotado` e estabelecimento suspenso
-- continuam sendo decididos por `ativar_cupom` e não estão aqui. Um
-- nome mais largo convidaria o próximo call site (e o app nativo) a
-- tratar este booleano como admissão completa, que ele não é.
-- ============================================================

-- ------------------------------------------------------------
-- ATIVAR CUPOM — idêntica à Fase 5, com UMA mudança:
-- a checagem de limite por usuário só roda quando há limite.
--
-- Escrito com `is not null` explícito, no mesmo formato do bloco de
-- `limite_total` logo abaixo. Com NULL a comparação `>=` já daria NULL
-- e o `if` não dispararia sozinho — mas depender disso deixaria a regra
-- invisível para quem lê, e é o tipo de sutileza que alguém "conserta"
-- errado depois. O que NÃO se pode fazer é sentinela
-- (`coalesce(limite, 2147483647)`): a expressão de `pode_reusar` teria
-- de repetir a sentinela para concordar, e aí as duas divergem na
-- primeira vez que alguém mudar uma só.
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
  -- expiradas liberam (interpretação documentada no relatório da fase).
  -- FASE 6: limite NULL = ilimitado — a checagem inteira é pulada.
  if v_cupom.limite_por_usuario is not null then
    select count(*) into v_consumidas
      from public.cupons_usuario
     where usuario_id = v_uid and cupom_id = p_cupom_id
       and (status = 'validado' or (status = 'ativo' and expira_em > now()));
    if v_consumidas >= v_cupom.limite_por_usuario then
      return jsonb_build_object('ok', false, 'motivo', 'limite_usuario');
    end if;
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
-- MEU ESTADO CONSUMIDOR — idêntica à Fase 5, com `usos` enriquecido.
--
--   * `restantes` passa por `case when limite is null` — NUNCA
--     `greatest()` puro, que devolveria 0 para ilimitado (ver o
--     cabeçalho). null aqui significa "não se aplica", e é o que o app
--     nativo vai ler no mesmo jsonb;
--   * `pode_reusar` é a negação literal da checagem de `ativar_cupom`:
--     sem limite, ou ainda não consumiu tudo.
--
-- `consumidos` continua com EXATAMENTE a mesma expressão de
-- `ativar_cupom` — se divergir, o selo da UI mente sobre a regra que o
-- servidor aplica.
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
               'limite', u.limite,                        -- null = ilimitado
               'restantes', case when u.limite is null then null
                                 else greatest(u.limite - u.consumidos, 0) end,
               'pode_reusar', u.limite is null or u.consumidos < u.limite
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

comment on function public.meu_estado_consumidor() is
  'Fase 6: usos[] ganha pode_reusar (negação literal da checagem de ativar_cupom) e restantes null quando o limite é ilimitado.';

-- `create or replace` preserva o ACL das duas funções; as concessões da
-- Fase 5 continuam valendo. Re-emitidas mesmo assim, por baixo custo e
-- para a migration ser legível sozinha.
revoke execute on function
  public.ativar_cupom(text),
  public.meu_estado_consumidor()
from public, anon;

grant execute on function
  public.ativar_cupom(text),
  public.meu_estado_consumidor()
to authenticated;
