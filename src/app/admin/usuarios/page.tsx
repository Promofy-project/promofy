"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { usuarios } from "@/lib/mock-data";
import type { Usuario } from "@/lib/types";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { DataTable, type Column } from "@/components/admin/data-table";

const PLANO_POR_NIVEL: Record<Usuario["nivel"], string> = {
  Diamante: "VIP",
  Ouro: "Família",
  Prata: "Plus",
  Bronze: "Básico",
};

const PLANO_VARIANT: Record<string, "default" | "yellow-soft" | "muted" | "outline"> = {
  VIP: "default",
  Família: "yellow-soft",
  Plus: "muted",
  Básico: "outline",
};

const NIVEIS = ["Todos", "Diamante", "Ouro", "Prata", "Bronze"] as const;

function initials(nome: string) {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function AdminUsuarios() {
  const [busca, setBusca] = React.useState("");
  const [nivel, setNivel] = React.useState<(typeof NIVEIS)[number]>("Todos");

  const termo = busca.trim().toLowerCase();
  const filtrados = usuarios.filter(
    (u) =>
      (nivel === "Todos" || u.nivel === nivel) &&
      (!termo || u.nome.toLowerCase().includes(termo)),
  );

  const totais = {
    total: usuarios.length,
    assinantes: usuarios.filter((u) => u.nivel !== "Bronze").length,
    vips: usuarios.filter((u) => u.nivel === "Diamante").length,
  };

  const columns: Column<Usuario>[] = [
    {
      key: "usuario",
      header: "Usuário",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials(u.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{u.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{u.cidade}</p>
          </div>
        </div>
      ),
    },
    {
      key: "plano",
      header: "Plano",
      render: (u) => {
        const plano = PLANO_POR_NIVEL[u.nivel];
        return <Badge variant={PLANO_VARIANT[plano]}>{plano}</Badge>;
      },
    },
    {
      key: "nivel",
      header: "Nível",
      render: (u) => <span className="text-muted-foreground">{u.nivel}</span>,
    },
    {
      key: "vip",
      header: "VIP",
      align: "center",
      render: (u) =>
        u.nivel === "Diamante" ? (
          <Badge variant="success">VIP</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "pontos",
      header: "Pontos",
      align: "right",
      render: (u) => (
        <span className="font-bold text-primary tabular-nums">
          {formatNumber(u.pontos)}
        </span>
      ),
    },
    {
      key: "economia",
      header: "Economia",
      align: "right",
      render: (u) => <span className="tabular-nums">{formatBRL(u.economiaTotal)}</span>,
    },
    {
      key: "cupons",
      header: "Cupons usados",
      align: "right",
      render: (u) => <span className="tabular-nums">{u.cuponsUsados}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Base de assinantes, níveis e atividade na plataforma."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total de usuários" value={String(totais.total)} icon="Users" />
        <MetricCard label="Assinantes ativos" value={String(totais.assinantes)} icon="Star" />
        <MetricCard label="Usuários VIP" value={String(totais.vips)} icon="TrendingUp" />
      </div>

      {/* Busca + filtro */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {NIVEIS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNivel(n)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                nivel === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={filtrados}
          getRowKey={(u) => u.id}
          empty={`Nenhum usuário encontrado para “${busca}”.`}
        />
      </div>
    </>
  );
}
