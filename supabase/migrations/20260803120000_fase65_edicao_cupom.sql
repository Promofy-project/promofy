-- ============================================================
-- Promofy — Fase 6.5 · Migration 20: edição de cupom (C2)
--
-- POR QUE A REGRA É UM TRIGGER, E NÃO SÓ A SERVER ACTION
--
-- O lojista JÁ consegue editar o próprio cupom hoje, direto no PostgREST:
-- a policy "cupons: lojista atualiza os proprios" (Fase 1) checa só posse,
-- e o `grant update` por coluna soma 24 colunas depois da Fase 6 (as 21 da
-- Fase 3 + taxas, formas_consumo, economia_variavel). Fora do grant só
-- ficaram status, estabelecimento_id, id, criado_em e publicado_em.
--
-- Logo, uma matriz de imutabilidade escrita apenas na Action seria
-- DECORATIVA: bastaria um `PATCH /rest/v1/cupons?id=eq.<meu-cupom>` para
-- contorná-la. A barreira tem de ser o banco — exatamente o raciocínio da
-- migration 19, que fechou o auto-publish no INSERT depois de a Fase 3 ter
-- fechado só o UPDATE de `status`.
-- ============================================================

-- ------------------------------------------------------------
-- HISTÓRICO DE MODERAÇÃO — jsonb, e FORA do grant de update.
--
-- Entradas append-only {em, acao, por, motivo}. Fica em `cupons` (e não
-- numa tabela) porque é uma lista curta, sempre lida JUNTO com o cupom;
-- uma tabela exigiria RLS própria, grants próprios e um join em
-- buscarCuponsPortal para um dado que nunca é consultado sozinho. O repo
-- já usa jsonb assim em regras/horarios/taxas/formas_consumo.
--
-- NÃO entra no `grant update`: coluna criada depois NÃO herda a lista da
-- Fase 3, e é isso que impede o lojista de reescrever o próprio histórico
-- de moderação via PostgREST. Só as RPCs `security definer` escrevem aqui.
-- ------------------------------------------------------------
alter table public.cupons
  add column if not exists moderacao_historico jsonb not null default '[]'::jsonb;

comment on column public.cupons.moderacao_historico is
  'Fase 6.5: histórico append-only de moderação [{em,acao,por,motivo}]. FORA do grant de update — só RPCs security definer e o trigger de edição escrevem.';

-- ------------------------------------------------------------
-- CHECAR EDIÇÃO — matriz de imutabilidade + materialidade.
--
-- Dois estados do cupom decidem tudo:
--   V = existe QUALQUER validação      (cupons_usuario.status = 'validado')
--   A = existe ativação VIVA           (status = 'ativo' and expira_em > now())
--
-- Só é calculado o que a linha em edição realmente precisa: quem muda
-- apenas o título não paga duas contagens.
-- ------------------------------------------------------------
create or replace function public.checar_edicao_cupom()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_validacoes int;
  v_ativas int;
  v_max_por_usuario int;
  v_ultima_expira timestamptz;
  v_material boolean := false;
  v_mudou_algo boolean := false;
  v_dias_velho jsonb;
  v_dias_novo jsonb;
  v_ini_velho time;
  v_fim_velho time;
  v_ini_novo time;
  v_fim_novo time;
