"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { estabelecimentos, categorias, getCategoria } from "@/lib/mock-data";
import type { Estabelecimento, CategoriaId } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { DataTable, type Column } from "@/components/admin/data-table";

// Ranking por resgates no mês (determinístico).
const RANK: Record<string, number> = (() => {
  const ordenados = [...estabelecimentos].sort(
    (a, b) => b.resgatesMes - a.resgatesMes,
  );
  const m: Record<string, number> = {};
  ordenados.forEach((e, i) => (m[e.id] = i + 1));
  return m;
})();

const STATUS_BADGE: Record<
  Estabelecimento["status"],
  { variant: "success" | "yellow-soft" | "danger"; label: string }
> = {
  ativo: { variant: "success", label: "Ativo" },
  pendente: { variant: "yellow-soft", label: "Pendente" },
  suspenso: { variant: "danger", label: "Suspenso" },
};

// Dias ocioso (sem publicar) — determinístico por status, para o aviso de inatividade.
function diasOcioso(status: Estabelecimento["status"]): number {
  if (status === "pendente") return 9;
  if (status === "suspenso") return 27;
  return 0;
}

export default function AdminEstabelecimentos() {
  const [busca, setBusca] = React.useState("");
  const [cat, setCat] = React.useState<CategoriaId | "todos">("todos");

  const termo = busca.trim().toLowerCase();
  const filtrados = estabelecimentos.filter(
    (e) =>
      (cat === "todos" || e.categoria === cat) &&
      (!termo || e.nome.toLowerCase().includes(termo)),
  );

  const totais = {
    total: estabelecimentos.length,
    ativos: estabelecimentos.filter((e) => e.status === "ativo").length,
    ociosos: estabelecimentos.filter((e) => e.status !== "ativo").length,
  };

  const columns: Column<Estabelecimento>[] = [
    {
      key: "nome",
      header: "Estabelecimento",
      render: (e) => {
        const c = getCategoria(e.categoria);
        return (
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ background: c.gradiente }}
            >
              <Icon name={c.icon} className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{e.nome}</p>
              <p className="truncate text-xs text-muted-foreground">{e.cidade}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "categoria",
      header: "Categoria",
      render: (e) => (
        <span className="text-muted-foreground">{getCategoria(e.categoria).label}</span>
      ),
    },
    {
      key: "cupons",
      header: "Cupons",
      align: "right",
      render: (e) => <span className="tabular-nums">{e.cuponsAtivos}</span>,
    },
    {
      key: "resgates",
      header: "Resgates/mês",
      align: "right",
      render: (e) => <span className="tabular-nums">{formatNumber(e.resgatesMes)}</span>,
    },
    {
      key: "ranking",
      header: "Ranking",
      align: "center",
      render: (e) => (
        <span
          className={cn(
            "inline-grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
            RANK[e.id] === 1
              ? "bg-yellow text-yellow-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {RANK[e.id]}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => {
        const b = STATUS_BADGE[e.status];
        const dias = diasOcioso(e.status);
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={b.variant}>{b.label}</Badge>
            {dias > 0 && (
              <span className="text-xs font-medium text-danger">
                Ocioso há {dias} dias
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Estabelecimentos"
        description="Aprovação, ranking e atividade dos parceiros."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total de parceiros" value={String(totais.total)} icon="Store" />
        <MetricCard label="Ativos" value={String(totais.ativos)} icon="TrendingUp" />
        <MetricCard label="Ociosos / pendentes" value={String(totais.ociosos)} icon="Ticket" />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-xs lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCat("todos")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
              cat === "todos"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                cat === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={filtrados}
          getRowKey={(e) => e.id}
          empty={`Nenhum estabelecimento encontrado para “${busca}”.`}
        />
      </div>
    </>
  );
}
