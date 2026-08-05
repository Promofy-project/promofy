"use client";

import * as React from "react";
import { Star, X } from "lucide-react";

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
 * insistir. Card discreto, no fluxo da home, dispensável num toque.
 *
 * Também é o motivo de não reusar o `NpsDialog` por dentro: mexer nele
 * arriscaria o caminho do flip ao vivo, que funciona e não é o problema.
 *
 * UMA POR VEZ, mais recente primeiro — a RPC já entrega ordenada, e o provider
 * expõe só a cabeça da fila. Dispensar tira desta sessão; não grava nada, então
 * a próxima abertura oferece de novo. É deliberado: o estabelecimento precisa
 * da nota, e o usuário não é obrigado a dar hoje.
 */
export function NpsPendenteCard() {
  const {
    npsPendente,
    responderNpsPendente,
    dispensarNpsPendente,
    celebrarPontos,
    config,
  } = useCouponState();

  const [nota, setNota] = React.useState<number | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Troca de oferta (respondeu/dispensou) → limpa a seleção da anterior.
  const rowId = npsPendente?.row_id ?? null;
  React.useEffect(() => {
    setNota(null);
    setErro(null);
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
        <button
          type="button"
          onClick={dispensarNpsPendente}
          aria-label="Agora não"
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
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
        className="mt-3 h-10 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar avaliação"}
      </button>
    </section>
  );
}
