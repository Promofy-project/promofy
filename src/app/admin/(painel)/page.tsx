import { Download } from "lucide-react";

import {
  adminKpis,
  funilConversao,
  receitaMensal,
  estabelecimentos,
  usuarios,
} from "@/lib/mock-data";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { FunnelChart } from "@/components/funnel-chart";
import { BarChart } from "@/components/bar-chart";
import { BusinessCard } from "@/components/business-card";

const nivelVariant: Record<
  string,
  "default" | "muted" | "yellow-soft" | "success"
> = {
  Diamante: "default",
  Ouro: "yellow-soft",
  Prata: "muted",
  Bronze: "muted",
};

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="Painel geral"
        description="Saúde da plataforma Promofy em tempo real."
      >
        <Button variant="outline">
          <Download className="h-4 w-4" /> Relatório
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminKpis.map((k) => (
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
            <CardTitle>Receita mensal (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={receitaMensal} format={formatBRL} />
          </CardContent>
        </Card>
      </div>

      {/* Estabelecimentos */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold">Estabelecimentos parceiros</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {estabelecimentos.map((e) => (
            <BusinessCard key={e.id} estabelecimento={e} />
          ))}
        </div>
      </div>

      {/* Ranking */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Ranking de usuários</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {usuarios.map((u, i) => {
            const initials = u.nome
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0])
              .join("");
            return (
              <div
                key={u.id}
                className={cn(
                  "flex items-center gap-3 py-3",
                  i !== usuarios.length - 1 && "border-b border-border",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    i === 0
                      ? "bg-yellow text-yellow-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.cidade}
                  </p>
                </div>
                <Badge variant={nivelVariant[u.nivel]} className="hidden sm:flex">
                  {u.nivel}
                </Badge>
                <div className="hidden w-28 text-right md:block">
                  <p className="text-sm font-semibold">
                    {formatBRL(u.economiaTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">economizados</p>
                </div>
                <div className="w-20 text-right">
                  <p className="text-sm font-bold text-primary">
                    {formatNumber(u.pontos)}
                  </p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
