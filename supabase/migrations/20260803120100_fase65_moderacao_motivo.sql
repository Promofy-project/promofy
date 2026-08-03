-- ============================================================
-- Promofy — Fase 6.5 · Migration 21: rejeição com motivo (C5)
--
-- Ciclo completo: admin rejeita COM MOTIVO → lojista lê → corrige (C2) →
-- reenvia → admin aprova. O motivo anterior fica arquivado em
-- `moderacao_historico` (criado na migration 20).
-- ============================================================

-- ------------------------------------------------------------
-- REJEITAR CUPOM — agora EXIGE motivo.
--
-- POR QUE `DROP` + `CREATE` E NÃO `CREATE OR REPLACE`:
-- acrescentar um parâmetro MUDA a assinatura, e `create or replace` não
-- troca a lista de argumentos — criaria uma SOBRECARGA. Com
-- `rejeitar_cupom(text)` e `rejeitar_cupom(text, text)` coexistindo, uma
-- chamada de 1 argumento ficaria AMBÍGUA ("function name is not unique"),
-- e pior: o caminho antigo continuaria aceitando rejeição SEM motivo,
-- anulando o objetivo da fase.
--
-- ⚠️ `DROP FUNCTION` DESCARTA O ACL JUNTO. Sem o `grant execute` reemitido
-- abaixo, a função nasceria com o default do Postgres — que para funções é
-- EXECUTE para PUBLIC. Ou seja: esquecer o revoke/grant não deixaria a
-- função inacessível, deixaria ela acessível a MAIS gente do que devia
-- (anon inclusive). A checagem de admin lá dentro seguraria o estrago, mas
-- a superfície não pode ficar aberta por descuido.
--
-- NA COREOGRAFIA: entre o `db push` e o deploy do código, o app antigo
-- chama `rejeitar_cupom(p_cupom_id)` — assinatura que deixa de existir.
-- A rejeição no admin fica indisponível nessa janela (ação só-admin, de
-- minutos). Aprovar continua funcionando.
-- ------------------------------------------------------------
drop function if exists public.rejeitar_cupom(text);

create function public.rejeitar_cupom(p_cupom_id text, p_motivo text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_row public.cupons%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not (select private.is_admin()) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  -- O motivo é o produto desta fase: sem ele o lojista não sabe o que
  -- corrigir, e o "editar e reenviar" não fecha o ciclo.
  if v_motivo = '' then
    return jsonb_build_object('ok', false, 'motivo', 'motivo_obrigatorio');
  end if;

  update public.cupons
     set status = 'rejeitado',
         atualizado_em = now(),
         moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'em', now(),
                'acao', 'rejeitado',
                'por', (select auth.uid()),
                'motivo', v_motivo
              ))
   where id = p_cupom_id and status = 'pendente'
   returning * into v_row;

  if not found then
    -- inexistente OU não estava pendente (já moderado)
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

comment on function public.rejeitar_cupom(text, text) is
  'Fase 6.5: rejeição EXIGE motivo não-vazio e arquiva a entrada em moderacao_historico.';

-- ------------------------------------------------------------
-- APROVAR CUPOM — idêntica à Fase 4, mais o registro no histórico.
-- `publicado_em` continua com `coalesce` (só a 1ª publicação conta, para
-- as novidades da Fase 4 não re-notificarem a cada reaprovação).
-- ------------------------------------------------------------
create or replace function public.aprovar_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_row public.cupons%rowtype;
begin
  if not (select private.is_admin()) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  update public.cupons
     set status = 'ativo',
         publicado_em = coalesce(publicado_em, now()),
         atualizado_em = now(),
         moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'em', now(),
                'acao', 'aprovado',
                'por', (select auth.uid())
              ))
   where id = p_cupom_id and status = 'pendente'
   returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

-- ------------------------------------------------------------
-- REENVIAR PARA MODERAÇÃO — o lojista devolve um cupom rejeitado à fila.
--
-- Precisa ser RPC `security definer` porque `status` NÃO está no grant por
-- coluna da Fase 3: o lojista não consegue (e não deve conseguir) escrever
-- status direto. Aqui ele só pode fazer a transição rejeitado → pendente,
-- e só no próprio cupom.
--
-- NOTA sobre o trigger da migration 20: dentro desta função o `auth.uid()`
-- continua sendo o do LOJISTA (security definer não zera o uid), então o
-- `checar_edicao_cupom` É avaliado neste UPDATE — e deve ser. Como aqui só
-- mudam `status` e `moderacao_historico`, nenhum campo material muda e o
-- trigger passa reto (o `v_mudou_algo` dele nem considera `status`).
-- ------------------------------------------------------------
create or replace function public.reenviar_cupom_moderacao(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_row public.cupons%rowtype;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v_row from public.cupons where id = p_cupom_id;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if not (select private.owns_estabelecimento(v_row.estabelecimento_id)) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  if v_row.status <> 'rejeitado' then
    return jsonb_build_object('ok', false, 'motivo', 'nao_rejeitado');
  end if;

  update public.cupons
     set status = 'pendente',
         atualizado_em = now(),
         moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'em', now(),
                'acao', 'reenviado',
                'por', v_uid
              ))
   where id = p_cupom_id and status = 'rejeitado'
   returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_rejeitado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

comment on function public.reenviar_cupom_moderacao(text) is
  'Fase 6.5: lojista devolve o PRÓPRIO cupom rejeitado para a fila de moderação. Único caminho — status não está no grant por coluna.';

-- ------------------------------------------------------------
-- GRANTS — obrigatórios para `rejeitar_cupom`, que foi DROPADA (perdeu o
-- ACL). As outras duas usaram `create or replace` e preservaram o seu, mas
-- reemitir custa nada e deixa a migration legível sozinha.
-- ------------------------------------------------------------
revoke execute on function
  public.rejeitar_cupom(text, text),
  public.aprovar_cupom(text),
  public.reenviar_cupom_moderacao(text)
from public, anon;

grant execute on function
  public.rejeitar_cupom(text, text),
  public.aprovar_cupom(text),
  public.reenviar_cupom_moderacao(text)
to authenticated;
