import type { SerieMensal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BarChart({
  data,
  format,
  className,
}: {
  data: SerieMensal[];
  format?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.valor), 1);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Bar track — fixed height so percentage heights resolve */}
      <div className="flex h-40 items-end gap-2">
        {data.map((d) => {
          const h = Math.max((d.valor / max) * 100, 4);
          return (
            <div
              key={d.mes}
              className="group relative flex flex-1 items-end justify-center self-stretch"
            >
              <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-foreground group-hover:block">
                {format ? format(d.valor) : d.valor}
              </span>
              <div
                className="w-full rounded-t-md bg-primary/85 transition-colors group-hover:bg-primary"
                style={{ height: `${h}%` }}
                title={format ? format(d.valor) : String(d.valor)}
              />
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-2">
        {data.map((d) => (
          <span
            key={d.mes}
            className="flex-1 text-center text-xs text-muted-foreground"
          >
            {d.mes}
          </span>
        ))}
      </div>
    </div>
  );
}