begin
  -- Caminhos que passam intactos, pelo mesmo critério da migration 19:
  --   * auth.uid() null  -> seed.sql (psql), service_role das suítes e do
  --     seed-users, manutenção via SQL;
  --   * admin            -> moderação e correção operacional.
  -- Atenção: dentro de uma RPC `security definer` chamada pelo LOJISTA o
  -- auth.uid() continua sendo o do lojista (não vira null), então
  -- reenviar_cupom_moderacao (migration 21) É avaliado aqui — e deve ser,
  -- porque ele só mexe em `status`, que não é material.
  if v_uid is null or (select private.is_admin()) then
    return new;
  end if;

  -- ---------- helpers de "mudou?" ----------
  -- `is distinct from` cobre NULL dos dois lados (limite ilimitado).
  v_mudou_algo :=
        new.titulo              is distinct from old.titulo
     or new.beneficio           is distinct from old.beneficio
     or new.categoria_id        is distinct from old.categoria_id
     or new.economia            is distinct from old.economia
     or new.economia_variavel   is distinct from old.economia_variavel
     or new.taxas               is distinct from old.taxas
     or new.formas_consumo      is distinct from old.formas_consumo
     or new.horarios            is distinct from old.horarios
     or new.regras              is distinct from old.regras
     or new.imagem              is distinct from old.imagem
     or new.validade_inicio     is distinct from old.validade_inicio
     or new.validade_fim        is distinct from old.validade_fim
     or new.ocultar_ate_inicio  is distinct from old.ocultar_ate_inicio
     or new.prazo_ativacao_horas is distinct from old.prazo_ativacao_horas
     or new.limite_por_usuario  is distinct from old.limite_por_usuario
     or new.limite_total        is distinct from old.limite_total;

  if not v_mudou_algo then
    return new; -- update no-op (ex.: só `atualizado_em`) não paga nada
  end if;

  -- ---------- estado do consumo ----------
  select count(*) filter (where status = 'validado'),
         count(*) filter (where status = 'ativo' and expira_em > now()),
         max(expira_em) filter (where status = 'ativo' and expira_em > now())
    into v_validacoes, v_ativas, v_ultima_expira
    from public.cupons_usuario
   where cupom_id = old.id;

  -- ---------- ECONOMIA: imutável com QUALQUER validação ----------
  -- `economia_consumidor()` soma cupons.economia em tempo de LEITURA
  -- (migration 18). Alterar aqui reescreveria retroativamente o total já
  -- exibido a todo consumidor que validou este cupom.
  if v_validacoes > 0
     and (new.economia is distinct from old.economia
          or new.economia_variavel is distinct from old.economia_variavel) then
    raise exception
      'A economia não pode mudar: % cliente(s) já validaram este cupom e o valor entra no total economizado deles.',
      v_validacoes
      using errcode = 'P0601';
  end if;

  -- ---------- PROMESSA AO CONSUMIDOR: imutável com ativação viva ----------
  -- É o que está escrito na folha que o cliente vai apresentar no balcão.
  if v_ativas > 0
     and (new.beneficio is distinct from old.beneficio
          or new.taxas is distinct from old.taxas
          or new.formas_consumo is distinct from old.formas_consumo) then
    raise exception
      'Benefício, taxas e formas de consumo não podem mudar agora: % cliente(s) têm este cupom ativo. A última ativação vence em %.',
      v_ativas, to_char(v_ultima_expira at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
      using errcode = 'P0602';
  end if;

  -- ---------- LIMITE POR USUÁRIO: nunca abaixo do já consumido ----------
  -- NULL (ilimitado) é sempre permitido — é o teto máximo.
  if new.limite_por_usuario is not null
     and new.limite_por_usuario is distinct from old.limite_por_usuario then
    select coalesce(max(qtd), 0) into v_max_por_usuario
      from (
        select count(*) as qtd
          from public.cupons_usuario
         where cupom_id = old.id
           and (status = 'validado' or (status = 'ativo' and expira_em > now()))
         group by usuario_id
      ) t;
    if new.limite_por_usuario < v_max_por_usuario then
      raise exception
        'O limite por cliente não pode ficar abaixo de %: já há cliente que usou esse tanto.',
        v_max_por_usuario
        using errcode = 'P0603';
    end if;
  end if;

  -- ---------- LIMITE TOTAL: nunca abaixo das validações ----------
  if new.limite_total is not null
     and new.limite_total is distinct from old.limite_total
     and new.limite_total < v_validacoes then
    raise exception
      'O limite total não pode ficar abaixo de %: é quanto já foi resgatado.',
      v_validacoes
      using errcode = 'P0604';
  end if;

  -- ---------- VALIDADE: com ativação viva, só estende ----------
  if v_ativas > 0 and new.validade_fim < old.validade_fim then
    raise exception
      'A validade não pode ser encurtada agora: % cliente(s) têm este cupom ativo.',
      v_ativas
      using errcode = 'P0605';
  end if;

  -- ---------- JANELA: com ativação viva, só amplia ----------
  -- Compara com a MESMA tolerância de `dentro_da_janela` (Fase 5): dado
  -- malformado é "sem restrição". Ampliar = passar a valer em mais
  -- instantes; qualquer coisa que reduza é bloqueada.
  if v_ativas > 0 and new.horarios is distinct from old.horarios then
    v_dias_velho := case when jsonb_typeof(old.horarios -> 'dias') = 'array'
                         then old.horarios -> 'dias' else '[]'::jsonb end;
    v_dias_novo  := case when jsonb_typeof(new.horarios -> 'dias') = 'array'
                         then new.horarios -> 'dias' else '[]'::jsonb end;

    -- dias: o novo tem de ser "sem restrição" ([]) ou conter todos os antigos
    if jsonb_array_length(v_dias_novo) > 0
       and not (v_dias_novo @> v_dias_velho) then
      raise exception
        'Os dias de consumo não podem ser reduzidos agora: % cliente(s) têm este cupom ativo.',
        v_ativas
        using errcode = 'P0606';
    end if;

    -- horário: só valida quando AMBOS os lados têm faixa legível; faixa
    -- nova ausente/inválida = sem restrição = ampliação (permitida).
    v_ini_velho := public.hora_ou_null(old.horarios ->> 'inicio');
    v_fim_velho := public.hora_ou_null(old.horarios ->> 'fim');
    v_ini_novo  := public.hora_ou_null(new.horarios ->> 'inicio');
    v_fim_novo  := public.hora_ou_null(new.horarios ->> 'fim');

    if v_ini_velho is not null and v_fim_velho is not null
       and v_ini_novo is not null and v_fim_novo is not null then
      -- Faixa que cruza a meia-noite é conservadoramente tratada como
      -- estreitamento quando muda: comparar contenção em janela circular
      -- daria margem a erro sutil, e o lojista espera no máximo o prazo de
      -- ativação (mínimo de 5h) para editar.
      if v_ini_velho > v_fim_velho or v_ini_novo > v_fim_novo then
        raise exception
          'O horário não pode mudar agora: % cliente(s) têm este cupom ativo.',
          v_ativas
          using errcode = 'P0606';
      end if;
      if v_ini_novo > v_ini_velho or v_fim_novo < v_fim_velho then
        raise exception
          'O horário só pode ser ampliado agora: % cliente(s) têm este cupom ativo.',
          v_ativas
          using errcode = 'P0606';
      end if;
    end if;
  end if;

  -- ---------- MATERIALIDADE: volta para moderação ----------
  -- Material = o que o consumidor lê ou o que muda onde o cupom aparece.
  -- `titulo` fica de fora por decisão de produto (typo não deve rebaixar);
  -- em compensação, TODA edição de cupom ativo é registrada abaixo.
  v_material :=
        new.beneficio         is distinct from old.beneficio
     or new.economia          is distinct from old.economia
     or new.economia_variavel is distinct from old.economia_variavel
     or new.categoria_id      is distinct from old.categoria_id
     or new.taxas             is distinct from old.taxas
     or new.formas_consumo    is distinct from old.formas_consumo
     or new.horarios          is distinct from old.horarios
     or new.regras            is distinct from old.regras
     or new.imagem            is distinct from old.imagem;

  -- O REGISTRO vale para QUALQUER status. É o que fecha o ciclo do C5: um
  -- cupom rejeitado que volta para a fila precisa mostrar ao admin SE o
  -- lojista corrigiu alguma coisa antes de reenviar — sem isso o histórico
  -- fica "rejeitado → reenviado" e o moderador reabre no escuro.
  new.moderacao_historico := coalesce(old.moderacao_historico, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
         'em', now(),
         'acao', case when v_material then 'editado_material' else 'editado' end,
         'por', v_uid
       ));

  -- O REBAIXAMENTO, não: só cupom ATIVO volta para moderação. Um cupom
  -- 'rejeitado' editado NÃO vira 'pendente' sozinho — quem decide quando
  -- reenviar é o lojista, pelo botão explícito (reenviar_cupom_moderacao).
  -- Rebaixar aqui roubaria dele a chance de fazer vários ajustes antes de
  -- submeter de novo.
  if old.status = 'ativo' and v_material then
    new.status := 'pendente';
  end if;

  return new;
