-- ============================================================
-- Promofy — Fase 6 · Migration 19: cupom de lojista nasce 'pendente'
--   (fecha o auto-publish que a Fase 3 fechou só no UPDATE)
--
-- ACHADO NA EXPLORAÇÃO DESTA FASE, não pedido no escopo — mas mora
-- exatamente onde a C1 mexe, e as colunas novas herdariam o buraco.
--
-- A Fase 3 (20260721120100) corrigiu o auto-approve: `revoke update on
-- table` + `grant update (colunas...)` SEM `status`, para o lojista não
-- poder `PATCH /rest/v1/cupons {status:'ativo'}` no próprio cupom
-- pendente. Mas só o UPDATE foi revogado. O INSERT nunca foi:
-- `authenticated` mantém o grant de tabela, e a policy de INSERT
-- ("cupons: lojista insere nos proprios") checa APENAS a posse do
-- estabelecimento. Ou seja, o caminho continuava aberto pela porta da
-- frente — bastava CRIAR o cupom já com `status: 'ativo'` em vez de
-- tentar promovê-lo depois. `test-fase3.ts:113` cobre só o UPDATE.
--
-- POR QUE TRIGGER E NÃO `revoke insert` + `grant insert (colunas)`,
-- que seria o espelho exato da Fase 3:
--
--   revogar o INSERT da coluna `status` quebraria a `criarCupomAction`
--   ATUAL, que manda `status: 'pendente'` explicitamente — e quebraria
--   na JANELA entre o `db push` e o deploy do código, em que o banco
--   novo roda com o código antigo. Todo lojista que tentasse criar
--   cupom nesse intervalo levaria 42501 e a mensagem genérica "Não foi
--   possível salvar o cupom.".
--
--   O trigger é INERTE para quem já manda 'pendente' (o valor que ele
--   forçaria é o que já veio), então a janela de deploy fica segura, e
--   ainda cobre o PostgREST direto que um `grant` por coluna cobriria.
--
-- Alterar o DEFAULT da coluna não bastaria: default só vale quando a
-- coluna é OMITIDA, e o atacante justamente a informa.
-- ============================================================

create or replace function public.forcar_status_pendente()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Só mexe em INSERT vindo de USUÁRIO AUTENTICADO que não seja admin.
  --
  -- `auth.uid() is null` cobre, de uma vez, todos os caminhos que devem
  -- passar intactos: o seed.sql (roda como `postgres`, sem sessão), o
  -- service_role das suítes e do seed-users (PostgREST sem JWT de
  -- usuário) e qualquer manutenção via psql. Nenhum deles tem uid.
  --
  -- O admin é liberado para não amarrar uma futura criação de cupom
  -- pelo /admin; hoje ele não cria nenhum.
  if (select auth.uid()) is not null and not (select private.is_admin()) then
    new.status := 'pendente';
  end if;
  return new;
end;
$$;

revoke execute on function public.forcar_status_pendente() from public, anon, authenticated;

drop trigger if exists trg_cupons_status_pendente on public.cupons;
create trigger trg_cupons_status_pendente
  before insert on public.cupons
  for each row execute function public.forcar_status_pendente();

comment on function public.forcar_status_pendente() is
  'Fase 6: cupom criado por lojista nasce pendente, mesmo via PostgREST direto. Fecha o auto-publish no INSERT (a Fase 3 fechou só o UPDATE).';
