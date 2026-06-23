import { MapPin, Ticket, RefreshCw } from "lucide-react";

import type { Estabelecimento } from "@/lib/types";
import { getCategoria } from "@/lib/mock-data";
import { cn, formatNumber } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/star-rating";

const statusMap: Record<
  Estabelecimento["status"],
  { label: string; variant: "success" | "yellow-soft" | "danger" }
> = {
  ativo: { label: "Ativo", variant: "success" },
  pendente: { label: "Pendente", variant: "yellow-soft" },
  suspenso: { label: "Suspenso", variant: "danger" },
};

export function BusinessCard({
  estabelecimento,
  className,
}: {
  estabelecimento: Estabelecimento;
  className?: string;
}) {
  const categoria = getCategoria(estabelecimento.categoria);
  const status = statusMap[estabelecimento.status];

  return (
    <div
      className={cn(
        "flex flex-col rounded-card border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
          style={{ background: categoria.gradiente }}
        >
          <Icon name={categoria.icon} className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-base font-bold">
              {estabelecimento.nome}
            </h3>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {estabelecimento.cidade}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="muted">{categoria.label}</Badge>
            <StarRating
              rating={estabelecimento.rating}
              count={estabelecimento.avaliacoes}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-bold leading-none">
              {estabelecimento.cuponsAtivos}
            </p>
            <p className="text-xs text-muted-foreground">cupons ativos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-bold leading-none">
              {formatNumber(estabelecimento.resgatesMes)}
            </p>
            <p className="text-xs text-muted-foreground">resgates/mês</p>
          </div>
        </div>
      </div>
    </div>
  );
}
