"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { useCouponState } from "@/components/coupon-state-provider";

/** Tempo de vida do pop — casa com a duração do keyframe `pontos-pop`. */
const DURACAO_MS = 1700;

/**
 * Comemoração "+N pontos".
 *
 * Puramente visual e disparada pela RESPOSTA DO SERVIDOR: os pontos vêm
 * de `estados[].pontos_resgate` (validação detectada no polling) ou de
 * `responder_nps.pontos` — nunca de um número fixo no cliente. Valor
 * zero não chega aqui (o provider não dispara).
 *
 * Montado uma vez no PhoneFrame, acima do NPS (z-50), e não intercepta
 * toque. Movimento reduzido: `motion-reduce:animate-none` deixa o chip
 * estático — ele aparece e some pelo timer, sem animar.
 *
 * Só-web (keyframe CSS + overlay no DOM): no app nativo isto vira um
 * Animated/Reanimated. O que migra é o gatilho, não este arquivo.
 */
export function PontosPop() {
  const { pontosPop, encerrarPontosPop } = useCouponState();

  React.useEffect(() => {
    if (!pontosPop) return;
    const t = window.setTimeout(encerrarPontosPop, DURACAO_MS);
    return () => window.clearTimeout(t);
  }, [pontosPop, encerrarPontosPop]);

  if (!pontosPop) return null;

  return (
    <div
      // Ancorado no ALTO, não no centro: o pop convive com o NPS e com o
      // sheet do cupom, e no centro ele cobria justamente a frase que diz
      // quantos pontos foram ganhos.
      className="pointer-events-none absolute inset-0 z-[60] flex items-start justify-center pt-20"
      aria-live="polite"
    >
      {/* key={seq} remonta e reinicia a animação quando dois ganhos
          acontecem em sequência (resgate e, logo depois, NPS) */}
      <div
        key={pontosPop.seq}
        className="animate-pontos-pop flex items-center gap-2 rounded-full bg-yellow px-6 py-3 text-3xl font-extrabold text-[#8a6d0b] shadow-xl ring-4 ring-white/70 motion-reduce:animate-none"
      >
        <Sparkles className="h-7 w-7" aria-hidden />
        <span>+{pontosPop.valor}</span>
      </div>
      <span className="sr-only">
        Você ganhou {pontosPop.valor} pontos.
      </span>
    </div>
  );
}
