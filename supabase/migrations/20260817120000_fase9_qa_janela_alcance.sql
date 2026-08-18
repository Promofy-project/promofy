-- ============================================================
-- Promofy — Fase 9 · Migration 29: alcance da janela de consumo (QA v2 §3.1)
--
-- ADITIVA PURA: cria duas funções novas e não toca em NADA existente.
-- `ativar_cupom` só passa a usá-las na migration 30. A separação é
-- deliberada — recriar a RPC do ciclo do cupom é o único ponto de risco
-- da entrega, e ele não precisa dividir arquivo com código novo.
--
-- O PROBLEMA (relatório de QA v2 §3.1, e é real):
--
--   Cupom "Sex, 18:00–22:00". O consumidor abre às 17:48 e leva
--   `fora_da_janela`. Só que o prazo de ativação é de 5h: ativando às
--   17:48, o código valeria até 22:48 e cobriria a janela INTEIRA. A
--   recusa não protege ninguém — só obriga o consumidor a voltar ao app
--   no horário, e quem esquece perde o cupom que já tinha escolhido.
--
--   A Fase 5 acertou o essencial (a janela é barreira de servidor), mas
--   respondeu à pergunta errada: `dentro_da_janela` pergunta "posso
--   consumir AGORA?", quando a ativação precisa perguntar "o prazo que
--   nasce agora ALCANÇA a janela?".
--
-- POR QUE UMA FUNÇÃO QUE DEVOLVE OS DOIS VALORES, e não duas funções:
--
--   Aceitar a ativação antecipada obriga a limitar `expira_em`. Sem
--   isso, o mesmo cupom "18:00–22:00" ativado às 17:48 geraria um código
--   válido até 22:48 — validável no balcão às 22:30, FORA da janela que
--   o lojista definiu. A regra "aceita mais cedo" e a regra "mas não
--   vale mais tarde" são a MESMA decisão sobre a MESMA ocorrência da
--   janela; separá-las em duas funções seria pedir que duas varreduras
--   independentes concordassem sempre sobre qual ocorrência foi
--   escolhida. É o argumento que a migration 17 usa para `pode_reusar`:
--   uma regra, uma expressão.
--
-- HERDA A DOUTRINA DA 15, sem exceção: dado malformado é SEM RESTRIÇÃO,
-- nunca "fora da janela" e NUNCA exceção. Um ''::time aqui dentro
-- abortaria a transação de `ativar_cupom` (security definer, sem bloco
-- exception) e deixaria o cupom permanentemente inativável.
-- ============================================================

-- ------------------------------------------------------------
-- HELPER: esta data cai num dos dias declarados?
--
-- Extraído porque o alcance precisa perguntar isso de ONTEM, HOJE e
-- AMANHÃ — a 15 só precisava de hoje e resolvia inline. A tolerância ao
-- label sem acento ('Sab') vem de lá e é mantida: o dado já está gravado
-- das duas formas em produção.
-- ------------------------------------------------------------
create or replace function public.dia_na_lista(p_dias jsonb, p_data date)
returns boolean
language sql immutable set search_path = ''
as $$
  select exists (
    select 1
      from jsonb_array_elements_text(p_dias) as d
     where d = (array['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'])[
                 extract(isodow from p_data)::int]
        or (d = 'Sab'
            and (array['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'])[
                  extract(isodow from p_data)::int] = 'Sáb')
  );
$$;

comment on function public.dia_na_lista(jsonb, date) is
  'Fase 9/QA: a data cai num dos dias declarados em horarios.dias? Tolera "Sab" sem acento (dado legado).';

-- ------------------------------------------------------------
-- ALCANCE DA JANELA — a decisão de admissão e o teto, juntos.
--
-- Devolve { alcancavel: bool, teto: timestamptz|null }.
--   * `alcancavel` — a janela está aberta AGORA, ou abre antes de o
--     prazo acabar;
--   * `teto` — o fim da ocorrência alcançada. null = sem restrição de
--     horário, e aí `expira_em` fica só com o prazo.
--
-- TRÊS OCORRÊNCIAS CANDIDATAS (-1, 0, +1 dia), e cada uma tem motivo:
--   ONTEM   janela que cruza a meia-noite (22:00–02:00) e ainda está
--           aberta agora — sem esta, ativar 00:30 seria recusado;
--   HOJE    o caso do relatório (17:48 para as 18:00);
--   AMANHÃ  prazo longo na virada: 23:00 com prazo de 12h alcança a
--           janela das 10:00 de amanhã.
--
-- `stable`: lê now(), não escreve.
-- ------------------------------------------------------------
create or replace function public.janela_alcance(p_horarios jsonb, p_prazo_horas int)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_agora    timestamp := (now() at time zone 'America/Sao_Paulo');
  v_minuto   timestamp;
  v_limite   timestamp;
  v_dias     jsonb;
  v_tem_dias boolean;
  v_inicio   text;
  v_fim      text;
  v_hi       time;
  v_hf       time;
  v_base     date;
  v_ini_ts   timestamp;
  v_fim_ts   timestamp;
  v_dia_todo boolean;
  v_i        int;
  v_j        int;
