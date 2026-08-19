-- ============================================================
-- Promofy — Fase 9/D1 · Migration 34: a ativação RESERVA a vaga
--
-- ARQUIVO PRÓPRIO, separado da 33, e o motivo é de risco: cada uma
-- substitui uma RPC crítica diferente do ciclo do cupom (a 33 troca
-- `validar_cupom`, esta troca `ativar_cupom`). Juntá-las faria um único
-- arquivo reescrever as duas pontas do fluxo do balcão de uma vez, e
-- qualquer revisão ou rollback teria de tratar as duas como um bloco só.
--
-- A REGRA QUE MUDA:
--
--   Antes: só `validado` consumia `limite_total`. Consequência medida em
--   teste concorrente com `limite_total = 1` — DOIS consumidores ativaram
--   ao mesmo tempo e ficaram ambos com código vivo ("ativos vigentes: 2 |
--   validados: 0 | limite: 1"). A vaga só era decidida no balcão, então um
--   dos dois ia ouvir "esgotado" na frente do caixa, com o código na mão.
--
--   Agora: uma ativação vigente RESERVA uma unidade. A capacidade passa a
--   ser `validados + ativos_vigentes`, e quem ativou legitimamente enquanto
--   havia vaga tem aquela unidade garantida até validar ou expirar.
--
-- O QUE **NÃO** MUDA, e é deliberado:
--
--   `validar_cupom` continua contando SÓ `validado` (migration 33). Isso é
--   o que permite a reserva virar validação: a linha que está validando já
--   reservou a própria vaga, e contá-la de novo faria a função recusar
--   exatamente quem tinha direito. A transição `ativo → validado` não
--   aumenta o consumo — converte reservado em consumido.
--
--   E o CARIMBO `esgotado` continua sendo só de validações. Sem vagas por
--   reserva é estado TEMPORÁRIO: se a ativação expira sem uso, a vaga
--   volta sozinha (a contagem tem `expira_em > now()`, então a linha vencida
--   deixa de pesar sem precisar de varredura). Carimbar o cupom por causa de
--   uma reserva o tiraria da vitrine — a policy pública filtra por status —
--   e uma reserva que expirasse deixaria a campanha morta sem ninguém ter
--   consumido nada.
--
-- ONDE O LOCK ENTRA — e por que NÃO no lugar óbvio:
--
--   A primeira versão desta migration pegava o lock junto da contagem de
--   capacidade, logo antes do insert. O teste concorrente derrubou a ideia
--   com um DEADLOCK REAL:
--
--     ERROR: deadlock detected
--     while locking tuple (1,8) in relation "cupons"
--     SQL statement "SELECT 1 from public.cupons where id = p_cupom_id for update"
--
--   A causa é o clique. `cupom_eventos.cupom_id` tem FK para `cupons`, e
--   todo INSERT nessa tabela adquire um **FOR KEY SHARE** na linha do cupom.
--   As duas transações registravam o clique (KEY SHARE, compatíveis entre
--   si) e só depois pediam FOR UPDATE — cada uma esperando a outra soltar o
--   KEY SHARE que ela mesma segurava. Deadlock de *upgrade* de lock, o tipo
--   que não aparece em teste sequencial.
--
--   A correção é adquirir o lock ANTES de qualquer KEY SHARE, ou seja antes
--   do clique. Quem chega primeiro segura a linha inteira; quem chega depois
--   espera na porta, e não no meio da transação com lock parcial na mão.
--
--   Só entra quando há `limite_total`: cupom ilimitado não tem capacidade a
--   disputar e não paga serialização nenhuma.
--
--   E não há ciclo com `validar_cupom`, que trava a ativação antes do cupom:
--   para fechar um ciclo, esta função precisaria esperar por uma linha de
--   `cupons_usuario` que a outra detivesse — a expiração lazy só toca linhas
--   VENCIDAS do próprio usuário, e diante de uma dessas `validar_cupom`
--   retorna 'expirado' antes de sequer pedir o lock do cupom.
-- ============================================================

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
  v_capacidade int;
  v_tentativa int := 0;
  v_constraint text;
  v_alcance jsonb;
  v_teto timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  -- A BUSCA DO CUPOM VEM PRIMEIRO — mudou de lugar em relação à 17, e o
  -- motivo é o clique logo abaixo: `cupom_eventos.cupom_id` tem FK para
  -- `cupons`, então gravar clique de um id inexistente aborta a transação
  -- com violação de FK em vez de devolver `nao_encontrado`.
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

  -- ---------- SERIALIZAÇÃO DA ADMISSÃO (Fase 9/D1) ----------
  -- ANTES do clique, de propósito — ver o cabeçalho: o insert em
  -- `cupom_eventos` adquire FOR KEY SHARE nesta mesma linha (FK), e pedir o
  -- FOR UPDATE depois disso é o upgrade de lock que produziu deadlock entre
  -- duas ativações simultâneas. Aqui a linha é tomada inteira, de uma vez.
  if v_cupom.limite_total is not null then
    perform 1 from public.cupons where id = p_cupom_id for update;
  end if;

  -- (B) clique: intenção do consumidor, contada mesmo quando a tentativa
  -- é recusada logo abaixo (migration 30).
  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, 'clique');

  -- expiração lazy: libera a vaga de ativações vencidas DESTE usuário.
  -- Continua sendo só do próprio: a capacidade global abaixo não depende
  -- desta limpeza, porque ela filtra por `expira_em > now()` — uma linha
  -- vencida de outra pessoa já não pesa, mesmo ainda marcada 'ativo'.
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
  -- Campanha encerrada por consumo tem motivo PRÓPRIO. Antes da D1 o status
  -- 'esgotado' nunca era gravado, então cair no genérico 'indisponivel' não
  -- tinha custo; agora ele existe de verdade, e dizer "indisponível" a quem
  -- chegou tarde numa campanha que acabou esconde a informação útil.
  -- `esgotado` já é motivo conhecido do cliente desde a Fase 2 — o contrato
  -- não muda, só fica mais preciso.
  if v_cupom.status = 'esgotado' then
    return jsonb_build_object('ok', false, 'motivo', 'esgotado');
  end if;
  if v_cupom.status <> 'ativo' or v_cupom.est_status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;
  if (v_cupom.validade_inicio is not null and v_cupom.validade_inicio > public.hoje_brt())
     or v_cupom.validade_fim < public.hoje_brt() then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_validade');
  end if;

  -- (A) FASE 9/QA: a janela precisa estar aberta agora OU abrir dentro do
  -- prazo (migration 29/30).
  v_alcance := public.janela_alcance(
    v_cupom.horarios, coalesce(v_cupom.prazo_ativacao_horas, 5));
  if not (v_alcance ->> 'alcancavel')::boolean then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela');
  end if;
  v_teto := (v_alcance ->> 'teto')::timestamptz;   -- null = sem restrição de hora

  -- limite por usuário: validadas + ativas vigentes consomem vaga;
  -- expiradas liberam. Limite NULL = ilimitado (migration 17). INTOCADO —
  -- é a cota individual, independente da capacidade da campanha.
  if v_cupom.limite_por_usuario is not null then
    select count(*) into v_consumidas
      from public.cupons_usuario
     where usuario_id = v_uid and cupom_id = p_cupom_id
       and (status = 'validado' or (status = 'ativo' and expira_em > now()));
    if v_consumidas >= v_cupom.limite_por_usuario then
      return jsonb_build_object('ok', false, 'motivo', 'limite_usuario');
    end if;
  end if;

  -- ---------- CAPACIDADE DA CAMPANHA (Fase 9/D1) ----------
  -- A linha do cupom já está travada lá em cima (serializador da admissão),
  -- então esta contagem e o insert abaixo acontecem sem concorrente no meio.
  -- Sem isso, duas requisições liam a mesma capacidade livre e ambas
  -- inseriam: a constraint `uniq_cupons_usuario_ativo` não cobre o caso,
  -- porque ela é por (usuario, cupom) e o problema é entre usuários
  -- DIFERENTES — medido em teste, com `limite_total = 1` e dois códigos
  -- vivos no fim.
  if v_cupom.limite_total is not null then
    select count(*) into v_capacidade
      from public.cupons_usuario
     where cupom_id = p_cupom_id
       and (status = 'validado'
            or (status = 'ativo' and expira_em > now()));

    if v_capacidade >= v_cupom.limite_total then
      -- Mesmo motivo de antes: o contrato com o cliente não muda. Para quem
      -- está na tela, "esgotado" é a mesma resposta — o que mudou é que
      -- agora ela é honesta antes do balcão, e não depois.
      return jsonb_build_object('ok', false, 'motivo', 'esgotado');
    end if;
  end if;

  -- insert com tratamento de corrida/colisão por constraint
  loop
    begin
      insert into public.cupons_usuario (usuario_id, cupom_id, expira_em)
      values (v_uid, p_cupom_id,
              -- (A) o prazo, mas nunca além do fim da janela alcançada.
              least(
                now() + make_interval(hours => coalesce(v_cupom.prazo_ativacao_horas, 5)),
                coalesce(v_teto, 'infinity'::timestamptz)
              ))
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

comment on function public.ativar_cupom(text) is
  'Fase 9/D1: a ativação RESERVA a vaga — capacidade = validados + ativos vigentes, serializada pelo lock da linha do cupom. Mantém janela alcançável, teto de expira_em e clique no servidor (migrations 29/30).';

-- `create or replace` preserva o ACL; re-emitidos para a migration ser
-- legível sozinha (mesma prática da 17 e da 30).
revoke execute on function public.ativar_cupom(text) from public, anon;
grant execute on function public.ativar_cupom(text) to authenticated;
