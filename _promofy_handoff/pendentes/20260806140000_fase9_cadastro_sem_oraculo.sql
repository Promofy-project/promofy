-- ============================================================
-- Fase 9 / Z2 — O CADASTRO PARA DE CONFIRMAR EXISTÊNCIA DE CONTA
--
-- O PROBLEMA. `/m/cadastro` respondia "Este e-mail já está cadastrado" a
-- qualquer visitante. Isso é um oráculo de existência de conta, aberto e
-- gratuito — e destoa do resto do projeto: a Fase 8 gastou uma migration
-- inteira para que a busca por CPF devolvesse a MESMA resposta para "não
-- existe", "é de outro estabelecimento" e "não tem ativação", justamente para
-- não revelar quem é cliente de quem. Enquanto isso, um formulário público
-- respondia "esta pessoa é usuária do Promofy" para quem perguntasse.
--
-- O QUE ESTA MIGRATION FAZ, E O QUE ELA NÃO FAZ.
--
-- Faz: a contagem que permite encarecer a enumeração em escala, com auditoria
-- sem PII (HMAC com o pepper do Vault, o mesmo mecanismo e o mesmo argumento
-- da Fase 8 — sha256 puro de e-mail não anonimiza nada).
--
-- NÃO faz: fechar o oráculo. Com `mailer_autoconfirm` LIGADO em produção
-- (decisão da Fase 3), o cadastro bem-sucedido cria sessão e redireciona para
-- /m/onboarding. O fracasso não redireciona. Essa diferença é observável, e
-- nenhuma mensagem neutra a elimina. Fechar de verdade exige ligar a
-- confirmação de e-mail — decisão de produto, registrada no backlog.
--
-- Portanto: isto remove o oráculo EXPLÍCITO e encarece o resto. É o que é.
-- ============================================================

-- ------------------------------------------------------------
-- Pepper próprio, no Vault.
--
-- Separado do `cpf_pepper` de propósito: são domínios diferentes, e o dia em
-- que um precisar ser rotacionado o outro não deve ser arrastado junto.
-- Guardado por `if not exists`, como a 27 — reaplicar não rotaciona.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cadastro_pepper') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cadastro_pepper',
      'Fase 9/Z2 — pepper do HMAC de e-mail e IP na auditoria de cadastro.'
    );
  end if;
end
$$;

create or replace function private.hmac_cadastro(p_valor text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pepper text;
begin
  select decrypted_secret into v_pepper
    from vault.decrypted_secrets where name = 'cadastro_pepper';
  -- Falha FECHADA, como a hmac_cpf: sem pepper devolve marcador, nunca um
  -- hash reversível e nunca o valor original.
  if v_pepper is null then return 'sem-pepper'; end if;
  return encode(
    extensions.hmac(lower(btrim(coalesce(p_valor, ''))), v_pepper, 'sha256'),
    'hex'
  );
end;
$$;

revoke execute on function private.hmac_cadastro(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- A tabela nasce em `private`, não em `public`.
--
-- É a correção (4) da Fase 8 aplicada de saída: em `public`, mesmo revogada,
-- a tabela seria alcançável por `service_role` via PostgREST. Em `private`,
-- que não está em [api].schemas, nenhuma chave chega — está provado em
-- produção (PGRST106).
-- ------------------------------------------------------------
create table if not exists private.cadastro_tentativas (
  id          bigint generated always as identity primary key,
  ip_hmac     text not null,
  email_hmac  text not null,
  resultado   text not null check (resultado in ('tentativa', 'bloqueado')),
  criado_em   timestamptz not null default now()
);

revoke all on private.cadastro_tentativas from public, anon, authenticated;

create index if not exists cadastro_tentativas_ip_idx
  on private.cadastro_tentativas (ip_hmac, criado_em desc);

comment on table private.cadastro_tentativas is
  'Fase 9/Z2: janela de rate limit do cadastro. Guarda HMAC de IP e e-mail, NUNCA os valores. Em `private`: fora da API com QUALQUER chave.';

-- ------------------------------------------------------------
-- registrar_tentativa_cadastro(p_ip, p_email) -> jsonb
--
-- Chamada ANTES do signUp. Devolve {ok:true} ou {ok:false,motivo:'muitas_tentativas'}.
--
-- `security definer` é obrigatório: quem cadastra é `anon`, e `anon` não tem —
-- nem pode ter — acesso a `private`.
--
-- O advisory lock repete a lição (2) da Fase 8: sem ele, `count` e `insert`
-- ficam separados pela latência da consulta em READ COMMITTED, e disparos
-- paralelos passam todos juntos. O teto viraria "20 × concorrência".
--
-- Teto por IP e não por e-mail: enumerar exige VARIAR o e-mail, então contar
-- por e-mail não pegaria nada. O e-mail entra só na auditoria, para que a
-- tabela mostre a MAGNITUDE (mesma razão da correção (6) da Fase 8).
--
-- 20 em 10 minutos: cadastro legítimo é raro — uma pessoa faz um, talvez dois
-- se errar. Enumeração é volumosa por definição. O teto é folgado para o
-- humano e apertado para o script.
-- ------------------------------------------------------------
create or replace function public.registrar_tentativa_cadastro(p_ip text, p_email text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ip    text := private.hmac_cadastro(coalesce(nullif(btrim(p_ip), ''), 'sem-ip'));
  v_email text := private.hmac_cadastro(p_email);
  v_n     int;
begin
  perform pg_advisory_xact_lock(hashtext('cadastro:' || v_ip));

  select count(*) into v_n
    from private.cadastro_tentativas t
   where t.ip_hmac = v_ip
     and t.resultado = 'tentativa'
     and t.criado_em > now() - interval '10 minutes';

  if v_n >= 20 then
    -- Registrado para medir o ataque, mas FORA da janela: contar o bloqueio
    -- deixaria o atacante se auto-bloquear para sempre de graça.
    insert into private.cadastro_tentativas (ip_hmac, email_hmac, resultado)
    values (v_ip, v_email, 'bloqueado');
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  insert into private.cadastro_tentativas (ip_hmac, email_hmac, resultado)
  values (v_ip, v_email, 'tentativa');

  return jsonb_build_object('ok', true);
end;
$$;

-- `anon` PRECISA executar: quem se cadastra ainda não tem sessão.
revoke execute on function public.registrar_tentativa_cadastro(text, text) from public;
grant  execute on function public.registrar_tentativa_cadastro(text, text) to anon, authenticated;

comment on function public.registrar_tentativa_cadastro(text, text) is
  'Fase 9/Z2: janela deslizante por IP no cadastro (20/10min). Encarece a enumeracao de contas; NAO fecha o oraculo enquanto mailer_autoconfirm estiver ligado.';