begin
  -- truncar ao minuto pelo mesmo motivo da 15: sem isso um cupom
  -- 00:00–23:59 (o padrão que o /e grava) ficaria fora das 23:59:01 em diante.
  v_minuto := date_trunc('minute', v_agora);
  v_limite := v_agora + make_interval(hours => coalesce(p_prazo_horas, 5));

  -- sem objeto de horários (null, array, escalar) → sem restrição
  if p_horarios is null or jsonb_typeof(p_horarios) <> 'object' then
    return jsonb_build_object('alcancavel', true, 'teto', null);
  end if;

  v_dias := p_horarios -> 'dias';
  v_tem_dias := jsonb_typeof(v_dias) = 'array' and jsonb_array_length(v_dias) > 0;

  -- NUNCA castar direto: string vazia ou lixo = sem restrição de hora.
  v_inicio := nullif(btrim(coalesce(p_horarios ->> 'inicio', '')), '');
  v_fim    := nullif(btrim(coalesce(p_horarios ->> 'fim', '')), '');

  -- Sem horário utilizável, o que resta é a restrição de DIA, e essa é
  -- sobre hoje — não há instante futuro a alcançar. Delega para a 15
  -- para não existirem duas leituras da mesma regra.
  if v_inicio is null or v_fim is null
     or v_inicio !~ '^[0-9]{1,2}:[0-9]{2}$'
     or v_fim    !~ '^[0-9]{1,2}:[0-9]{2}$' then
    return jsonb_build_object(
      'alcancavel', public.dentro_da_janela(p_horarios),
      'teto', null);
  end if;

  v_hi := v_inicio::time;
  v_hf := v_fim::time;

  -- "Dia inteiro" é 00:00–23:59, exatamente o que o formulário do /e grava
  -- quando o lojista não restringe horário. Importa para o teto: ver abaixo.
  v_dia_todo := (v_hi = time '00:00' and v_hf >= time '23:59');

  -- Sem restrição de dia E aberto o dia inteiro = sem restrição nenhuma.
  -- Sem este atalho, o teto cortaria em 23:59 e um cupom "sempre aberto"
  -- ativado às 22:50 perderia 4h das 5h de prazo — punição sem proteção,
  -- já que a janela reabre 1 minuto depois. Foi o que a suíte da Fase 2
  -- acusou ("expira_em ≈ agora + 5h — 1.13h") na primeira versão desta
  -- função, e é o caso da MAIORIA dos cupons em produção.
  if not v_tem_dias and v_dia_todo then
    return jsonb_build_object('alcancavel', true, 'teto', null);
  end if;

  for v_i in -1..1 loop
    v_base := (v_agora::date) + v_i;

    if (not v_tem_dias) or public.dia_na_lista(v_dias, v_base) then
      v_ini_ts := v_base + v_hi;
      v_fim_ts := v_base + v_hf;
      -- fim <= início declara janela que atravessa a meia-noite
      if v_hf <= v_hi then
        v_fim_ts := v_fim_ts + interval '1 day';
      end if;

      -- aberta agora, OU abre antes de o prazo acabar
      if (v_minuto >= v_ini_ts and v_minuto <= v_fim_ts)
         or (v_ini_ts > v_agora and v_ini_ts <= v_limite) then

        -- O teto é o fim da janela CONTÍGUA, não o da ocorrência isolada.
        -- Com 00:00–23:59 em dias seguidos (ex.: Seg a Sex), a janela de
        -- sexta encosta na de sábado: cortar na virada tiraria prazo sem
        -- impedir consumo nenhum. Para no primeiro dia não declarado —
        -- que é onde o consumo de fato deixa de ser permitido. O limite de
        -- 7 voltas fecha o ciclo da semana; além disso o prazo sempre
        -- vence no `least` de ativar_cupom.
        if v_dia_todo then
          v_j := 1;
          while v_j <= 7 and public.dia_na_lista(v_dias, v_base + v_j) loop
            v_fim_ts := v_fim_ts + interval '1 day';
            v_j := v_j + 1;
          end loop;
        end if;

        return jsonb_build_object(
          'alcancavel', true,
          'teto', (v_fim_ts at time zone 'America/Sao_Paulo'));
      end if;
    end if;
  end loop;

  return jsonb_build_object('alcancavel', false, 'teto', null);
end;
$$;

comment on function public.janela_alcance(jsonb, int) is
  'Fase 9/QA: a janela abre dentro do prazo de ativação? Devolve {alcancavel, teto} — o teto limita expira_em ao fim da janela alcançada.';

-- ------------------------------------------------------------
-- GRANTS — padrão da 15: nada para public/anon.
-- `dia_na_lista` é helper de leitura pura sobre argumentos; mesmo assim
-- não vai para anon, que não tem uso legítimo para ela.
-- ------------------------------------------------------------
revoke execute on function
  public.dia_na_lista(jsonb, date),
  public.janela_alcance(jsonb, int)
from public, anon;

grant execute on function
  public.dia_na_lista(jsonb, date),
  public.janela_alcance(jsonb, int)
to authenticated;
