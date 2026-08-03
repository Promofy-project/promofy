-- ============================================================
-- Promofy — Fase 6 · Migration 18: economia variável (C3)
--
-- O campo `economia` passa a significar "economia MÍNIMA GARANTIDA", e
-- `economia_variavel` marca os cupons em que o valor real pode ser
-- maior ("a partir de R$ X"). No total do consumidor, quando o
-- acumulado inclui pelo menos um cupom variável, o app mostra
-- "mais de R$ X".
--
-- ------------------------------------------------------------
-- O NÚMERO QUE JÁ ESTÁ NO AR NÃO PODE MUDAR
-- ------------------------------------------------------------
-- Este é o item que toca a economia da Fase 4/3, que o cliente vê na
-- home. Duas escolhas garantem que o valor exibido hoje continue
-- idêntico depois desta migration:
--
--   1. `economia_variavel` nasce `false` para TODA linha existente.
--      Cupom fixo é o caso 100% do acervo atual, então "mínima
--      garantida" e "economia" coincidem — a soma não muda em nada.
--      Não há backfill de `economia`, nem reinterpretação de dado.
--
--   2. `economia_total_consumidor()` NÃO É TOCADA. Continua `numeric`,
--      continua somando `c.economia` das linhas validadas. A
--      funcionalidade nova entra numa RPC NOVA, ao lado.
--
-- POR QUE UMA RPC NOVA E NÃO TROCAR O RETORNO DA ANTIGA:
-- mudar o tipo de retorno exige `drop function` + recriar. O deploy
-- é coreografado BANCO ANTES DO CÓDIGO, então existe uma janela em que
-- o banco novo roda com o código ANTIGO em produção — e o código antigo
-- faz `Number(economiaData)` sobre o retorno. Com jsonb no lugar de
-- numeric isso vira `NaN`, e todo consumidor logado veria "R$ NaN" na
-- home até o deploy do código terminar. Aditivo custa uma função a
-- mais; destrutivo custa a home do cliente durante a janela.
-- Bônus: `test-fase3.ts` (que assere a economia numeric) segue verde
-- sem uma linha editada — é a prova de compatibilidade de graça.
-- ============================================================

alter table public.cupons
  add column if not exists economia_variavel boolean not null default false;

comment on column public.cupons.economia is
  'Fase 6: economia MÍNIMA GARANTIDA em R$. Com economia_variavel = true, o valor real pode ser maior ("a partir de").';
comment on column public.cupons.economia_variavel is
  'Fase 6: true = a economia é "a partir de" este valor. Existentes nascem false — o total já exibido não muda.';

-- coluna nova não herda o grant por coluna da Fase 3 (ver migration 16)
grant update (economia_variavel) on public.cupons to authenticated;

-- ------------------------------------------------------------
-- ECONOMIA DO CONSUMIDOR — total + sinalização, numa ida só.
--
-- `total` é a MESMA soma de `economia_total_consumidor()`: com todo o
-- acervo fixo, os dois devolvem o mesmo número, e a suíte prova isso
-- comparando as duas no mesmo estado.
--
-- `inclui_variavel` responde "algum cupom que entrou nesta soma é 'a
-- partir de'?" — é o que autoriza a UI a escrever "mais de R$ X".
-- Decidir isso no cliente exigiria mandar a lista de cupons validados
-- só para ele testar uma flag; e o app nativo teria de repetir a
-- decisão. Aqui é uma leitura, um contrato.
--
-- SECURITY DEFINER pelo mesmo motivo da RPC da Fase 3, e a razão é
-- contraintuitiva o bastante para ficar escrita: sob `invoker`, cupom
-- de estabelecimento SUSPENSO some pela RLS do catálogo e a economia
-- seria SUBcontada — o consumidor perderia dinheiro que já economizou
-- porque o lojista foi suspenso depois. O predicado `usuario_id =
-- auth.uid()` dentro da função é, então, a única barreira: ele não pode
-- sair daqui.
-- ------------------------------------------------------------
create or replace function public.economia_consumidor()
returns jsonb
language sql stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'total', coalesce(sum(c.economia), 0)::numeric,
    'inclui_variavel', coalesce(bool_or(c.economia_variavel), false)
  )
    from public.cupons_usuario cu
    join public.cupons c on c.id = cu.cupom_id
   where cu.usuario_id = (select auth.uid())
     and cu.status = 'validado';
$$;

comment on function public.economia_consumidor() is
  'Fase 6: {total, inclui_variavel} do consumidor logado. `total` soma a economia MÍNIMA garantida; `inclui_variavel` autoriza o "mais de R$ X". Aditiva — economia_total_consumidor() segue intacta para a janela de deploy.';

revoke execute on function public.economia_consumidor() from public, anon;
grant execute on function public.economia_consumidor() to authenticated;