end;
$$;

revoke execute on function public.checar_edicao_cupom() from public, anon, authenticated;

comment on function public.checar_edicao_cupom() is
  'Fase 6.5: matriz de imutabilidade + materialidade na edição de cupom. Barreira real (cobre o PostgREST direto, não só a Server Action).';

-- ------------------------------------------------------------
-- `hora_ou_null` — "HH:MM" → time, ou NULL se não for hora.
--
-- Existe para o trigger acima NUNCA castar direto: um ''::time dentro de
-- uma `security definer` sem bloco `exception` aborta a transação e vira
-- 500 — a mesma armadilha que a Fase 5 documentou em `dentro_da_janela`.
-- O form do portal já gravou {"inicio":"","fim":""} no passado.
-- ------------------------------------------------------------
create or replace function public.hora_ou_null(p_hora text)
returns time
language sql immutable set search_path = ''
as $$
  select case
    when p_hora is null then null
    when btrim(p_hora) !~ '^[0-9]{1,2}:[0-9]{2}$' then null
    when split_part(btrim(p_hora), ':', 1)::int > 23 then null
    when split_part(btrim(p_hora), ':', 2)::int > 59 then null
    else btrim(p_hora)::time
  end;
$$;

revoke execute on function public.hora_ou_null(text) from public, anon;
grant execute on function public.hora_ou_null(text) to authenticated;

-- O trigger é criado DEPOIS de `hora_ou_null` existir (o corpo plpgsql só
-- resolve nomes em tempo de execução, mas manter a ordem legível ajuda).
drop trigger if exists trg_cupons_checar_edicao on public.cupons;
create trigger trg_cupons_checar_edicao
  before update on public.cupons
  for each row execute function public.checar_edicao_cupom();
