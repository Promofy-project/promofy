import type { FunilEtapa } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

export function FunnelChart({
  etapas,
  className,
}: {
  etapas: FunilEtapa[];
  className?: string;
}) {
  const base = etapas[0]?.valor || 1;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {etapas.map((e, i) => {
        const pct = Math.round((e.valor / base) * 100);
        return (
          <div key={e.etapa}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{e.etapa}</span>
              <span className="font-semibold tabular-nums">
                {formatNumber(e.valor)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {pct}%
                </span>
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  background: e.cor,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
