"use client";

import * as React from "react";
import { Plus, QrCode, ArrowLeft, CheckCircle2, X } from "lucide-react";

import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { CouponPortalCard } from "@/components/portal/coupon-portal-card";
import { NovoCupomForm } from "@/components/portal/novo-cupom-form";
import { ValidarCupomDialog } from "@/components/portal/validar-cupom-dialog";
import {
  SEED_CUPONS_PORTAL,
  type ItemCupomPortal,
} from "@/components/portal/cupons-seed";

export default function PortalCupons() {
  const [lista, setLista] = React.useState<ItemCupomPortal[]>(SEED_CUPONS_PORTAL);
  const [view, setView] = React.useState<"lista" | "novo">("lista");
  const [validarOpen, setValidarOpen] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sucesso) return;
    const t = window.setTimeout(() => setSucesso(null), 5000);
    return () => window.clearTimeout(t);
  }, [sucesso]);

  const ativos = lista.filter((i) => i.statusPortal === "ativo").length;
  const totalVis = lista.reduce((s, i) => s + i.metricas.visualizacoes, 0);
  const totalResgates = lista.reduce((s, i) => s + i.metricas.resgates, 0);
  const conversao = totalVis ? Math.round((totalResgates / totalVis) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Crie, valide e acompanhe o desempenho dos seus cupons."
      >
        {view === "lista" ? (
          <>
            <Button variant="outline" onClick={() => setValidarOpen(true)}>
              <QrCode className="h-4 w-4" /> Validar cupom
            </Button>
            <Button onClick={() => setView("novo")}>
              <Plus className="h-4 w-4" /> Novo cupom
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setView("lista")}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
      </PageHeader>

      {sucesso && (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="flex-1">{sucesso}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setSucesso(null)}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-success/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {view === "lista" ? (
        <>
          {/* Resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Cupons ativos" value={String(ativos)} icon="Ticket" />
            <MetricCard
              label="Visualizações"
              value={formatNumber(totalVis)}
              icon="Eye"
            />
            <MetricCard
              label="Resgates"
              value={formatNumber(totalResgates)}
              icon="Users"
            />
            <MetricCard
              label="Conversão média"
              value={`${conversao}%`}
              icon="TrendingUp"
            />
          </div>

          {/* Lista */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {lista.map((item) => (
              <CouponPortalCard key={item.cupom.id} item={item} />
            ))}
          </div>
        </>
      ) : (
        <NovoCupomForm
          onCancelar={() => setView("lista")}
          onSalvar={(item) => {
            setLista((prev) => [item, ...prev]);
            setView("lista");
            setSucesso(`Cupom “${item.cupom.titulo}” criado com sucesso!`);
          }}
        />
      )}

      <ValidarCupomDialog
        open={validarOpen}
        onClose={() => setValidarOpen(false)}
      />
    </>
  );
}
