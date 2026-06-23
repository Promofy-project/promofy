import { Plus } from "lucide-react";

import {
  portalKpis,
  funilConversao,
  resgatesMensais,
  cupons,
  avaliacoes,
} from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { FunnelChart } from "@/components/funnel-chart";
import { BarChart } from "@/components/bar-chart";
import { CouponListItem } from "@/components/coupon-list-item";
import { ReviewCard } from "@/components/review-card";

export default function PortalDashboard() {
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Acompanhe o desempenho do Sabor & Cia."
      >
        <Button>
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {portalKpis.map((k) => (
          <MetricCard
            key={k.id}
            label={k.label}
            value={k.valor}
            delta={k.delta}
            icon={k.icon}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funil de conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelChart etapas={funilConversao} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Resgates por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={resgatesMensais} format={formatNumber} />
          </CardContent>
        </Card>
      </div>

      {/* Cupons + avaliações */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cupons ativos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cupons.slice(0, 4).map((c) => (
              <CouponListItem key={c.id} cupom={c} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avaliações recentes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {avaliacoes.slice(0, 2).map((a) => (
              <ReviewCard key={a.id} avaliacao={a} className="shadow-none" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
