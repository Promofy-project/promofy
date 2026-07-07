"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/** Item do FAQ: string simples (resposta genérica) ou par pergunta/resposta. */
export type FaqItem = string | { q: string; a?: string };

const RESPOSTA_PADRAO =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Non odio natus ut voluptatibus quae id odit — texto provisório a ser substituído pelo conteúdo final.";

/** Accordion leve (sem dependência externa) — compartilhado pelas landings. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [aberta, setAberta] = React.useState<number | null>(null);

  const normalizados = items.map((it) =>
    typeof it === "string" ? { q: it, a: RESPOSTA_PADRAO } : { q: it.q, a: it.a ?? RESPOSTA_PADRAO },
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {normalizados.map(({ q, a }, i) => {
        const open = aberta === i;
        return (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface shadow-[0_1px_2px_rgba(20,20,60,0.04),0_10px_30px_-12px_rgba(20,20,60,0.15)] transition-colors",
              open ? "border-primary" : "border-border/60",
            )}
          >
            <button
              type="button"
              onClick={() => setAberta(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="text-base font-semibold text-foreground">
                {q}
              </span>
              {open ? (
                <Minus className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <Plus className="h-5 w-5 shrink-0 text-primary" />
              )}
            </button>
            {open && (
              <p className="px-6 pb-5 text-[15px] leading-relaxed text-foreground/70">
                {a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
