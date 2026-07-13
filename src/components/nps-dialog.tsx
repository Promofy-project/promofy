"use client";

import * as React from "react";
import { Gift, PartyPopper, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCouponState } from "@/components/coupon-state-provider";

// Confete decorativo (mesmo padrão do modal de código promocional dos planos)
const CONFETTI = [
  { left: "10%", top: "12%", color: "#1414DC", rotate: -18 },
  { left: "24%", top: "4%", color: "#FAC81E", rotate: 24 },
  { left: "40%", top: "16%", color: "#16A34A", rotate: -8 },
  { left: "56%", top: "6%", color: "#F5A623", rotate: 30 },
  { left: "72%", top: "14%", color: "#DC2626", rotate: -22 },
  { left: "86%", top: "8%", color: "#1414DC", rotate: 12 },
  { left: "16%", top: "30%", color: "#FAC81E", rotate: 16 },
  { left: "82%", top: "32%", color: "#16A34A", rotate: -14 },
];

/**
 * NPS pós-validação (overlay no nível do aparelho, padrão do TutorialDialog).
 * Escala 0–10 com incentivo de pontos; ao enviar mostra um micro-sucesso com
 * confete. Enviar ou pular fecham o fluxo e voltam ao detalhe (cupom 'validado').
 */
export function NpsDialog() {
  const { npsId, responderNps, fecharNps } = useCouponState();
  const [nota, setNota] = React.useState<number | null>(null);
  const [enviado, setEnviado] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNota(null);
    setEnviado(false);
    setEnviando(false);
    setErro(null);
  }, [npsId]);

  if (!npsId) return null;

  const enviar = async () => {
    if (nota === null) return;
    setErro(null);
    setEnviando(true);
    const r = await responderNps(npsId, nota);
    setEnviando(false);
    if (r.ok) {
      setEnviado(true);
    } else {
      setErro("Não foi possível enviar sua avaliação agora. Tente novamente.");
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
        onClick={fecharNps}
      />

      {!enviado ? (
        <div className="animate-fade-up relative w-full max-w-[340px] rounded-[24px] bg-surface p-6 shadow-2xl">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Star className="h-6 w-6" />
          </div>
          <h2 className="text-center text-lg font-extrabold">
            Como foi sua experiência?
          </h2>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            De 0 a 10, o quanto você indicaria este cupom?
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: 11 }).map((_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNota(n)}
                aria-pressed={nota === n}
                className={cn(
                  "h-9 w-9 rounded-lg border text-sm font-bold transition-colors",
                  nota === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground hover:bg-muted",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between px-1 text-[11px] text-muted-foreground">
            <span>Pouco provável</span>
            <span>Muito provável</span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-yellow-soft px-3 py-2 text-sm font-semibold text-[#8a6d0b]">
            <Gift className="h-4 w-4" />
            Responda e ganhe pontos!
          </div>

          {erro && (
            <p className="mt-3 text-center text-sm font-medium text-danger">
              {erro}
            </p>
          )}

          <Button
            className="mt-4 w-full"
            disabled={nota === null || enviando}
            onClick={enviar}
          >
            {enviando ? "Enviando…" : "Enviar avaliação"}
          </Button>
          <button
            type="button"
            onClick={fecharNps}
            className="mt-2 w-full py-1 text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Pular
          </button>
        </div>
      ) : (
        <div className="animate-fade-up relative w-full max-w-[340px] overflow-hidden rounded-[24px] bg-surface p-7 text-center shadow-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-28"
          >
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className="absolute h-2.5 w-1.5 rounded-[1px]"
                style={{
                  left: c.left,
                  top: c.top,
                  background: c.color,
                  transform: `rotate(${c.rotate}deg)`,
                }}
              />
            ))}
          </div>
          <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-success-soft">
            <PartyPopper className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-extrabold">Obrigado pela avaliação!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Você ganhou pontos por compartilhar sua experiência.
          </p>
          <Button className="mt-6 w-full" onClick={fecharNps}>
            Concluir
          </Button>
        </div>
      )}
    </div>
  );
}
