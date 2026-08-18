-- ============================================================
-- Fase 9 / Z1 — NPS PÓS-BALCÃO
--
-- O PROBLEMA (achado no smoke da Fase 8). A pesquisa de NPS só dispara quando
-- o app do consumidor observa o flip `ativo → validado` AO VIVO: o provider
-- compara o status anterior em memória com o que o poll devolve. Isso funciona
-- quando o cliente está com o celular aberto na folha do cupom enquanto o
-- lojista valida.
--
-- Só que a validação por CPF (Fase 8/V3) existe EXATAMENTE para quando o
-- celular não está presente. Nesse caminho o flip nunca é observado, a
-- pesquisa nunca aparece, e `cupons_usuario.nps` fica NULL para sempre — os
-- indicadores da Fase 8 sub-contam justo o fluxo novo.
--
-- POR QUE UMA CHAVE NOVA, E NÃO DERIVAR DE `estados`. A RPC já devolve as
-- ativações validadas com `nps` null dentro de `estados`. Mas o cliente
-- COLAPSA `estados` para uma linha por cupom, preferindo a `ativo` — então uma
-- validada-sem-nota é descartada quando existe uma ativa do mesmo cupom. E
-- `responder_nps` precisa do `row_id`, que o mapa colapsado perde. Chave
-- própria resolve os dois e não mexe em nada que já funciona.
--
-- ADITIVA: `estados`, `usos`, `saldo`, `config` e `usuario` saem idênticos. O
-- código antigo que não conhece `nps_pendentes` simplesmente a ignora — é a
-- janela banco-antes-código de sempre.
-- ============================================================

-- ------------------------------------------------------------
-- Índice parcial: a lista de pendentes é uma consulta por usuário ordenada
-- por validado_em. O predicado parcial mantém o índice pequeno — só as linhas
-- que ainda devem uma nota entram nele, e elas somem do índice assim que a
-- nota chega.
-- ------------------------------------------------------------
create index if not exists cupons_usuario_nps_pendente_idx
  on public.cupons_usuario (usuario_id, validado_em desc)
  where status = 'validado' and nps is null;

-- ------------------------------------------------------------
-- meu_estado_consumidor() + nps_pendentes
--
-- `security invoker` de propósito, como na Fase 6: a RLS de cupons_usuario já
-- filtra por dono, e o `auth.uid()` explícito é cinto e suspensório. Não há
-- razão para definer aqui — seria superfície a mais.
--
-- O `titulo` vem junto porque a oferta precisa dizer de QUAL cupom se trata, e
-- sem ele o cliente teria de casar `cupom_id` contra um catálogo que pode não
-- estar carregado (o cupom pode nem aparecer mais na home).
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
    -- NOVO (Fase 9): o que o balcão validou e ainda não foi avaliado.
    -- Mais recente primeiro — o cliente oferece uma por vez, e a mais fresca
    -- é a que ele lembra.
    'nps_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'row_id', cu.id,
               'cupom_id', cu.cupom_id,
               'titulo', c.titulo,
               'validado_em', cu.validado_em
             ) order by cu.validado_em desc nulls last)
        from public.cupons_usuario cu
        join public.cupons c on c.id = cu.cupom_id
       where cu.usuario_id = (select auth.uid())
         and cu.status = 'validado'
         and cu.nps is null
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
  'Fase 9: ganha nps_pendentes[] — validadas sem nota, mais recente primeiro. Fecha o buraco em que a validação por CPF (celular ausente) nunca gerava pesquisa.';

-- `create or replace` preserva o ACL; re-emitido para a migration ser legível
-- sozinha, no padrão da 6.
revoke execute on function public.meu_estado_consumidor() from public, anon;
grant  execute on function public.meu_estado_consumidor() to authenticated;
