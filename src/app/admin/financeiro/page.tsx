import { receitaMensal } from "@/lib/mock-data";
import { formatBRL, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { BarChart } from "@/components/bar-chart";

interface LinhaPlano {
  plano: string;
  assinantes: number;
  receita: number;
}

// Quebra por plano — soma a 2.950 assinantes e R$ 81.900 (coerente com o dashboard).
const porPlano: LinhaPlano[] = [
  { plano: "Plus", assinantes: 1420, receita: 33060 },
  { plano: "Família", assinantes: 1050, receita: 31400 },
  { plano: "VIP", assinantes: 60, receita: 13280 },
  { plano: "Básico", assinantes: 420, receita: 4160 },
];

const totalReceita = porPlano.reduce((s, p) => s + p.receita, 0); // 81.900
const totalAssinantes = porPlano.reduce((s, p) => s + p.assinantes, 0); // 2.950
const ticketMedio = totalReceita / totalAssinantes;

export default function AdminFinanceiro() {
  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receita, ticket médio e assinaturas da plataforma."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MRR" value="R$ 81,9k" delta={13.1} icon="DollarSign" />
        <MetricCard
          label="Receita do mês"
          value={formatBRL(receitaMensal[receitaMensal.length - 1].valor)}
          delta={13.1}
          icon="TrendingUp"
        />
        <MetricCard label="Ticket médio" value={formatBRL(ticketMedio)} icon="Ticket" />
        <MetricCard
          label="Assinaturas"
          value={formatNumber(totalAssinantes)}
          delta={9.7}
          icon="Users"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita mensal (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={receitaMensal} format={formatBRL} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por plano</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {porPlano.map((p) => {
              const share = Math.round((p.receita / totalReceita) * 100);
              return (
                <div key={p.plano}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold">{p.plano}</span>
                    <span className="tabular-nums">{formatBRL(p.receita)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(share, 3)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatNumber(p.assinantes)} assinantes</span>
                    <span>{share}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
