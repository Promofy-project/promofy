import type * as React from "react";

import { cuponsEmDestaque } from "@/lib/mock-data";
import { CouponCard } from "@/components/coupon-card";
import { WaveBackground } from "@/components/wave-background";

/**
 * Hero compartilhado das landings de consumidor (home e /para-voce).
 * O conteúdo (badge, título, texto, CTAs) é injetado por prop; a moldura
 * visual (ondas, gradiente, coluna lateral) é reaproveitada.
 */
export function LandingHero({
  badge,
  title,
  description,
  actions,
  note,
  aside,
}: {
  badge?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  actions: React.ReactNode;
  note?: React.ReactNode;
  /** coluna direita — default: pré-visualização de cupons flutuantes */
  aside?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-surface">
      {/* grafismo de ondas amarelas — sutil, sem competir com o texto */}
      <WaveBackground className="absolute inset-0 opacity-[0.18]" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/92 to-surface/55" />
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />

      <div className="container relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          {badge}
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            {description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
          {note && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              {note}
            </p>
          )}
        </div>

        <div className="relative mx-auto hidden w-full max-w-md lg:block">
          {aside ?? <HeroCouponsAside />}
        </div>
      </div>
    </section>
  );
}

function HeroCouponsAside() {
  return (
    <div className="relative space-y-4">
      <div className="rotate-[-3deg]">
        {cuponsEmDestaque[0] && <CouponCard cupom={cuponsEmDestaque[0]} />}
      </div>
      <div className="ml-12 rotate-[3deg]">
        {cuponsEmDestaque[2] && <CouponCard cupom={cuponsEmDestaque[2]} />}
      </div>
    </div>
  );
}
