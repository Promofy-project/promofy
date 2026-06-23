import { Check, Lock } from "lucide-react";

import type { Plano } from "@/lib/types";
import { cn, formatBRLValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PlanCard({
  plano,
  actionTone = "brand",
  className,
}: {
  plano: Plano;
  /** cor do botão de ação: brand (landing, azul/outline) | yellow (app /m) */
  actionTone?: "brand" | "yellow";
  className?: string;
}) {
  const { destaque, bloqueado } = plano;
  const yellow = actionTone === "yellow";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-card border bg-card p-6 shadow-card transition",
        destaque ? "border-primary ring-2 ring-primary" : "border-border",
        bloqueado && "opacity-95",
        className,
      )}
    >
      {plano.badge && (
        <Badge
          variant={destaque ? "default" : "muted"}
          className="absolute -top-3 left-6 shadow-sm"
        >
          {plano.badge}
        </Badge>
      )}

      <h3 className="text-lg font-extrabold">{plano.nome}</h3>
      {plano.descricao && (
        <p className="mt-1 text-sm text-muted-foreground">{plano.descricao}</p>
      )}

      <div className="mt-4 flex items-end gap-1">
        {bloqueado ? (
          <span className="text-2xl font-extrabold text-muted-foreground">
            Em breve
          </span>
        ) : (
          <>
            <span className="text-sm font-semibold text-muted-foreground">
              R$
            </span>
            <span className="text-4xl font-extrabold leading-none tracking-tight">
              {formatBRLValue(plano.preco)}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">
              {plano.periodo}
            </span>
          </>
        )}
      </div>

      <ul className="mt-5 flex flex-1 flex-col gap-3">
        {plano.beneficios.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow-soft">
              <Check className="h-3.5 w-3.5 text-[#8a6d0b]" strokeWidth={3} />
            </span>
            <span className="text-foreground">{b}</span>
          </li>
        ))}
      </ul>

      {bloqueado ? (
        <Button
          className={cn(
            "mt-6 w-full",
            yellow && "bg-muted text-muted-foreground hover:bg-muted",
          )}
          variant={yellow ? "ghost" : destaque ? "default" : "outline"}
          disabled
        >
          <Lock className="h-4 w-4" /> {yellow ? "Plano bloqueado" : "Em breve"}
        </Button>
      ) : (
        <Button
          className="mt-6 w-full"
          variant={yellow ? "secondary" : destaque ? "default" : "outline"}
        >
          Assinar plano
        </Button>
      )}

      {plano.legenda && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {plano.legenda}
        </p>
      )}
    </div>
  );
}
