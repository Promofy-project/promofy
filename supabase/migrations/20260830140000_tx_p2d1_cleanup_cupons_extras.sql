-- ============================================================
-- Promofy — TX-P2D1 · Limpeza dos cupons EXTRA identificados no TX-P2D0
--
-- DATA cleanup, NÃO DDL estrutural. Não cria, não altera e não apaga
-- nenhuma tabela/coluna/view/trigger/policy. Não toca a taxonomia 14×75
-- (`public.segmentos` / `public.categorias_novas`) nem o legado
-- (`public.categorias`, `public.estabelecimentos`,
-- `public.estabelecimento_categorias`) além de `public.cupons`, do que
-- suas FKs ON DELETE CASCADE alcançam, e dos fatos de
-- `public.pontos_transacoes` derivados EXCLUSIVAMENTE desses cupons
-- (ver "LEDGER DE PONTOS" abaixo).
--
-- Origem: a auditoria TX-P2D0 encontrou 34 cupons no hospedado onde só
-- 14 são esperados (docs/taxonomia/depara-v1.json). Os outros 20 são
-- artefatos de QA/dev — todos sob o mesmo estabelecimento de teste (e1),
-- criados durante testes de fases anteriores, nunca limpos. Decisão do
-- líder técnico (TX-P2D1A): remover os 20 sem mapear e sem expandir o
-- conjunto de categorias de e1 para preservá-los. As contas de
-- teste/demo (consumidor@/convidado@) NÃO são apagadas — só os 20
-- cupons e os fatos que dependem EXCLUSIVAMENTE deles.
--
-- PORTABILIDADE: os 20 IDs abaixo existem no hospedado, mas em
-- local/QA recém-resetado `public.cupons` está vazio quando esta
-- migration roda (seed.sql roda DEPOIS das migrations no db:reset) —
-- então esta migration é NO-OP ali. Ela só age quando encontra as 20
-- linhas EXATAS que a auditoria viu; qualquer contagem intermediária
-- (1..19, ou os 20 presentes mas com propriedades diferentes das
-- auditadas) aborta ALTO. Um ambiente onde isso já rodou uma vez e
-- rodasse de novo também cai no caminho NO-OP (target_count = 0).
--
-- LEDGER DE PONTOS (TX-P2D1B) — correção sobre a auditoria TX-P2D0:
-- a checagem original de soft reference comparava `referencia_id`
-- direto contra IDs de cupom, o que é sempre trivialmente zero —
-- `pontos_transacoes.referencia_id` guarda `cupons_usuario.id::text`
-- (confirmado no corpo de `public.validar_cupom`), nunca um ID de
-- cupom. O preflight TX-P2D1D0, rodando a checagem CORRETA pela
-- primeira vez contra o hospedado, encontrou 26 linhas de
-- `pontos_transacoes` (17 `resgate` + 9 `nps`, somando 1120 pontos)
-- geradas exclusivamente pelos usos/NPS dos 21 `cupons_usuario` dos 20
-- extras. Decisão do líder técnico: remover essas 26 linhas junto —
-- `pontos_transacoes` é o ledger fonte de verdade (saldo = SUM(pontos),
-- sem saldo persistido separado para sincronizar), e preservá-las
-- depois de apagar os cupons/ativações que as geraram deixaria pontos
-- órfãos semanticamente. Isto só é aceitável porque os dados atuais são
-- de desenvolvimento/teste/demo — NÃO é precedente para dado real de
-- cliente, onde ledger histórico pediria estratégia de
-- auditoria/compensação, nunca apagar.
--
-- Os números abaixo (78 cupom_eventos, 21 cupons_usuario, 26
-- pontos_transacoes / 17 resgate / 9 nps / soma 1120, totais gerais
-- 20586/28) são os que a auditoria mediu no hospedado — não são
-- reconstituídos aqui por suposição. Se o hospedado tiver mudado entre
-- a auditoria e este apply, a migration RECUSA seguir com números
-- diferentes dos auditados em vez de assumir que nada mudou.
-- ============================================================

