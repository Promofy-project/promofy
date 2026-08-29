"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { useCouponState } from "@/components/coupon-state-provider";
import { cn } from "@/lib/utils";

/**
 * A pesquisa que o balcão deixou em aberto (Fase 9/Z1).
 *
 * POR QUE UM CARD E NÃO O `NpsDialog`. O modal existente é a reação a um
 * evento que o usuário acabou de viver — ele estava com a folha do cupom
 * aberta quando o lojista validou. Aqui é o oposto: a validação aconteceu no
 * balcão, possivelmente ontem, e o app está abrindo agora. Um modal tomando a
 * tela nessa hora é perseguição, e o pedido era explícito — oferecer sem
 * insistir. Card discreto, no fluxo da home.
 *
 * Também é o motivo de não reusar o `NpsDialog` por dentro: mexer nele
 * arriscaria o caminho do flip ao vivo, que funciona e não é o problema.
 *
 * UMA POR VEZ, mais recente primeiro — a RPC já entrega ordenada, e o provider
 * expõe só a cabeça da fila.
 *
 * ---------------------------------------------------------------------------
 * ADENDO 05/08 — TRÊS SAÍDAS, E O "X" SAIU
 *
 * O cliente refinou o Z1: o card passa a ter três saídas explícitas.
 *
 *   Responder             ação primária, a única com peso visual
 *   Responder mais tarde  discreta — some desta sessão, volta na próxima
 *   Não responder         discreta — encerra DE VEZ, sem pontos
 *
 * O "X" do canto foi embora e isso é a decisão de desenho central aqui. Com
 * duas saídas de significado MUITO diferente ("volta amanhã" e "nunca mais"),
 * um ícone ambíguo no canto seria a pior forma de escolher entre elas: o dedo
 * cai ali por reflexo. As duas saídas passam a ter nome, e o nome é o mesmo
 * que a pessoa leu antes de tocar.
 *
 * "Não responder" PEDE CONFIRMAÇÃO INLINE, não modal. É irreversível — o
 * banco grava `nps_recusado_em` e a linha nunca mais é oferecida —, e o custo
 * de um toque errado é uma avaliação perdida para sempre mais os pontos que
 * vinham com ela. A confirmação diz as duas coisas, e cabe em duas linhas no
 * próprio card: um modal para encerrar uma pesquisa que a pessoa está tentando
 * dispensar seria justamente a perseguição que o card existe para evitar.
 */
export function NpsPendenteCard() {
  const {
    npsPendente,
    responderNpsPendente,
    dispensarNpsPendente,
    recusarNpsPendente,
    celebrarPontos,
    config,
  } = useCouponState();

  const [nota, setNota] = React.useState<number | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [confirmandoRecusa, setConfirmandoRecusa] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Troca de oferta (respondeu/dispensou/recusou) → zera o estado da anterior,
  // inclusive a confirmação em aberto: confirmar a recusa de OUTRA pesquisa,
  // porque a fila andou embaixo do dedo, seria o erro mais caro possível aqui.
  const rowId = npsPendente?.row_id ?? null;
  React.useEffect(() => {
    setNota(null);
    setErro(null);
    setConfirmandoRecusa(false);
  }, [rowId]);

  if (!npsPendente) return null;

  const pontos = config.nps ?? 0;

  const enviar = async () => {
    if (nota === null || enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await responderNpsPendente(npsPendente.row_id, nota);
    setEnviando(false);
    if (!r.ok) {
      setErro("Não foi possível enviar agora. Tente de novo.");
      return;
    }
    // Valor REAL do servidor — 0 (já respondida) não anima.
    celebrarPontos(r.pontos);
  };

  const recusar = async () => {
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await recusarNpsPendente(npsPendente.row_id);
    setEnviando(false);
    // Sem `celebrarPontos` em ramo nenhum: recusar não credita nada.
    if (!r.ok) {
      setErro("Não foi possível encerrar agora. Tente de novo.");
      setConfirmandoRecusa(false);
    }
  };

  return (
    <section className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Star className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">
            Como foi no {npsPendente.titulo}?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            De 0 a 10, o quanto você indicaria.
            {pontos > 0 && (
              <span className="font-semibold text-primary"> +{pontos} pontos</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }).map((_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            aria-pressed={nota === n}
            disabled={enviando}
            className={cn(
              "h-8 w-8 rounded-lg border text-xs font-bold tabular-nums transition-colors disabled:opacity-50",
              nota === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground hover:bg-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {erro && <p className="mt-2 text-xs font-semibold text-danger">{erro}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={nota === null || enviando}
        className="mt-3 h-10 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {enviando && !confirmandoRecusa ? "Enviando…" : "Responder"}
      </button>

      {confirmandoRecusa ? (
        // Confirmação da saída irreversível. Fica no lugar das duas saídas
        // discretas — não empilha por cima delas — para que não exista, em
        // instante nenhum, "Não responder" duas vezes na mesma tela.
        <div className="mt-3 rounded-xl border border-border bg-muted/50 p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Esta avaliação não volta a aparecer
            {pontos > 0 && <>, e os {pontos} pontos não são creditados</>}.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={recusar}
              disabled={enviando}
              className="h-9 flex-1 rounded-lg border border-danger/30 bg-surface text-xs font-bold text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
            >
              {enviando ? "Encerrando…" : "Não responder"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoRecusa(false)}
              disabled={enviando}
              className="h-9 flex-1 rounded-lg border border-border bg-surface text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        // As duas saídas discretas dividem a linha em pesos iguais: nenhuma
        // das duas disputa com "Responder", e nenhuma se esconde da outra.
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={dispensarNpsPendente}
            disabled={enviando}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Responder mais tarde
          </button>
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setConfirmandoRecusa(true);
            }}
            disabled={enviando}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            Não responder
          </button>
        </div>
      )}
    </section>
  );
}
