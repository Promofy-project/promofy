-- ============================================================
-- Promofy — Fase 3 · Migration 10: RPCs de moderação (admin)
--
-- Padrão da Fase 2: SECURITY DEFINER, checagem de papel EXPLÍCITA
-- (private.is_admin), search_path travado, revoke de public/anon +
-- grant a authenticated. Retorno {ok:true,...} | {ok:false, motivo}.
--
-- cupons/estabelecimentos NÃO têm policy de UPDATE para admin (nem grant
-- de coluna de `status` — ver migrations 3 e 9). Estas RPCs são o ÚNICO
-- caminho de mudança de status por um admin. Testes negativos provam que
-- lojista/consumidor recebem 'sem_permissao' (e que o UPDATE direto de
-- status dá 42501 — ver test-fase3).
-- ============================================================

-- APROVAR CUPOM: pendente -> ativo
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
     set status = 'ativo', atualizado_em = now()
   where id = p_cupom_id and status = 'pendente'
   returning * into v_row;

  if not found then
    -- inexistente OU não estava pendente (já moderado)
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

-- REJEITAR CUPOM: pendente -> rejeitado (fica invisível ao público)
create or replace function public.rejeitar_cupom(p_cupom_id text)
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
     set status = 'rejeitado', atualizado_em = now()
   where id = p_cupom_id and status = 'pendente'
   returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

-- APROVAR/SUSPENDER ESTABELECIMENTO: status ativo|suspenso.
-- Suspender remove os cupons do catálogo público NA HORA (a policy
-- pública de cupons exige estabelecimento.status='ativo' — provado em teste).
create or replace function public.definir_status_estabelecimento(p_est_id text, p_status text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_row public.estabelecimentos%rowtype;
begin
  if not (select private.is_admin()) then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  if p_status not in ('ativo', 'suspenso') then
    return jsonb_build_object('ok', false, 'motivo', 'status_invalido');
  end if;

  update public.estabelecimentos
     set status = p_status::public.status_estabelecimento, atualizado_em = now()
   where id = p_est_id
   returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

-- GRANTS: RPC é o único caminho de moderação a partir daqui
revoke execute on function
  public.aprovar_cupom(text),
  public.rejeitar_cupom(text),
  public.definir_status_estabelecimento(text, text)
from public, anon;

grant execute on function
  public.aprovar_cupom(text),
  public.rejeitar_cupom(text),
  public.definir_status_estabelecimento(text, text)
to authenticated;
