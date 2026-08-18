/**
 * Janela de consumo do cupom (dias da semana + faixa de horário).
 *
 * ESPELHO PURO da função SQL `public.dentro_da_janela(jsonb)`
 * (migration 20260730120000_fase5_janela_pontos_usos.sql). A barreira
 * REAL é o servidor: `ativar_cupom` recusa com motivo 'fora_da_janela'.
 * Este módulo existe só para a UI poder esmaecer o botão antes do
 * toque — se os dois divergirem, quem manda é o banco.
 *
 * Módulo puro: sem "server-only", sem DOM, sem localStorage. Roda em
 * server component, em client component e no `tsx` da suíte — e é
 * reaproveitável como está no app React Native.
 *
 * As regras de saneamento abaixo são as MESMAS do SQL, de propósito:
 * dado malformado é "sem restrição", nunca "fora da janela". O form do
 * portal consegue gravar `{"inicio":"","fim":""}` (os `<input type=
 * "time">` não são required), e tratar isso como "fora" transformaria
 * um cupom aprovado num tijolo que nunca ativa.
 */

// Import relativo de propósito (e não "@/lib/dias"): esta camada pura é
// importada direto pelo `tsx` da suíte e será copiada tal e qual para o
// app nativo — não deve depender do alias de path do tsconfig do Next.
import { diaSemanaBrt } from "./dias";

export interface JanelaConsumo {
  /** Labels canônicos de DIAS_SEMANA; ausente/vazio = todos os dias. */
  dias?: string[];
  /** "HH:MM"; ausente/vazio/inválido = sem restrição de horário. */
  inicio?: string;
  fim?: string;
}

/** Aceita "8:00" e "08:00" — o mesmo que `'8:00'::time` no Postgres. */
const HORA_VALIDA = /^([0-9]{1,2}):([0-9]{2})$/;

/**
 * "HH:MM" → minutos desde a meia-noite, ou null se não for hora.
 *
 * Compara-se por NÚMERO, nunca por string: "8:00" > "10:00" na ordem
 * lexicográfica, mas 08:00 < 10:00 no relógio. O SQL castava para
 * `time` e não tinha esse problema; aqui precisa ser explícito.
 */
function emMinutos(valor: string | undefined | null): number | null {
  if (typeof valor !== "string") return null;
  const m = HORA_VALIDA.exec(valor.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Minuto atual no fuso America/Sao_Paulo, truncado (segundos fora).
 *
 * `hourCycle: "h23"` é obrigatório: com `hour12: false` algumas versões
 * do ICU devolvem "24" à meia-noite, o que jogaria o cupom para fora da
 * janela exatamente na virada do dia.
 */
function minutoAgoraBrt(agora: Date): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(agora);
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const min = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
  return (h % 24) * 60 + min;
}

/**
 * O cupom pode ser consumido no instante `agora` (default: agora)?
 *
 * Calcular SEMPRE no servidor e passar por prop — o "agora" do client
 * na Vercel (UTC) diverge do Brasil à noite e quebraria a hidratação.
 */
export function dentroDaJanela(
  janela: JanelaConsumo | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (!janela || typeof janela !== "object") return true;

  // ---------- DIA DA SEMANA ----------
  // Só restringe quando `dias` é array NÃO vazio (escalar/objeto/[] =
  // sem restrição, igual ao `jsonb_typeof(...) = 'array'` do SQL).
  const dias = janela.dias;
  if (Array.isArray(dias) && dias.length > 0) {
    const hoje = diaSemanaBrt(agora);
    const casa = dias.some(
      (d) => d === hoje || (hoje === "Sáb" && d === "Sab"), // tolera sem acento
    );
    if (!casa) return false;
  }

  // ---------- HORÁRIO ----------
  const inicio = emMinutos(janela.inicio);
  const fim = emMinutos(janela.fim);
  if (inicio === null || fim === null) return true; // vazio/lixo = sem restrição

  const agoraMin = minutoAgoraBrt(agora);

  if (inicio <= fim) return agoraMin >= inicio && agoraMin <= fim;
  // janela que cruza a meia-noite (ex.: 22:00–02:00)
  return agoraMin >= inicio || agoraMin <= fim;
}

/**
 * A janela está aberta AGORA, ou abre antes de o prazo de ativação acabar?
 *
 * ESPELHO de `public.janela_alcance(jsonb, int)` (migration 29) — só a
 * metade `alcancavel`. O `teto` (que limita `expira_em`) fica de fora de
 * propósito: quem grava a linha é o servidor, e replicar o cálculo aqui
 * criaria uma segunda fonte de verdade para um número que a UI não usa.
 *
 * POR QUE ESTA FUNÇÃO EXISTE (relatório de QA v2 §3.1): `dentroDaJanela`
 * responde "posso consumir agora?", que é a pergunta da EXIBIÇÃO. A
 * ativação faz outra: "o prazo que nasce agora alcança a janela?". Um
 * cupom "18:00–22:00" às 17:48 com prazo de 5h vale até 22:48 e cobre a
 * janela inteira — recusar só obrigava o consumidor a voltar ao app, e
 * quem esquecia perdia o cupom.
 *
 * Deslocar a data por múltiplos de 24h é seguro no Brasil, que não tem
 * horário de verão desde 2019 — se voltar a ter, esta conta e a do SQL
 * precisam ser revistas juntas.
 */
export function janelaAlcancavel(
  janela: JanelaConsumo | null | undefined,
  prazoHoras: number = 5,
  agora: Date = new Date(),
): boolean {
  if (!janela || typeof janela !== "object") return true;

  const inicio = emMinutos(janela.inicio);
  const fim = emMinutos(janela.fim);
  // Sem horário utilizável, o que resta é a restrição de DIA, e essa é
  // sobre hoje. Delega, para não existirem duas leituras da mesma regra.
  if (inicio === null || fim === null) return dentroDaJanela(janela, agora);

  const dias = janela.dias;
  const temDias = Array.isArray(dias) && dias.length > 0;
  const agoraMin = minutoAgoraBrt(agora);
  const limite = agoraMin + Math.max(0, prazoHoras) * 60;

  // -1 ontem (janela que cruza a meia-noite e ainda está aberta),
  //  0 hoje (o caso do relatório), +1 amanhã (prazo longo na virada).
  for (let i = -1; i <= 1; i++) {
    if (temDias) {
      const dia = diaSemanaBrt(new Date(agora.getTime() + i * 86_400_000));
      const casa = dias!.some((d) => d === dia || (dia === "Sáb" && d === "Sab"));
      if (!casa) continue;
    }

    const base = i * 1440;
    const iniAbs = base + inicio;
    const fimAbs = base + fim + (fim <= inicio ? 1440 : 0);

    if (agoraMin >= iniAbs && agoraMin <= fimAbs) return true;   // aberta agora
    if (iniAbs > agoraMin && iniAbs <= limite) return true;      // abre a tempo
  }

  return false;
}
