"use client";

import * as React from "react";

import { categorias } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

const chips = [{ id: "todos", label: "Todos", icon: "" }, ...categorias];

export function CategoryChips() {
  const [active, setActive] = React.useState("todos");

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
      {chips.map((c) => {
        const selected = active === c.id;
        return (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            aria-pressed={selected}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {c.icon && <Icon name={c.icon} className="h-4 w-4" />}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
