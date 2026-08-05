-- ============================================================
-- Promofy — Fase 8 · Migration 27: endurecimento da validação por CPF
--
-- Sete achados da revisão de segurança dedicada, sobre a migration 26. O
-- primeiro é um defeito que EU introduzi ao corrigir outro, e é o mais grave
-- desta fase.
--
-- (1) ALTO — CONFIRMAR SÓ COM O row_id ERA UM DOWNGRADE DE CREDENCIAL.
--     A migration 26 deixou de devolver o código da ativação (credencial ao
--     portador de 2^40) e passou a devolver `cupons_usuario.id` — um bigserial
--     pequeno e denso. Só que `validar_cupom_por_ativacao` aceitava apenas
--     esse id: sem CPF, sem rate limit, sem auditoria. Um lojista percorrendo
--     ids de 1 a N queima os cupons dos PRÓPRIOS clientes, de forma
--     PERMANENTE (a unique `(usuario_id, cupom_id)` impede reativar), com
--     pontos creditados por visitas que nunca houve — e sem deixar rastro.
--     Correção: confirmar passa a exigir o CPF, exatamente como a busca. A
--     posse do documento volta a ser a credencial.
--
-- (2) MÉDIO — RATE LIMIT COM TOCTOU. `count` e `insert` separados pela
--     consulta inteira, em READ COMMITTED: chamadas paralelas veem todas a
--     mesma contagem sub-limite e passam juntas. O teto de 20 virava
--     "20 vezes a concorrência". Correção: `pg_advisory_xact_lock` por
--     estabelecimento antes da contagem. Importa mais do que a severidade
--     sugere: o argumento de que o canal de tempo é inexplorável depende
--     justamente do teto valer.
--
-- (3) MÉDIO — PEPPER SAÍA NO pg_dump. `private.segredos` é tabela comum;
--     `supabase db dump --data-only -f supabase/seed.sql` é caminho
--     documentado e `seed.sql` é versionado. O pepper de produção iria para o
--     git junto com a tabela que ele protege — e aí os CPFs auditados voltam.
--     Correção: Vault (`vault.create_secret`), cuja chave vive FORA do banco.
--
-- (4) BAIXO — AUDITORIA EM `public` é alcançável por `service_role`. Vai para
--     `private`, fora da API do PostgREST com qualquer chave.
--
-- (5) BAIXO — O CONFIRM ECOAVA O CÓDIGO, desfazendo no fim a recusa
--     deliberada da busca. `validar_cupom` devolve `dados.codigo` e a tela
--     imprime. Removido do retorno deste caminho.
--
-- (6) BAIXO — BLOQUEADO E DV-INVÁLIDO NÃO ERAM AUDITADOS, então a tabela era
--     incapaz de mostrar a MAGNITUDE de um ataque: quem faz 500 req/s e quem
--     faz consultas honestas deixavam o mesmo rastro máximo. Passam a ser
--     registrados — sem contar na janela, para não permitir auto-DoS.
--
-- (7) BAIXO — `profiles.cpf` sem índice: cada busca varria a tabela. Índice
--     de expressão, que também encolhe a diferença de tempo entre "CPF existe
--     na plataforma" e "não existe".
--
-- (8) BAIXO — `limit 1` sem `order by` escolhia um estabelecimento arbitrário
--     para dono de mais de um. Passa a considerar TODOS.
-- ============================================================

-- ------------------------------------------------------------
-- (3) PEPPER PARA O VAULT
-- ------------------------------------------------------------
create extension if not exists supabase_vault with schema vault cascade;

do $$
declare
  v_atual text;
begin
  -- Migra o pepper existente em vez de gerar outro: trocá-lo invalidaria a
  -- correlação de toda a auditoria já registrada.
  select valor into v_atual from private.segredos where chave = 'cpf_pepper';

  if not exists (select 1 from vault.secrets where name = 'cpf_pepper') then
    perform vault.create_secret(
      coalesce(v_atual, encode(extensions.gen_random_bytes(32), 'hex')),
      'cpf_pepper',
      'Fase 8/V2 — pepper do HMAC de CPF na auditoria de validacao.'
    );
  end if;
end
$$;

-- A tabela some: era exatamente ela que o dump carregava.
drop table if exists private.segredos;

