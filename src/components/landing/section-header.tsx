import type * as React from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tone = "default" | "onYellow" | "onPrimary";

/**
 * Cabeçalho de seção padrão: eyebrow (badge) → título → subtítulo, centralizado,
 * com margem inferior consistente. `tone` ajusta as cores conforme o fundo.
 */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  tone = "default",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto mb-12 max-w-2xl text-center", className)}>
      {eyebrow && (
        <Badge
          variant={tone === "onPrimary" ? "yellow" : "default"}
          className="text-xs font-semibold uppercase tracking-[0.12em]"
        >
          {eyebrow}
        </Badge>
      )}
      <h2
        className={cn(
          "text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl",
          eyebrow && "mt-4",
          tone === "onPrimary" ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg",
            tone === "onPrimary"
              ? "text-white/80"
              : tone === "onYellow"
                ? "text-foreground/70"
                : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