do $$
declare
  -- Os 14 cupons canônicos (docs/taxonomia/depara-v1.json) — contrato
  -- pequeno e fechado, por isso pode viver como literal aqui, igual aos
  -- mapas congelados de scripts/test-tx-p2c.ts.
  v_ids_canonicos text[] := array[
    'c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10',
    'c11', 'c12', 'p-campanha-esgotada', 'p-campanha-expirada'
  ];
  -- Os 20 extras identificados no TX-P2D0 — não adicionar, não remover
  -- silenciosamente.
  v_ids_extras text[] := array[
    'd768d289-431b-498e-aa0d-a0d1cbf51b77',
    'ae1fa920-d094-430f-8739-5f56daef8d0b',
    '093cb015-a11d-4703-808b-e26fb090df02',
    '40b297aa-1484-46c6-a985-cdfc4b220929',
    'c2ff55a5-d082-445c-b728-ed446e57f9c1',
    '69dfb026-8bdc-422d-8b94-24d249a9c229',
    '271a9a69-b45f-458f-99f5-4daf2ca50d2d',
    'b24a3ea5-44df-44a9-8908-4da29c102fe2',
    '6dbbde09-2da5-4f80-9fca-61badd527cb0',
    '74648f5e-d7a5-4168-bc5b-73c51842051c',
    '2a0904ff-e286-4720-ac2d-90c60a2b3b66',
    '4fa3788f-7005-4d6e-9826-e9ab7ca7558c',
    '03c532b4-33da-439c-a3a1-5dddd2be5adf',
    '84e451a7-7cef-485d-9f66-6ccb8760b1b6',
    '639e1187-3373-42a4-b1ca-0cc3b80f2b08',
    '20e8434f-92bb-4224-a68d-d4cd4be9141b',
    '46c59d64-8106-4307-8b19-c87761c2a9c8',
    'c364f7dc-a296-49d2-8840-0c092e8ab936',
    'b96b6c01-82f7-47d0-acd0-b9ba547576bd',
    '57d1127f-b803-4ec8-b972-12aed17fad03'
  ];

  v_target_count int;
  v_canonicos_no_alvo int;
  v_canonicos_presentes int;
  v_est_errado int;
  v_cat_errado int;
  v_eventos_antes int;
  v_usuario_antes int;
  v_eventos_total_antes int;
  v_usuario_total_antes int;
  v_eventos_total_depois int;
  v_usuario_total_depois int;
  v_eventos_orfaos int;
  v_usuario_orfaos int;
  v_cupons_restantes int;
  v_ids_restantes text[];

  -- IDs de cupons_usuario capturados ANTES de qualquer delete — o
  -- CASCADE apaga essas linhas junto com os cupons, então sem capturar
  -- os IDs agora não haveria como localizar os pontos_transacoes
  -- derivados depois. bigint (tipo real da PK), convertido para text só
  -- na hora de comparar com pontos_transacoes.referencia_id.
  v_ids_cupons_usuario bigint[];
  v_ids_cupons_usuario_text text[];

  v_pontos_total int;
  v_pontos_resgate int;
  v_pontos_nps int;
  v_pontos_soma int;
  v_pontos_resgate_uniforme boolean;
  v_pontos_nps_uniforme boolean;
  v_pontos_total_geral_antes int;
  v_pontos_soma_geral_antes numeric;
  v_pontos_deletados int;
  v_pontos_total_geral_depois int;
  v_pontos_soma_geral_depois numeric;
  v_pontos_orfaos int;
