import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

export function MetricCard({
  label,
  value,
  delta,
  icon,
  className,
}: {
  label: string;
  value: string;
  /** percentage change vs previous period */
  delta?: number;
  /** lucide icon name */
  icon?: string;
  className?: string;
}) {
  const positive = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>

      <p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p>

      {typeof delta === "number" && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
            positive ? "text-success" : "text-danger",
          )}
        >
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {positive ? "+" : ""}
          {delta.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
          <span className="font-normal text-muted-foreground">vs. mês anterior</span>
        </p>
      )}
    </div>
  );
}
