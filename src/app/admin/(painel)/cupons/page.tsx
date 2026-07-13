"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cupons, getCategoria } from "@/lib/mock-data";
import type { Cupom } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { DataTable, type Column } from "@/components/admin/data-table";

type Moderacao = "pendente" | "publicado" | "aprovado" | "oculto";

const MOD_BADGE: Record<Moderacao, { variant: "yellow-soft" | "muted" | "success" | "danger"; label: string }> = {
  pendente: { variant: "yellow-soft", label: "Pendente" },
  publicado: { variant: "muted", label: "Publicado" },
  aprovado: { variant: "success", label: "Aprovado" },
  oculto: { variant: "danger", label: "Oculto" },
};

function estadoInicial(): Record<string, Moderacao> {
  return Object.fromEntries(
    cupons.map((c) => [c.id, c.status === "indisponivel" ? "pendente" : "publicado"]),
  );
}

export default function AdminCupons() {
  const [estado, setEstado] = React.useState<Record<string, Moderacao>>(estadoInicial);

  const set = (id: string, m: Moderacao) =>
    setEstado((prev) => ({ ...prev, [id]: m }));

  const totais = {
    total: cupons.length,
    pendentes: cupons.filter((c) => estado[c.id] === "pendente").length,
    ocultos: cupons.filter((c) => estado[c.id] === "oculto").length,
  };

  const columns: Column<Cupom>[] = [
    {
      key: "cupom",
      header: "Cupom",
      render: (c) => {
        const cat = getCategoria(c.categoria);
        return (
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ background: cat.gradiente }}
            >
              <Icon name={cat.icon} className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.estabelecimento}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "categoria",
      header: "Categoria",
      render: (c) => (
        <span className="text-muted-foreground">{getCategoria(c.categoria).label}</span>
      ),
    },
    {
      key: "economia",
      header: "Economia",
      align: "right",
      render: (c) => <span className="tabular-nums">{formatBRL(c.economia)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => {
        const b = MOD_BADGE[estado[c.id]];
        return <Badge variant={b.variant}>{b.label}</Badge>;
      },
    },
    {
      key: "acoes",
      header: "Moderação",
      align: "right",
      render: (c) => {
        const atual = estado[c.id];
        return (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={atual === "aprovado"}
              onClick={() => set(c.id, "aprovado")}
            >
              <Check className="h-4 w-4" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={atual === "oculto"}
              onClick={() => set(c.id, "oculto")}
            >
              Ocultar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Moderação de todos os cupons publicados na plataforma."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total de cupons" value={String(totais.total)} icon="Ticket" />
        <MetricCard label="Aguardando aprovação" value={String(totais.pendentes)} icon="Eye" />
        <MetricCard label="Ocultos" value={String(totais.ocultos)} icon="Store" />
      </div>

      <div className="mt-6">
        <DataTable columns={columns} rows={cupons} getRowKey={(c) => c.id} />
      </div>
    </>
  );
}
