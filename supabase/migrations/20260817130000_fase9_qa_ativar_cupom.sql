-- ============================================================
-- Promofy — Fase 9 · Migration 30: ativar_cupom — alcance + clique
--
-- Recria `ativar_cupom` a partir da versão VIGENTE, que é a da migration
-- 17 (limites ilimitados) — NÃO a da 15. Recriar a partir da 15 perderia
-- o tratamento de `limite_por_usuario = NULL` e voltaria a bloquear
-- cupom ilimitado depois da primeira validação.
--
-- `create or replace`: a assinatura não muda, então não há o problema da
-- migration 21 (DROP + CREATE por mudança de parâmetro) nem janela em
-- que o código no ar chame função inexistente. O ACL é preservado; os
-- grants são re-emitidos ao final por baixo custo, como a 17 faz.
--
-- DUAS MUDANÇAS, ambas do relatório de QA v2:
--
-- (A) §3.1 — ADMISSÃO PELO ALCANCE, NÃO PELO INSTANTE.
--     Sai `dentro_da_janela(horarios)`, entra `janela_alcance(horarios,
--     prazo)` (migration 29). Ativar às 17:48 um cupom "18:00–22:00" com
--     prazo de 5h passa a ser aceito, porque o código valeria até 22:48
--     e cobre a janela inteira.
--
--     E `expira_em` ganha TETO no fim da janela alcançada. Isto não é
--     detalhe: sem o teto, o mesmo código valeria até 22:48 e seria
--     validável no balcão às 22:30 — fora do horário que o lojista
--     definiu. A migration 29 explica por que o teto sai da mesma
--     função que a admissão.
--
--     `validar_cupom` continua SEM rechecar janela, e agora isso é
--     deliberado e suficiente: quem carrega a garantia é `expira_em`,
--     que a validação já respeita. Rechecar lá quebraria o caso legítimo
--     de validar 22:00:30 um código ativado às 21:50.
--
-- (B) §3.3 — O CLIQUE VIRA EVENTO DE SERVIDOR.
--     O relatório reportou "mais ativações que cliques" e teorizou
--     ativações em sequência sem fechar a tela. A teoria não se
--     sustenta (toda ativação passa pelo mesmo botão, que registrava o
--     clique), mas o defeito é real por outro motivo: `ativacao` era
--     gravada AQUI, na transação, e `clique` era `void
--     registrarEventoAction(...)` no cliente — fire-and-forget, sem
--     await nem retry. Clique perdido na rede = ativação sem clique, e
--     o funil do portal mostrava a impossibilidade.
--
--     O clique é gravado ANTES de qualquer `return` de recusa, de
--     propósito: tentativa recusada por janela ou limite É intenção do
--     consumidor, e é justamente o que o lojista precisa ver no funil
--     ("clicaram 40, ativaram 3" diz algo). Fica DEPOIS da checagem de
--     sessão (sem `v_uid` não há linha a gravar) e ANTES do ramo
--     idempotente, senão reabrir o cupom ativo não contaria clique.
--
--     A sugestão do relatório — fechar a tela após cada ativação —
--     trataria o sintoma errado e cobraria um toque a mais de quem tem
--     cupom ilimitado.
--
--     ORDEM: a busca do cupom subiu para antes do clique. `cupom_eventos`
--     tem FK para `cupons`, e gravar clique de id inexistente abortava a
--     transação com violação de FK em vez de devolver `nao_encontrado` —
--     acusado pela suíte da Fase 2 na primeira versão desta migration.
--
-- JANELA BANCO-ANTES-CÓDIGO: entre esta migration e o deploy, o clique
-- é contado DUAS vezes (aqui e no cliente, que ainda envia). É aditivo,
-- não quebra nada e se corrige sozinho no deploy. A alternativa — subir
-- o código antes — deixaria a janela SEM clique nenhum, que é pior:
-- perde dado em vez de duplicar.
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
  v_validacoes int;
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
  -- com violação de FK em vez de devolver `nao_encontrado`. A suíte da
  -- Fase 2 acusou exatamente isso na primeira versão desta migration.
  -- Nada mais depende da ordem: a consulta não lê estado que os blocos
  -- seguintes escrevem.
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

  -- (B) clique: intenção do consumidor, contada mesmo quando a tentativa
  -- é recusada logo abaixo. Ver o cabeçalho para a ordem exata.
  insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
  values (p_cupom_id, v_uid, 'clique');

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
  if v_cupom.status <> 'ativo' or v_cupom.est_status <> 'ativo' then
    return jsonb_build_object('ok', false, 'motivo', 'indisponivel');
  end if;
  if (v_cupom.validade_inicio is not null and v_cupom.validade_inicio > public.hoje_brt())
     or v_cupom.validade_fim < public.hoje_brt() then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_validade');
  end if;

  -- (A) FASE 9/QA: a janela precisa estar aberta agora OU abrir dentro do
  -- prazo. O motivo devolvido é o mesmo 'fora_da_janela' de antes — a
  -- Server Action e o espelho em src/lib/janela.ts já o traduzem.
  v_alcance := public.janela_alcance(
    v_cupom.horarios, coalesce(v_cupom.prazo_ativacao_horas, 5));
  if not (v_alcance ->> 'alcancavel')::boolean then
    return jsonb_build_object('ok', false, 'motivo', 'fora_da_janela');
  end if;
  v_teto := (v_alcance ->> 'teto')::timestamptz;   -- null = sem restrição de hora

  -- limite por usuário: validadas + ativas vigentes consomem vaga;
  -- expiradas liberam. Limite NULL = ilimitado (migration 17).
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
  'Fase 9/QA: admite quando o prazo ALCANÇA a janela (não só dentro dela), com expira_em limitado ao fim da janela; registra o clique no servidor.';

-- `create or replace` preserva o ACL; re-emitidos para a migration ser
-- legível sozinha (mesma prática da 17).
revoke execute on function public.ativar_cupom(text) from public, anon;
grant execute on function public.ativar_cupom(text) to authenticated;
