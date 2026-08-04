-- ============================================================
-- Promofy — Fase 8 · Migration 26: validação por identidade (V1 + V2)
--
-- O consumidor chega no balcão sem bateria e sem o código. O lojista valida
-- pelo CPF. É o único caminho do produto em que alguém digita o identificador
-- de OUTRA pessoa — e por isso é o que mais precisa de barreira.
--
-- AS QUATRO BARREIRAS, NA ORDEM EM QUE AGEM
--
--   1. DÍGITO VERIFICADOR, antes de tocar dado. ~99% das sequências de 11
--      dígitos morrem aqui sem consulta nenhuma.
--   2. RATE LIMIT por lojista: 10 por minuto, bloqueio de 2 minutos. Contado
--      NO BANCO — serverless não tem memória compartilhada, então contador em
--      processo seria contador por instância, isto é, nenhum.
--   3. RESPOSTA ÚNICA. Não existe "CPF não encontrado". CPF inexistente, CPF
--      de outro estabelecimento e CPF sem ativação devolvem exatamente o mesmo
--      objeto. Sem isso a RPC vira um oráculo: com ela, qualquer um descobre
--      se um CPF existe na base — e, pior, se aquela pessoa é cliente daquele
--      estabelecimento.
--   4. POSSE, sempre: só ativações de cupons DO ESTABELECIMENTO do chamador.
--
-- O QUE A AUDITORIA GUARDA, E POR QUE NÃO É HASH SIMPLES
--
-- Guardar `sha256(cpf)` NÃO é anonimizar: existem ~10^9 CPFs válidos, e uma
-- tabela arco-íris de todos eles cabe num notebook. Quem obtivesse a tabela de
-- auditoria recuperaria cada CPF consultado. Usa-se HMAC com um PEPPER que
-- vive em `private.segredos` — revogado de todos os papéis e lido apenas de
-- dentro de função `security definer`. Sem o pepper, reverter deixa de ser
-- viável; com ele, a correlação que o rate limit e a investigação precisam
-- continua funcionando.
--
-- O CPF EM CLARO NÃO É GRAVADO EM LUGAR NENHUM: nem em coluna, nem em
-- mensagem de erro, nem em `raise`. Só o HMAC.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- PEPPER
--
-- Tabela própria em `private` (schema fora da API do PostgREST). Uma linha.
-- Gerado aqui, na aplicação da migration, e nunca versionado — o valor não
-- existe em nenhum arquivo do repositório.
-- ------------------------------------------------------------
create table if not exists private.segredos (
  chave text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);

revoke all on private.segredos from public, anon, authenticated;

