-- ============================================================
-- Promofy — Fase 9/Onda C · Migration 32: exclusão lógica de cupom
--
-- Fecha a porta do DELETE físico e abre a do soft delete. As duas coisas
-- juntas, de propósito: deixar o DELETE aberto enquanto existe um caminho
-- lógico seria manter armado justamente o que esta migration existe para
-- desarmar.
--
-- (1) A POLICY DE DELETE SAI.
--     A migration 3 deu ao lojista `for delete using (owns_estabelecimento)`.
--     Com as FKs em `on delete cascade`, um único
--     `DELETE /rest/v1/cupons?id=eq.<meu-cupom>` pelo PostgREST apagava as
--     ativações, as validações, as notas de NPS e os eventos de métrica do
--     cupom — sem passar por Server Action nenhuma. O relatório pediu
--     preservação de histórico (v2 §4.2); manter esse caminho seria
--     contradizê-lo pela porta dos fundos.
--
--     `revoke delete` acompanha o drop da policy: policy e grant são
--     barreiras independentes, e revogar só uma é meia barreira. Vale a
--     lição da migration 9 — `revoke` por coluna é no-op quando existe
--     grant de tabela, então aqui é `revoke delete on table`.
--
-- (2) A RPC ENTRA.
--     `status` NÃO está no grant de update do lojista (migration 9), então
--     ele não consegue escrever 'excluido' direto — a RPC `security definer`
--     é o único caminho, e é onde a regra mora. O padrão de resposta é o da
--     casa: `{ok:true,...} | {ok:false, motivo:'...'}`.
--
-- O QUE A EXCLUSÃO NÃO FAZ, e é o ponto todo: não toca em
-- `cupons_usuario`, `cupom_eventos`, `pontos_transacoes` nem nas notas de
-- NPS. O cupom sai do catálogo; o que as pessoas fizeram com ele continua
-- inteiro, e as métricas do lojista seguem somando.
-- ============================================================

-- ------------------------------------------------------------
-- (1) o DELETE físico deixa de existir para o lojista
-- ------------------------------------------------------------
drop policy if exists "cupons: lojista apaga os proprios" on public.cupons;

revoke delete on table public.cupons from authenticated, anon;

-- ------------------------------------------------------------
-- (2) EXCLUIR CUPOM — marca 'excluido' e registra a trilha.
--
-- IDEMPOTENTE: excluir de novo devolve ok com `ja_excluido`, em vez de
-- erro. A tela pode ser tocada duas vezes (e o card some no primeiro),
-- e um erro no segundo toque só assustaria quem já conseguiu o que queria.
--
-- NÃO EXCLUI cupom com ativação VIVA. Um código já ativado, dentro do
-- prazo, é uma promessa feita a alguém que está a caminho do balcão —
-- possivelmente já no caixa. Some do catálogo é uma coisa; sumir do
-- consumidor que segurou a vaga é outra. `validar_cupom` continua achando
-- o cupom (ele lê por código, não por status), então quem ativou consegue
-- consumir; o lojista exclui depois que a última ativação expirar ou for
-- validada. O motivo volta como `tem_ativacao_viva` para a tela explicar.
-- ------------------------------------------------------------
create or replace function public.excluir_cupom(p_cupom_id text)
returns jsonb
language plpgsql volatile
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.cupons%rowtype;
  v_vivas int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select * into v_row from public.cupons where id = p_cupom_id;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;

  -- posse: definer ignora RLS, então a checagem tem de ser explícita e vir
  -- antes de qualquer escrita (mesma doutrina da 26/27).
  if not (select private.owns_estabelecimento(v_row.estabelecimento_id)) then
    return jsonb_build_object('ok', false, 'motivo', 'nao_autorizado');
  end if;

  if v_row.status = 'excluido' then
    return jsonb_build_object('ok', true, 'ja_excluido', true);
  end if;

  select count(*) into v_vivas
    from public.cupons_usuario
   where cupom_id = p_cupom_id and status = 'ativo' and expira_em > now();
  if v_vivas > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'tem_ativacao_viva',
      'ativacoes', v_vivas);
  end if;

  update public.cupons
     set status = 'excluido',
         atualizado_em = now(),
         moderacao_historico = coalesce(moderacao_historico, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'em', now(),
                'acao', 'excluido',
                'por', v_uid,
                'motivo', null
              ))
   where id = p_cupom_id
   returning * into v_row;

  return jsonb_build_object('ok', true, 'ja_excluido', false);
end;
$$;

comment on function public.excluir_cupom(text) is
  'Fase 9/C: exclusão LÓGICA — status excluido + trilha em moderacao_historico. Preserva ativações, eventos e notas. Recusa com ativação viva.';

revoke execute on function public.excluir_cupom(text) from public, anon;
grant execute on function public.excluir_cupom(text) to authenticated;
