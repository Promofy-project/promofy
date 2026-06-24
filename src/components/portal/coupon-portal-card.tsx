import { getCategoria } from "@/lib/mock-data";
import { cn, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { FunnelChart } from "@/components/funnel-chart";
import type { ItemCupomPortal } from "@/components/portal/cupons-seed";

const STATUS_BADGE = {
  ativo: { variant: "success" as const, label: "Ativo" },
  esgotado: { variant: "yellow-soft" as const, label: "Esgotado" },
  expirado: { variant: "danger" as const, label: "Expirado" },
};

export function CouponPortalCard({ item }: { item: ItemCupomPortal }) {
  const { cupom, statusPortal, metricas } = item;
  const categoria = getCategoria(cupom.categoria);
  const badge = STATUS_BADGE[statusPortal];
  const conversao = metricas.visualizacoes
    ? Math.round((metricas.resgates / metricas.visualizacoes) * 100)
    : 0;

  const etapas = [
    { etapa: "Visualizações", valor: metricas.visualizacoes, cor: "#1414DC" },
    { etapa: "Cliques", valor: metricas.cliques, cor: "#3A3AE6" },
    { etapa: "Ativações", valor: metricas.ativacoes, cor: "#7A7AEF" },
    { etapa: "Resgates", valor: metricas.resgates, cor: "#FAC81E" },
  ];

  return (
    <Card className={cn("p-5", statusPortal !== "ativo" && "opacity-90")}>
      <div className="flex items-start gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
          style={{ background: categoria.gradiente }}
        >
          <Icon name={categoria.icon} className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold leading-tight">
              {cupom.titulo}
            </h3>
            <Badge variant={badge.variant} className="shrink-0">
              {badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cupom.beneficio}
          </p>
        </div>
      </div>

      {/* 4 métricas pedidas pelo cliente */}
      <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-muted/50 p-3 text-center">
        {[
          { label: "Visualizações", valor: metricas.visualizacoes },
          { label: "Cliques", valor: metricas.cliques },
          { label: "Ativações", valor: metricas.ativacoes },
          { label: "Resgates", valor: metricas.resgates },
        ].map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="truncate text-[11px] font-medium text-muted-foreground">
              {m.label}
            </dt>
            <dd className="mt-0.5 text-base font-extrabold tabular-nums">
              {formatNumber(m.valor)}
            </dd>
          </div>
        ))}
      </dl>

      {/* Mini-funil de conversão */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">
            Funil de conversão
          </span>
          <span className="font-bold text-primary">{conversao}% resgatam</span>
        </div>
        <FunnelChart etapas={etapas} />
      </div>
    </Card>
  );
}