create or replace function private.hmac_cpf(p_cpf text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pepper text;
begin
  select decrypted_secret into v_pepper
    from vault.decrypted_secrets where name = 'cpf_pepper';
  -- Falha FECHADA: sem pepper devolve marcador, nunca um hash reversível e
  -- nunca o CPF.
  if v_pepper is null then return 'sem-pepper'; end if;
  return encode(
    extensions.hmac(regexp_replace(p_cpf, '\D', '', 'g'), v_pepper, 'sha256'),
    'hex'
  );
end;
$$;

revoke execute on function private.hmac_cpf(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- (4) AUDITORIA SAI DE `public`
-- ------------------------------------------------------------
alter table public.validacao_tentativas set schema private;
revoke all on private.validacao_tentativas from anon, authenticated;

comment on table private.validacao_tentativas is
  'Fase 8/V2: auditoria e janela de rate limit da busca por CPF. Guarda HMAC, NUNCA o CPF. Em `private`: fora da API do PostgREST com QUALQUER chave, inclusive service_role.';

-- ------------------------------------------------------------
-- (7) ÍNDICE DE EXPRESSÃO NO CPF
-- ------------------------------------------------------------
create index if not exists profiles_cpf_digitos_idx
  on public.profiles ((regexp_replace(coalesce(cpf, ''), '\D', '', 'g')));

-- ------------------------------------------------------------
-- Helper comum: estabelecimentos do chamador (8) + janela/auditoria (2)(6)
-- ------------------------------------------------------------
create or replace function private.estabs_do_dono()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(e.id order by e.id), '{}')
    from public.estabelecimentos e
   where e.owner_id = (select auth.uid());
$$;

revoke execute on function private.estabs_do_dono() from public, anon, authenticated;

-- ------------------------------------------------------------
-- V1a — BUSCAR (recriada com (2)(6)(7)(8))
-- ------------------------------------------------------------
create or replace function public.buscar_ativacoes_por_cpf(p_cpf text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estabs text[];
  v_chave  text;
  v_dig    text;
  v_hmac   text;
  v_n      int;
  v_itens  jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  v_estabs := private.estabs_do_dono();
  if array_length(v_estabs, 1) is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  -- (8) A janela é do DONO, não de um estabelecimento arbitrário: com
  -- `limit 1` sem `order by`, dono de dois teria contador instável.
  v_chave := v_uid::text;

  v_dig := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_hmac := private.hmac_cpf(v_dig);

  if not public.cpf_dv_valido(v_dig) then
    -- (6) Registrado para a auditoria mostrar magnitude, mas NÃO conta na
    -- janela — senão o abusador se auto-bloquearia de graça, e a tabela viraria
    -- ruído em vez de sinal.
    insert into private.validacao_tentativas
      (estabelecimento_id, por_usuario, cpf_hmac, resultado)
    values (v_estabs[1], v_uid, v_hmac, 'cpf_invalido');
    return jsonb_build_object('ok', false, 'motivo', 'cpf_invalido');
  end if;

  -- (2) Serializa apenas chamadas do MESMO dono. Sem isto, `count` e `insert`
  -- ficam separados pela consulta inteira em READ COMMITTED, e um disparo
  -- paralelo passa tantas vezes quanto a concorrência permitir.
  perform pg_advisory_xact_lock(hashtext('valida_cpf:' || v_chave));

  select count(*) into v_n
    from private.validacao_tentativas t
   where t.por_usuario = v_uid
     and t.resultado in ('encontrado', 'sem_ativacao')
     and t.criado_em > now() - interval '2 minutes';

  if v_n >= 20 then   -- 20 por 2 min = 10/min sustentado
    insert into private.validacao_tentativas
      (estabelecimento_id, por_usuario, cpf_hmac, resultado)
    values (v_estabs[1], v_uid, v_hmac, 'bloqueado');
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  select coalesce(jsonb_agg(x order by x->>'ativado_em' desc), '[]'::jsonb)
    into v_itens
    from (
      select jsonb_build_object(
               'row_id', cu.id,
               'cupom', c.titulo,
               'nome', coalesce(nullif(split_part(p.nome, ' ', 1), ''), 'Cliente'),
               'cpf_mascarado', public.mascarar_cpf(p.cpf),
               'ativado_em', cu.ativado_em
             ) as x
        from public.cupons_usuario cu
        join public.cupons c   on c.id = cu.cupom_id
        join public.profiles p on p.id = cu.usuario_id
       where c.estabelecimento_id = any(v_estabs)          -- (8)
         and regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = v_dig  -- (7) usa o índice
         and cu.status = 'ativo'
         and (cu.expira_em is null or cu.expira_em > now())
    ) t;

  insert into private.validacao_tentativas
    (estabelecimento_id, por_usuario, cpf_hmac, resultado)
  values (v_estabs[1], v_uid, v_hmac,
          case when jsonb_array_length(v_itens) > 0 then 'encontrado' else 'sem_ativacao' end);

  -- Resposta ÚNICA: inexistente, de outro estabelecimento e sem ativação
  -- caem todos aqui, com o mesmo objeto.
  if jsonb_array_length(v_itens) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'sem_ativacao_aqui');
  end if;
  return jsonb_build_object('ok', true, 'itens', v_itens);
end;
$$;

revoke execute on function public.buscar_ativacoes_por_cpf(text) from public, anon;
grant  execute on function public.buscar_ativacoes_por_cpf(text) to authenticated;

-- ------------------------------------------------------------
-- V1b — CONFIRMAR: agora EXIGE O CPF (1), com janela (2) e sem código (5)
--
-- Assinatura muda → `drop` + `create`, nunca `create or replace`, que criaria
-- sobrecarga ambígua (lição da migration 21).
-- ------------------------------------------------------------
drop function if exists public.validar_cupom_por_ativacao(bigint);

create function public.validar_cupom_por_ativacao(p_row_id bigint, p_cpf text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estabs text[];
  v_dig    text;
  v_codigo text;
  v_n      int;
  v_res    jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  v_estabs := private.estabs_do_dono();
  if array_length(v_estabs, 1) is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  v_dig := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if not public.cpf_dv_valido(v_dig) then
    return jsonb_build_object('ok', false, 'motivo', 'cpf_invalido');
  end if;

  perform pg_advisory_xact_lock(hashtext('valida_cpf:' || v_uid::text));

  select count(*) into v_n
    from private.validacao_tentativas t
   where t.por_usuario = v_uid
     and t.resultado in ('encontrado', 'sem_ativacao', 'confirmacao')
     and t.criado_em > now() - interval '2 minutes';
  if v_n >= 20 then
    insert into private.validacao_tentativas
      (estabelecimento_id, por_usuario, cpf_hmac, resultado)
    values (v_estabs[1], v_uid, private.hmac_cpf(v_dig), 'bloqueado');
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  -- (1) O CPF é a credencial deste caminho. Sem ele, o row_id sequencial
  -- bastaria para queimar cupom alheio dentro do próprio estabelecimento.
  select cu.codigo into v_codigo
    from public.cupons_usuario cu
    join public.cupons c   on c.id = cu.cupom_id
    join public.profiles p on p.id = cu.usuario_id
   where cu.id = p_row_id
     and c.estabelecimento_id = any(v_estabs)
     and regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = v_dig
     and cu.status = 'ativo'
     and (cu.expira_em is null or cu.expira_em > now());

  insert into private.validacao_tentativas
    (estabelecimento_id, por_usuario, cpf_hmac, resultado)
  values (v_estabs[1], v_uid, private.hmac_cpf(v_dig), 'confirmacao');

  if v_codigo is null then
    -- Mesma resposta única de sempre.
    return jsonb_build_object('ok', false, 'motivo', 'sem_ativacao_aqui');
  end if;

  v_res := public.validar_cupom(v_codigo);
  -- (5) A busca recusa devolver o código; o confirm não pode desfazer isso no
  -- fim. `validar_cupom` inclui `dados.codigo` — sai daqui.
  return v_res #- '{dados,codigo}';
end;
$$;

comment on function public.validar_cupom_por_ativacao(bigint, text) is
  'Fase 8/V1: confirma pela ativacao EXIGINDO o CPF (o row_id e sequencial e nao serve de credencial). Re-checa posse, status e expiracao; conta na janela; remove o codigo do retorno.';

revoke execute on function public.validar_cupom_por_ativacao(bigint, text) from public, anon;
grant  execute on function public.validar_cupom_por_ativacao(bigint, text) to authenticated;