begin
  -- ------------------------------------------------------------
  -- E. target_count = 0 (ambiente limpo) é NO-OP legítimo — local/QA
  -- recém-resetado nunca teve esses 20 IDs. target_count = 20 é o único
  -- outro estado aceito; 1..19 é estado parcial e ABORTA.
  -- ------------------------------------------------------------
  select count(*) into v_target_count
    from public.cupons
   where id = any(v_ids_extras);

  if v_target_count = 0 then
    raise notice 'TX-P2D1: 0/20 extras presentes neste ambiente — NO-OP (esperado em local/QA recém-resetado, ou já limpo antes).';
    return;
  end if;

  if v_target_count <> 20 then
    raise exception 'TX-P2D1: estado PARCIAL inesperado — % de 20 extras presentes. Esperado 0 (ambiente limpo) ou 20 (hospedado auditado). Abortando: limpeza parcial não é aceitável.', v_target_count;
  end if;

  raise notice 'TX-P2D1: 20/20 extras presentes — prosseguindo com os asserts pré-delete.';

  -- ------------------------------------------------------------
  -- F.4/F.5 — nenhum dos 14 canônicos está na lista de remoção, e os
  -- 14 continuam existindo antes de mexer em qualquer coisa.
  -- ------------------------------------------------------------
  select count(*) into v_canonicos_no_alvo
    from public.cupons
   where id = any(v_ids_extras)
     and id = any(v_ids_canonicos);
  if v_canonicos_no_alvo <> 0 then
    raise exception 'TX-P2D1: % dos 20 IDs de limpeza colidem com IDs CANÔNICOS do depara-v1.json. Abortando — isto nunca deveria acontecer.', v_canonicos_no_alvo;
  end if;

  select count(*) into v_canonicos_presentes
    from public.cupons
   where id = any(v_ids_canonicos);
  if v_canonicos_presentes <> 14 then
    raise exception 'TX-P2D1: esperado 14 cupons canônicos presentes ANTES da limpeza, encontrado %. Estado diverge do auditado no TX-P2D0 — reconfirmar antes de aplicar.', v_canonicos_presentes;
  end if;

  -- ------------------------------------------------------------
  -- F.2/F.3 — todos os 20 pertencem a e1 e têm categoria_id legado
  -- 'alimentacao', exatamente como a auditoria encontrou.
  -- ------------------------------------------------------------
  select count(*) into v_est_errado
    from public.cupons
   where id = any(v_ids_extras)
     and estabelecimento_id is distinct from 'e1';
  if v_est_errado <> 0 then
    raise exception 'TX-P2D1: % dos 20 extras NÃO pertencem a e1 — estado diverge do auditado no TX-P2D0. Abortando.', v_est_errado;
  end if;

  select count(*) into v_cat_errado
    from public.cupons
   where id = any(v_ids_extras)
     and categoria_id is distinct from 'alimentacao';
  if v_cat_errado <> 0 then
    raise exception 'TX-P2D1: % dos 20 extras NÃO têm categoria_id legado = alimentacao — estado diverge do auditado. Abortando.', v_cat_errado;
  end if;

  -- ------------------------------------------------------------
  -- F.6 — dependências dos 20 batem EXATAMENTE com o que a auditoria
  -- mediu (78 cupom_eventos, 21 cupons_usuario). Qualquer atividade
  -- orgânica nova entre a auditoria e este apply é motivo de abortar
  -- e reconfirmar manualmente, não de seguir em frente calado.
  -- ------------------------------------------------------------
  select count(*) into v_eventos_antes
    from public.cupom_eventos
   where cupom_id = any(v_ids_extras);
  if v_eventos_antes <> 78 then
    raise exception 'TX-P2D1: cupom_eventos dos 20 extras = % — esperado EXATAMENTE 78 (auditoria). Estado hospedado divergiu — reconfirmar antes de aplicar, não presumir.', v_eventos_antes;
  end if;

  select array_agg(id) into v_ids_cupons_usuario
    from public.cupons_usuario
   where cupom_id = any(v_ids_extras);
  v_usuario_antes := coalesce(array_length(v_ids_cupons_usuario, 1), 0);
  if v_usuario_antes <> 21 then
    raise exception 'TX-P2D1: cupons_usuario dos 20 extras = % — esperado EXATAMENTE 21 (auditoria). Estado hospedado divergiu — reconfirmar antes de aplicar.', v_usuario_antes;
  end if;
  select array_agg(x::text) into v_ids_cupons_usuario_text from unnest(v_ids_cupons_usuario) x;

  -- Totais gerais das quatro tabelas de fato, capturados ANTES de
  -- qualquer delete — só para os asserts condicionais de delta
  -- (absoluto quando o baseline geral também bate com a auditoria,
  -- relativo caso contrário).
  select count(*) into v_eventos_total_antes from public.cupom_eventos;
  select count(*) into v_usuario_total_antes from public.cupons_usuario;
  select count(*) into v_pontos_total_geral_antes from public.pontos_transacoes;
  select coalesce(sum(pontos), 0) into v_pontos_soma_geral_antes from public.pontos_transacoes;

  -- ------------------------------------------------------------
  -- G/TX-P2D1B. Ledger de pontos derivado dos 21 cupons_usuario alvo.
  -- `pontos_transacoes.referencia_id` NÃO tem FK declarada; a leitura
  -- do corpo de `public.validar_cupom` confirma que ela guarda
  -- `cupons_usuario.id::text` (não `cupons.id`) — é o valor gravado em
  -- `insert into pontos_transacoes (..., referencia_id) values (...,
  -- v.id::text)`, onde v é a linha de cupons_usuario. O cruzamento é
  -- por esse `id`, nunca por `usuario_id` — filtrar por usuario_id
  -- apagaria bônus/visita/indicação e pontos de cupons canônicos da
  -- mesma conta, que não têm nada a ver com esta limpeza.
  --
  -- Exatamente 26 linhas são esperadas: 17 `resgate` + 9 `nps`,
  -- somando 1120 pontos — os números que o preflight TX-P2D1D0 mediu.
  -- Nenhuma outra ação deve aparecer nesse conjunto (resgate+nps tem
  -- de esgotar o total). Não deriva o total de `config_pontos` atual —
  -- valida o fato histórico já gravado, que não muda com config futura.
  -- ------------------------------------------------------------
  select
    count(*),
    count(*) filter (where pt.acao = 'resgate'),
    count(*) filter (where pt.acao = 'nps'),
    coalesce(sum(pt.pontos), 0),
    bool_and(pt.pontos = 50) filter (where pt.acao = 'resgate'),
    bool_and(pt.pontos = 30) filter (where pt.acao = 'nps')
    into v_pontos_total, v_pontos_resgate, v_pontos_nps, v_pontos_soma,
         v_pontos_resgate_uniforme, v_pontos_nps_uniforme
    from public.pontos_transacoes pt
   where pt.referencia_id = any(v_ids_cupons_usuario_text);

  if v_pontos_total <> 26 then
    raise exception 'TX-P2D1: pontos_transacoes ligados aos 21 cupons_usuario extras = % — esperado EXATAMENTE 26 (preflight TX-P2D1D0). Estado hospedado divergiu — reconfirmar antes de aplicar, não presumir.', v_pontos_total;
  end if;
  if v_pontos_resgate <> 17 then
    raise exception 'TX-P2D1: pontos_transacoes ação=resgate ligados aos extras = % — esperado EXATAMENTE 17. Abortando.', v_pontos_resgate;
  end if;
  if v_pontos_nps <> 9 then
    raise exception 'TX-P2D1: pontos_transacoes ação=nps ligados aos extras = % — esperado EXATAMENTE 9. Abortando.', v_pontos_nps;
  end if;
  if v_pontos_resgate + v_pontos_nps <> v_pontos_total then
    raise exception 'TX-P2D1: existe ação além de resgate/nps entre os 26 pontos_transacoes ligados aos extras (resgate=% + nps=% != total=%). Abortando — investigar antes de apagar.', v_pontos_resgate, v_pontos_nps, v_pontos_total;
  end if;
  if v_pontos_soma <> 1120 then
    raise exception 'TX-P2D1: soma de pontos ligados aos extras = % — esperado EXATAMENTE 1120. Abortando.', v_pontos_soma;
  end if;
  -- Checagem adicional de coerência (fato já gravado, não config atual):
  -- na auditoria, todo resgate valia 50 e todo nps valia 30. Se algum dia
  -- isso deixar de ser verdade sem que soma/contagens tenham mudado,
  -- ainda vale abortar — é sinal de que o conjunto capturado não é o
  -- mesmo que foi auditado.
  if v_pontos_resgate > 0 and coalesce(v_pontos_resgate_uniforme, true) is not true then
    raise exception 'TX-P2D1: nem todo pontos_transacoes de ação=resgate ligado aos extras vale 50 pontos, como na auditoria. Abortando.';
  end if;
  if v_pontos_nps > 0 and coalesce(v_pontos_nps_uniforme, true) is not true then
    raise exception 'TX-P2D1: nem todo pontos_transacoes de ação=nps ligado aos extras vale 30 pontos, como na auditoria. Abortando.';
  end if;

  raise notice 'TX-P2D1: todos os asserts pré-delete OK (20/20 presentes, e1/alimentacao confirmados, 78 eventos + 21 ativações + 26 pontos_transacoes [17 resgate + 9 nps = 1120] batendo com a auditoria).';

  -- ------------------------------------------------------------
  -- G. DELETE do ledger de pontos — ANTES do delete de cupons, porque
  -- depois do CASCADE os 21 cupons_usuario (e os IDs que os identificam)
  -- deixam de existir. Restrito por referencia_id = ANY(...), nunca por
  -- usuario_id — o alvo é só os 26 fatos derivados destes 21 usos, não
  -- qualquer outro ponto da mesma conta.
  -- ------------------------------------------------------------
  delete from public.pontos_transacoes
   where referencia_id = any(v_ids_cupons_usuario_text);
  get diagnostics v_pontos_deletados = row_count;

  if v_pontos_deletados <> 26 then
    raise exception 'TX-P2D1: DELETE em pontos_transacoes removeu % linha(s) — esperado EXATAMENTE 26. Abortando (a transação inteira desfaz, nada foi apagado de verdade).', v_pontos_deletados;
  end if;

  -- ------------------------------------------------------------
  -- H. DELETE — só em public.cupons. cupom_eventos e cupons_usuario
  -- são alcançados pelo ON DELETE CASCADE das duas FKs já existentes
  -- (cupom_eventos_cupom_id_fkey, cupons_usuario_cupom_id_fkey) — a
  -- migration não apaga essas tabelas explicitamente de propósito: se
  -- o CASCADE não fizer o trabalho, os asserts pós-delete abaixo pegam
  -- isso e a transação inteira desfaz (incluindo o delete de pontos
  -- acima).
  -- ------------------------------------------------------------
  delete from public.cupons where id = any(v_ids_extras);

  -- ------------------------------------------------------------
  -- I. Asserts pós-delete.
  -- ------------------------------------------------------------
  select count(*) into v_target_count from public.cupons where id = any(v_ids_extras);
  if v_target_count <> 0 then
    raise exception 'TX-P2D1: pós-delete, ainda restam % dos 20 extras em public.cupons. Abortando.', v_target_count;
  end if;

  select count(*) into v_eventos_orfaos from public.cupom_eventos where cupom_id = any(v_ids_extras);
  if v_eventos_orfaos <> 0 then
    raise exception 'TX-P2D1: pós-delete, % linha(s) de cupom_eventos ainda apontam para os 20 extras — o ON DELETE CASCADE não funcionou como esperado. Abortando.', v_eventos_orfaos;
  end if;

  select count(*) into v_usuario_orfaos from public.cupons_usuario where cupom_id = any(v_ids_extras);
  if v_usuario_orfaos <> 0 then
    raise exception 'TX-P2D1: pós-delete, % linha(s) de cupons_usuario ainda apontam para os 20 extras — o ON DELETE CASCADE não funcionou como esperado. Abortando.', v_usuario_orfaos;
  end if;

  select count(*) into v_pontos_orfaos
    from public.pontos_transacoes
   where referencia_id = any(v_ids_cupons_usuario_text);
  if v_pontos_orfaos <> 0 then
    raise exception 'TX-P2D1: pós-delete, % linha(s) de pontos_transacoes ainda referenciam os cupons_usuario extras. Abortando.', v_pontos_orfaos;
  end if;

  select count(*) into v_cupons_restantes from public.cupons;
  if v_cupons_restantes <> 14 then
    raise exception 'TX-P2D1: pós-delete, public.cupons tem % linhas — esperado EXATAMENTE 14. Abortando.', v_cupons_restantes;
  end if;

  select array_agg(id order by id) into v_ids_restantes from public.cupons;
  if v_ids_restantes is distinct from (select array_agg(x order by x) from unnest(v_ids_canonicos) x) then
    raise exception 'TX-P2D1: pós-delete, os cupons restantes NÃO são exatamente os 14 canônicos do depara-v1.json. Restantes: %. Abortando.', v_ids_restantes;
  end if;

  select count(*) into v_eventos_total_depois from public.cupom_eventos;
  if v_eventos_total_antes = 20586 and v_eventos_total_depois <> 20508 then
    raise exception 'TX-P2D1: total geral de cupom_eventos era 20586 (igual à auditoria) mas pós-delete ficou em % — esperado EXATAMENTE 20508. Abortando.', v_eventos_total_depois;
  elsif v_eventos_total_depois <> v_eventos_total_antes - 78 then
    raise exception 'TX-P2D1: total geral de cupom_eventos não caiu exatamente 78 linhas (antes=%, depois=%). Abortando.', v_eventos_total_antes, v_eventos_total_depois;
  end if;

  select count(*) into v_usuario_total_depois from public.cupons_usuario;
  if v_usuario_total_antes = 28 and v_usuario_total_depois <> 7 then
    raise exception 'TX-P2D1: total geral de cupons_usuario era 28 (igual à auditoria) mas pós-delete ficou em % — esperado EXATAMENTE 7. Abortando.', v_usuario_total_depois;
  elsif v_usuario_total_depois <> v_usuario_total_antes - 21 then
    raise exception 'TX-P2D1: total geral de cupons_usuario não caiu exatamente 21 linhas (antes=%, depois=%). Abortando.', v_usuario_total_antes, v_usuario_total_depois;
  end if;

  -- ------------------------------------------------------------
  -- K. Delta global do ledger de pontos — exigido em DELTA, não em
  -- valor absoluto (o total geral de pontos_transacoes varia por
  -- ambiente/atividade orgânica; o que não pode variar é a queda
  -- exata de -26 linhas / -1120 pontos causada por ESTA limpeza).
  -- ------------------------------------------------------------
  select count(*) into v_pontos_total_geral_depois from public.pontos_transacoes;
  select coalesce(sum(pontos), 0) into v_pontos_soma_geral_depois from public.pontos_transacoes;

  if v_pontos_total_geral_depois <> v_pontos_total_geral_antes - 26 then
    raise exception 'TX-P2D1: total geral de pontos_transacoes não caiu exatamente 26 linhas (antes=%, depois=%). Abortando.', v_pontos_total_geral_antes, v_pontos_total_geral_depois;
  end if;
  if v_pontos_soma_geral_depois <> v_pontos_soma_geral_antes - 1120 then
    raise exception 'TX-P2D1: soma geral de pontos_transacoes não caiu exatamente 1120 (antes=%, depois=%). Abortando.', v_pontos_soma_geral_antes, v_pontos_soma_geral_depois;
  end if;

  -- Nenhuma estrutura muda por esta migration — os cinco asserts abaixo
  -- só provam que este DATA cleanup não teve efeito colateral estrutural.
  if (select count(*) from public.segmentos) <> 14 then
    raise exception 'TX-P2D1: public.segmentos não tem 14 linhas pós-delete — isto é DATA cleanup, não deveria tocar taxonomia. Abortando.';
  end if;
  if (select count(*) from public.categorias_novas) <> 75 then
    raise exception 'TX-P2D1: public.categorias_novas não tem 75 linhas pós-delete. Abortando.';
  end if;
  if (select count(*) from public.categorias) <> 6 then
    raise exception 'TX-P2D1: public.categorias (legado) não tem 6 linhas pós-delete. Abortando.';
  end if;
  if (select count(*) from public.estabelecimentos) <> 6 then
    raise exception 'TX-P2D1: public.estabelecimentos não tem 6 linhas pós-delete — nenhuma conta/estabelecimento deveria ser tocado por esta migration. Abortando.';
  end if;
  if (select count(*) from public.estabelecimento_categorias) <> 7 then
    raise exception 'TX-P2D1: public.estabelecimento_categorias não tem 7 linhas pós-delete. Abortando.';
  end if;

  raise notice 'TX-P2D1: limpeza concluída. cupons=14 (canônicos), cupom_eventos=%, cupons_usuario=%, pontos_transacoes=% (-26/-1120 do ledger). Taxonomia (14/75/6), estabelecimentos (6) e estabelecimento_categorias (7) confirmados intactos.', v_eventos_total_depois, v_usuario_total_depois, v_pontos_total_geral_depois;
end $$;
