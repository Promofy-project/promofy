"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { formatShortDate } from "@/lib/utils";
import {
  crmCampoOuNaoInformado,
  type CrmClienteResumo,
  type CrmFiltro,
  type CrmResumo,
} from "@/lib/crm-tipos";
import { cn } from "@/lib/utils";

const FILTROS: { id: CrmFiltro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "recentes", label: "Recentes" },
  { id: "recorrentes", label: "Recorrentes" },
  { id: "periodo_90d", label: "90 dias" },
];

function qsExport(q: string, filtro: string): string {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (filtro && filtro !== "todos") p.set("filtro", filtro);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function ClientesClient({
  clientes,
  resumo,
  total,
  pagina,
  porPagina,
  qInicial,
  filtroInicial,
}: {
  clientes: CrmClienteResumo[];
  resumo: CrmResumo;
  total: number;
  pagina: number;
  porPagina: number;
  qInicial: string;
  filtroInicial: CrmFiltro;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(qInicial);

  function navegar(patch: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    navegar({ q: q.trim() || null, pagina: "1" });
  }

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const exportQs = qsExport(qInicial, filtroInicial);
  const vazio = total === 0 && !qInicial && filtroInicial === "todos";

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem resgatou cupons no seu estabelecimento com validação confirmada."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/portal/clientes/exportar.xlsx${exportQs}`}>
              <Download className="h-4 w-4" />
              Excel
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/portal/clientes/exportar.pdf${exportQs}`}>
              <Download className="h-4 w-4" />
              PDF
            </a>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Clientes únicos" value={String(resumo.clientesUnicos)} icon="Users" />
        <MetricCard label="Novos (30 dias)" value={String(resumo.novos30d)} icon="TrendingUp" />
        <MetricCard label="Recorrentes" value={String(resumo.recorrentes)} icon="Star" />
        <MetricCard
          label="Resgates confirmados"
          value={String(resumo.resgatesConfirmados)}
          icon="Ticket"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={buscar} className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone"
              className="pl-9"
              aria-label="Buscar clientes"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => navegar({ filtro: f.id === "todos" ? null : f.id, pagina: "1" })}
              className={cn(
                "rounded-btn px-3 py-1.5 text-sm font-medium transition-colors",
                filtroInicial === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {vazio ? (
        <Card className="mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <Users className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="font-semibold">Ainda sem clientes</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Seus clientes aparecerão aqui após resgates confirmados.
          </p>
        </Card>
      ) : clientes.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado com estes filtros.
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Contato</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">Resgates</th>
                  <th className="px-4 py-3 font-semibold">Último resgate</th>
                  <th className="px-4 py-3 font-semibold sr-only">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.usuarioId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {crmCampoOuNaoInformado(c.nome)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{crmCampoOuNaoInformado(c.email)}</div>
                      <div className="text-xs">{crmCampoOuNaoInformado(c.telefone)}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.totalResgates}</td>
                    <td className="px-4 py-3">
                      {c.ultimoResgate ? formatShortDate(c.ultimoResgate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/portal/clientes/${c.usuarioId}`}>Ver</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 flex flex-col gap-3 md:hidden">
            {clientes.map((c) => (
              <Link
                key={c.usuarioId}
                href={`/portal/clientes/${c.usuarioId}`}
                className="rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:bg-muted/40"
              >
                <p className="font-semibold">{crmCampoOuNaoInformado(c.nome)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {crmCampoOuNaoInformado(c.email)}
                </p>
                <p className="mt-2 text-sm">
                  <span className="tabular-nums font-medium">{c.totalResgates}</span>
                  {" resgate(s) · último "}
                  {c.ultimoResgate ? formatShortDate(c.ultimoResgate) : "—"}
                </p>
              </Link>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Página {pagina} de {totalPaginas} · {total} cliente(s)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1}
                  onClick={() => navegar({ pagina: String(pagina - 1) })}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagina >= totalPaginas}
                  onClick={() => navegar({ pagina: String(pagina + 1) })}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
