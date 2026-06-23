"use client";

import * as React from "react";
import { ArrowDownUp } from "lucide-react";

import { cn } from "@/lib/utils";

const chips = ["alimentação", "lazer", "compras", "serviços", "saúde", "beleza"];

export function HomeCategoryChips() {
  const [active, setActive] = React.useState<string | null>(null);

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {chips.map((c) => {
        const selected = active === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => setActive(selected ? null : c)}
            aria-pressed={selected}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold capitalize transition-colors",
              selected
                ? "bg-[#E6A700] text-white"
                : "bg-yellow text-yellow-foreground hover:brightness-95",
            )}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {c}
          </button>
        );
      })}
    </div>
  );
}
