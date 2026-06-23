"use client";

import * as React from "react";
import { TicketPercent } from "lucide-react";

import { cn } from "@/lib/utils";

const banners = [
  { titulo: "Ofertas da semana", sub: "Até 50% OFF perto de você", grad: "linear-gradient(135deg, #1414DC 0%, #3A3AE6 60%, #6A6AF0 100%)" },
  { titulo: "Indique e ganhe", sub: "Cupons extras a cada amigo", grad: "linear-gradient(135deg, #0F0FA8 0%, #1414DC 100%)" },
  { titulo: "Plano VIP", sub: "Experiências exclusivas pra você", grad: "linear-gradient(135deg, #FAC81E 0%, #F5A623 100%)" },
];

export function BannerCarousel() {
  const [index, setIndex] = React.useState(0);
  const active = banners[index];
  const isYellow = index === 2;

  return (
    <div className="px-4">
      <div
        className="relative flex h-40 flex-col justify-end overflow-hidden rounded-card p-5 shadow-card"
        style={{ background: active.grad }}
      >
        <div className="bg-dots absolute inset-0 opacity-20" />
        <TicketPercent
          className={cn(
            "absolute -right-3 -top-3 h-28 w-28",
            isYellow ? "text-white/30" : "text-white/15",
          )}
        />
        <h3
          className={cn(
            "relative text-xl font-extrabold",
            isYellow ? "text-[#1A1A2E]" : "text-white",
          )}
        >
          {active.titulo}
        </h3>
        <p
          className={cn(
            "relative text-sm",
            isYellow ? "text-[#1A1A2E]/80" : "text-white/85",
          )}
        >
          {active.sub}
        </p>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        {banners.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Banner ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index ? "w-6 bg-primary" : "w-2 bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
