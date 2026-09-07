import { Ticket, Users } from "lucide-react";

import type { Cupom } from "@/lib/types";
import { textoDisponibilidade, textoResgates } from "@/lib/cupom-indicadores";
import { cn } from "@/lib/utils";

/**
 * Capacidade restante + prova social (só validações).
 * Ilimitado não mostra disponibilidade. Zero resgates some.
 */
export function CupomSinais({
  cupom,
  compact = false,
  className,
}: {
  cupom: Cupom;
  compact?: boolean;
  className?: string;
}) {
  const disp = textoDisponibilidade(cupom.limiteTotal, cupom.restantes);
  const resgates = textoResgates(cupom.resgatesConfirmados);
  if (!disp && !resgates) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground",
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      {disp && (
        <span className="inline-flex items-center gap-1">
          <Ticket className="h-3 w-3 shrink-0" aria-hidden />
          {disp}
        </span>
      )}
      {resgates && (
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          {resgates}
        </span>
      )}
    </div>
  );
}