insert into private.segredos (chave, valor)
values ('cpf_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (chave) do nothing;   -- reaplicar a migration NÃO rotaciona

comment on table private.segredos is
  'Segredos do servidor. Fora da API (schema private) e revogado de todos os papeis. Rotacionar cpf_pepper invalida a correlacao historica da auditoria.';

-- ------------------------------------------------------------
-- HMAC do CPF
-- ------------------------------------------------------------
create or replace function private.hmac_cpf(p_cpf text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pepper text;
begin
  select valor into v_pepper from private.segredos where chave = 'cpf_pepper';
  if v_pepper is null then
    -- Falhar fechado: sem pepper, é melhor não registrar do que registrar algo
    -- reversível. Devolve marcador, nunca o CPF.
    return 'sem-pepper';
  end if;
  return encode(
    extensions.hmac(regexp_replace(p_cpf, '\D', '', 'g'), v_pepper, 'sha256'),
    'hex'
  );
end;
$$;

revoke execute on function private.hmac_cpf(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- AUDITORIA / RATE LIMIT
--
-- A MESMA tabela serve às duas coisas: a janela deslizante é uma contagem
-- sobre ela. Duas tabelas dariam duas verdades.
-- ------------------------------------------------------------
create table public.validacao_tentativas (
  id                 bigserial primary key,
  estabelecimento_id text not null references public.estabelecimentos (id) on delete cascade,
  por_usuario        uuid references public.profiles (id) on delete set null,
  -- HMAC, nunca o CPF. O nome da coluna diz isso para quem for ler depois.
  cpf_hmac           text not null,
  resultado          text not null,
  criado_em          timestamptz not null default now()
);

-- Índice do caminho quente: a contagem da janela é sempre por
-- (estabelecimento, tempo recente).
create index validacao_tentativas_estab_tempo_idx
  on public.validacao_tentativas (estabelecimento_id, criado_em desc);

alter table public.validacao_tentativas enable row level security;
-- Nenhuma policy: ninguém lê nem escreve por PostgREST. Só as funções
-- `security definer` abaixo tocam esta tabela.
revoke all on public.validacao_tentativas from anon, authenticated;
revoke all on sequence public.validacao_tentativas_id_seq from anon, authenticated;

comment on table public.validacao_tentativas is
  'Fase 8/V2: auditoria e janela de rate limit da busca por CPF. Guarda HMAC, NUNCA o CPF. Sem policy: so definer escreve.';

-- ------------------------------------------------------------
-- DÍGITO VERIFICADOR — a mesma regra de `src/lib/cpf.ts`, aqui também
--
-- Duplicação DELIBERADA. O módulo puro dá mensagem imediata ao lojista e é
-- herdado pelo app nativo; esta função é a barreira real, porque a Server
-- Action não é fronteira para quem fala PostgREST direto. A suíte compara as
-- duas implementações caso a caso, para que não divirjam.
-- ------------------------------------------------------------
create or replace function public.cpf_dv_valido(p_cpf text)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  soma int;
  dv int;
  i int;
begin
  if length(d) <> 11 then return false; end if;
  -- Sequências repetidas passam na conta mas não são CPF. Pegadinha clássica
  -- de quem implementa só a fórmula.
  if d ~ '^(.)\1{10}$' then return false; end if;

  soma := 0;
  for i in 1..9 loop
    soma := soma + substring(d, i, 1)::int * (11 - i);
  end loop;
  dv := (soma * 10) % 11;
  if dv = 10 then dv := 0; end if;
  if dv <> substring(d, 10, 1)::int then return false; end if;

  soma := 0;
  for i in 1..10 loop
    soma := soma + substring(d, i, 1)::int * (12 - i);
  end loop;
  dv := (soma * 10) % 11;
  if dv = 10 then dv := 0; end if;
  return dv = substring(d, 11, 1)::int;
end;
$$;

revoke execute on function public.cpf_dv_valido(text) from public, anon;
grant  execute on function public.cpf_dv_valido(text) to authenticated;

-- ------------------------------------------------------------
-- V1a — BUSCAR ATIVAÇÕES POR CPF
-- ------------------------------------------------------------
create or replace function public.buscar_ativacoes_por_cpf(p_cpf text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_estab     text;
  v_digitos   text;
  v_hmac      text;
  v_tentativas int;
  v_itens     jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select e.id into v_estab
    from public.estabelecimentos e
   where e.owner_id = v_uid
   limit 1;
  if v_estab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  -- ---------- BARREIRA 1: dígito verificador, antes de qualquer dado ----------
  v_digitos := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if not public.cpf_dv_valido(v_digitos) then
    -- Não conta para o rate limit e não vai para a auditoria: entrada
    -- malformada não é tentativa de busca, e registrá-la encheria a tabela
    -- com ruído que atrapalharia investigar abuso de verdade.
    return jsonb_build_object('ok', false, 'motivo', 'cpf_invalido');
  end if;

  -- ---------- BARREIRA 2: rate limit ----------
  select count(*) into v_tentativas
    from public.validacao_tentativas t
   where t.estabelecimento_id = v_estab
     and t.criado_em > now() - interval '2 minutes';

  -- Janela de 2 min com teto de 20 = média de 10/min, e o bloqueio dura até a
  -- janela esvaziar. Um único número governa as duas coisas.
  if v_tentativas >= 20 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  v_hmac := private.hmac_cpf(v_digitos);

  -- ---------- BARREIRA 4: posse ----------
  select coalesce(jsonb_agg(x order by x->>'ativado_em' desc), '[]'::jsonb)
    into v_itens
    from (
      select jsonb_build_object(
               -- row_id, NUNCA o código: o código é credencial ao portador, e
               -- é justamente o que o consumidor não tem neste fluxo. Ecoá-lo
               -- criaria mais um caminho por onde ele vaza (tela, print, log).
               'row_id', cu.id,
               'cupom', c.titulo,
               'nome', coalesce(nullif(split_part(p.nome, ' ', 1), ''), 'Cliente'),
               -- Mascarado mesmo o lojista tendo o documento em mãos: a
               -- resposta não precisa ecoar o CPF para cumprir sua função.
               'cpf_mascarado', public.mascarar_cpf(p.cpf),
               'ativado_em', cu.ativado_em
             ) as x
        from public.cupons_usuario cu
        join public.cupons c   on c.id = cu.cupom_id
        join public.profiles p on p.id = cu.usuario_id
       where c.estabelecimento_id = v_estab
         and regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g') = v_digitos
         and cu.status = 'ativo'
         and (cu.expira_em is null or cu.expira_em > now())
    ) t;

  insert into public.validacao_tentativas
    (estabelecimento_id, por_usuario, cpf_hmac, resultado)
  values
    (v_estab, v_uid, v_hmac,
     case when jsonb_array_length(v_itens) > 0 then 'encontrado' else 'sem_ativacao' end);

  -- ---------- BARREIRA 3: resposta única ----------
  -- CPF inexistente, CPF de outro estabelecimento e CPF sem ativação caem
  -- todos AQUI, com o MESMO objeto. Nenhum dos três é distinguível pela
  -- resposta — é o que impede a RPC de virar oráculo de enumeração.
  if jsonb_array_length(v_itens) = 0 then
    return jsonb_build_object('ok', false, 'motivo', 'sem_ativacao_aqui');
  end if;

  return jsonb_build_object('ok', true, 'itens', v_itens);
end;
$$;

comment on function public.buscar_ativacoes_por_cpf(text) is
  'Fase 8/V1: ativacoes ATIVAS do CPF nos cupons do estabelecimento do chamador. Resposta unica para todos os "nao achei". Devolve row_id, nunca o codigo; CPF sempre mascarado.';

revoke execute on function public.buscar_ativacoes_por_cpf(text) from public, anon;
grant  execute on function public.buscar_ativacoes_por_cpf(text) to authenticated;

-- ------------------------------------------------------------
-- V1b — CONFIRMAR pela ativação
--
-- `cupons_usuario.id` é bigserial, logo ADIVINHÁVEL. A checagem de posse e de
-- status é refeita aqui inteira; esta função não confia em nada que a busca
-- tenha decidido antes.
-- ------------------------------------------------------------
create or replace function public.validar_cupom_por_ativacao(p_row_id bigint)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estab  text;
  v_codigo text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_sessao');
  end if;

  select e.id into v_estab
    from public.estabelecimentos e
   where e.owner_id = v_uid
   limit 1;
  if v_estab is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  select cu.codigo into v_codigo
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
   where cu.id = p_row_id
     and c.estabelecimento_id = v_estab     -- posse, de novo
     and cu.status = 'ativo'                -- status, de novo
     and (cu.expira_em is null or cu.expira_em > now());

  if v_codigo is null then
    -- Mesma resposta única: um id de outro estabelecimento é indistinguível
    -- de um id inexistente ou já validado.
    return jsonb_build_object('ok', false, 'motivo', 'sem_ativacao_aqui');
  end if;

  -- Reusa a MESMA transação de sempre: pontos, evento e NPS continuam saindo
  -- de `validar_cupom`. Um segundo caminho de validação seria um segundo
  -- lugar para as regras divergirem.
  return public.validar_cupom(v_codigo);
end;
$$;

comment on function public.validar_cupom_por_ativacao(bigint) is
  'Fase 8/V1: confirma a validacao a partir do row_id. Re-checa posse e status (o id e adivinhavel) e delega para validar_cupom.';

revoke execute on function public.validar_cupom_por_ativacao(bigint) from public, anon;
grant  execute on function public.validar_cupom_por_ativacao(bigint) to authenticated;
