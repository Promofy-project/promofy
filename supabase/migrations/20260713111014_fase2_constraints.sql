-- ============================================================
-- Promofy — Fase 2 · Migration 6: constraints do ciclo no servidor
-- ============================================================

-- Reativação pós-expiração: cada ativação vira a SUA linha em
-- cupons_usuario (histórico preservado). Só pode existir UMA
-- ativação 'ativo' por (usuário, cupom) — o RPC flipa vencidas
-- para 'expirado' antes de inserir.
alter table public.cupons_usuario
  drop constraint cupons_usuario_usuario_id_cupom_id_key;

create unique index uniq_cupons_usuario_ativo
  on public.cupons_usuario(usuario_id, cupom_id)
  where status = 'ativo';

-- Idempotência do ledger: no máximo UM lançamento por
-- (usuário, ação, referência) — validar duas vezes ou responder o
-- NPS duas vezes não credita em dobro nem sob corrida.
-- usuario_id incluso: referências como 'bonus:<uid>' não colidem
-- entre usuários.
create unique index uniq_pontos_por_referencia
  on public.pontos_transacoes(usuario_id, acao, referencia_id)
  where referencia_id is not null;

-- Regra de negócio do cliente: janela padrão de ativação = 5 horas.
-- (Seed herda o default no reset; o campo do cupom prevalece na RPC.)
alter table public.cupons
  alter column prazo_ativacao_horas set default 5;

-- Nota: o revoke de execute em gerar_codigo_cupom acontece na migration 7,
-- junto com o revoke dos grants diretos de escrita — enquanto o INSERT
-- direto existir (até as RPCs assumirem), o DEFAULT da coluna codigo
-- executa a função com o privilégio do chamador.
