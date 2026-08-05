import { MessageSquareOff } from "lucide-react";

import { buscarIndicadores } from "@/lib/data/indicadores";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Avaliações do estabelecimento (Fase 8/M2).
 *
 * ESTA TELA ERA QUASE TODA INVENTADA. O card de NPS trazia "8,7" hardcoded
 * desde a Fase 3, e os depoimentos vinham de `mock-data` — nomes e textos que
 * ninguém escreveu. Agora ela mostra só o que existe: o NPS real, calculado
 * pela mesma RPC do `/e/indicadores`, e a distribuição.
 *
 * Os depoimentos saíram em vez de ficarem "só por enquanto": número real ao
 * lado de depoimento fictício contamina a credibilidade do real. Enquanto não
 * houver review em texto no banco, o honesto é dizer que não há — e é o que o
 * bloco abaixo faz.
 */
export default async function PortalAvaliacoes() {
  const ind = await buscarIndicadores();
  const pct = (n: number) => (ind.respostas > 0 ? Math.round((n / ind.respostas) * 100) : 0);

  const faixas = [
    { rotulo: "Promotores", nota: "9–10", valor: ind.promotores, cor: "bg-success" },
    { rotulo: "Neutros", nota: "7–8", valor: ind.neutros, cor: "bg-yellow" },
    { rotulo: "Detratores", nota: "0–6", valor: ind.detratores, cor: "bg-danger" },
  ];

  return (
    <>
      <PageHeader
        title="Avaliações"
        description="O que os clientes responderam depois de resgatar um cupom."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="NPS recebido"
          value={ind.temDados ? String(ind.score) : "—"}
          icon="TrendingUp"
        />
        <MetricCard label="Respostas" value={String(ind.respostas)} icon="Users" />
        <MetricCard label="Resgates no mês" value={String(ind.resgatesMes)} icon="Ticket" />
      </div>

      {ind.temDados ? (
        <Card className="mt-6 p-6">
          <h2 className="text-base font-bold">Distribuição das notas</h2>
          <div className="mt-4 flex flex-col gap-4">
            {faixas.map((f) => (
              <div key={f.rotulo}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">
                    {f.rotulo} <span className="text-muted-foreground">({f.nota})</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {f.valor} · {pct(f.valor)}%
                  </span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${f.cor}`} style={{ width: `${pct(f.valor)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-semibold">Ainda sem avaliações</p>
          <p className="max-w-md text-sm text-muted-foreground">
            A nota aparece assim que os clientes começarem a responder a pesquisa depois de
            resgatar um cupom.
          </p>
        </Card>
      )}

      <Card className="mt-6 flex items-start gap-3 p-5">
        <MessageSquareOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Comentários em texto ainda não existem</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hoje a pesquisa coleta apenas a nota de 0 a 10. Quando os clientes puderem escrever,
            os comentários aparecem aqui.
          </p>
        </div>
      </Card>
    </>
  );
}
