-- ============================================================
-- Promofy — Fase 1 · Migration 2: funções e triggers
-- ============================================================

-- ------------------------------------------------------------
-- Perfil automático no signup.
-- Role vem SOMENTE de raw_app_meta_data (setado por admin API /
-- seed com service_role) — NUNCA de raw_user_meta_data, que é
-- editável pelo próprio usuário (options.data no signUp).
-- Inputs client-controlled são validados defensivamente: um cast
-- inválido NÃO pode abortar a criação do usuário no GoTrue.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  role_claim text := new.raw_app_meta_data->>'role';
  nasc text := new.raw_user_meta_data->>'nascimento';
begin
  insert into public.profiles (id, role, nome, cidade, cpf, telefone, nascimento)
  values (
    new.id,
    case when role_claim in ('consumidor','lojista','admin')
         then role_claim::public.papel_usuario
         else 'consumidor'::public.papel_usuario end,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    new.raw_user_meta_data->>'cidade',
    new.raw_user_meta_data->>'cpf',
    new.raw_user_meta_data->>'telefone',
    case when nasc ~ '^\d{4}-\d{2}-\d{2}$' then nasc::date else null end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Código de cupom PRMF-XXXX-XXXX.
-- Alfabeto de 32 chars SEM 0/O/1/I — idêntico ao gerador do front
-- (src/components/coupon-state-provider.tsx) e aceito pelo regex do
-- portal (/^PRMF-[A-Z0-9]{4}-[A-Z0-9]{4}$/).
-- SECURITY DEFINER: o pre-check de colisão precisa enxergar códigos
-- de TODOS os usuários; como invoker, o RLS esconderia linhas alheias
-- e o retry seria cego (a unicidade real continua no constraint).
-- ------------------------------------------------------------
create or replace function public.gerar_codigo_cupom()
returns text
language plpgsql
volatile
security definer set search_path = ''
as $$
declare
  -- prefixo v_ evita ambiguidade com a coluna cupons_usuario.codigo
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo text;
  v_i int;
  v_tentativa int := 0;
begin
  loop
    v_codigo := 'PRMF-';
    for v_i in 1..8 loop
      v_codigo := v_codigo || substr(v_chars, 1 + floor(random()*32)::int, 1);
      if v_i = 4 then
        v_codigo := v_codigo || '-';
      end if;
    end loop;
    exit when not exists (
      select 1 from public.cupons_usuario cu where cu.codigo = v_codigo
    );
    v_tentativa := v_tentativa + 1;
    if v_tentativa > 5 then
      raise exception 'colisao de codigo de cupom apos 5 tentativas';
    end if;
  end loop;
  return v_codigo;
end;
$$;

-- Função definer lê across-rows: manter superfície mínima.
revoke execute on function public.gerar_codigo_cupom() from public, anon;

alter table public.cupons_usuario
  alter column codigo set default public.gerar_codigo_cupom();

-- ------------------------------------------------------------
-- atualizado_em automático
-- ------------------------------------------------------------
create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_profiles_atualizado_em
  before update on public.profiles
  for each row execute function public.set_atualizado_em();

create trigger trg_estabelecimentos_atualizado_em
  before update on public.estabelecimentos
  for each row execute function public.set_atualizado_em();

create trigger trg_cupons_atualizado_em
  before update on public.cupons
  for each row execute function public.set_atualizado_em();
