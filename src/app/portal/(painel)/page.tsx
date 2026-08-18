import Link from "next/link";
import { Plus, CalendarOff, MessageSquareOff } from "lucide-react";

import { buscarCuponsPortal } from "@/lib/data/cupons";
import { buscarIndicadores } from "@/lib/data/indicadores";
import { cn, formatNumber, formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { FunnelChart } from "@/components/funnel-chart";
import { CouponListItem } from "@/components/coupon-list-item";

export const dynamic = "force-dynamic";

/**
 * Visão geral do portal.
 *
 * ESTA TELA ERA INTEIRAMENTE INVENTADA. Vinha toda de `mock-data`: "482
 * resgates", "9.680 visualizações", "24,6% de conversão", "avaliação média
 * 4,8", os deltas "+12,4% vs. mês anterior", e dois depoimentos assinados por
 * pessoas que não existem — "Mariana Alves" e "Rafael Souza". Até o nome do
 * estabelecimento no cabeçalho era literal.
 *
 * A decisão que matou o "8,7" do /portal/avaliacoes vale igual aqui: número
 * real ao lado de número inventado contamina o real. O lojista não tem como
 * saber qual é qual.
 *
 * O QUE FICOU. Tudo o que já tinha fetcher: KPIs e funil vêm de
 * `cupom_metricas` (view sobre `cupom_eventos`, security_invoker — o lojista
 * só enxerga eventos dos próprios cupons), NPS e últimas notas vêm da mesma RPC
 * do `/e/indicadores`, e os cupons são os de verdade.
 *
 * O QUE SAIU E POR QUÊ. Os **deltas** exigem o período anterior, que ninguém
 * calcula — um "+12,4%" ao lado de um número real seria a mentira de novo, em
 * escala menor. A **série mensal de resgates** é derivável de `cupom_eventos`,
 * mas o corte de mês teria de ser em BRT para casar com o `resgates_mes` que a
 * RPC já calcula em SQL; duas implementações da mesma conta divergem na borda
 * (é o que `src/lib/data/indicadores.ts` avisa). Fica como estado honesto e
 * como item de backlog, não como gráfico de enfeite.
 */
export default async function PortalDashboard() {
  const [{ estabelecimento, itens }, ind] = await Promise.all([
    buscarCuponsPortal(),
    buscarIndicadores(),
  ]);

  const total = itens.reduce(
    (acc, i) => ({
      visualizacoes: acc.visualizacoes + i.metricas.visualizacoes,
      cliques: acc.cliques + i.metricas.cliques,
      ativacoes: acc.ativacoes + i.metricas.ativacoes,
      resgates: acc.resgates + i.metricas.resgates,
    }),
    { visualizacoes: 0, cliques: 0, ativacoes: 0, resgates: 0 },
  );

  // Conversão só existe se houve vitrine. 0/0 não é 0% — é "ainda não dá
  // para dizer", mesma distinção que o `temDados` faz para o NPS.
  const conversao =
    total.visualizacoes > 0
      ? `${((total.resgates / total.visualizacoes) * 100).toFixed(1).replace(".", ",")}%`
      : "—";
  // A conversão é acumulada como o funil, não do mês — o rótulo diz isso.

  const temFunil = total.visualizacoes + total.cliques + total.ativacoes + total.resgates > 0;
  const ativos = itens.filter((i) => i.statusPortal === "ativo");

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={
          estabelecimento
            ? `Acompanhe o desempenho do ${estabelecimento.nome}.`
            : "Acompanhe o desempenho do seu estabelecimento."
        }
      >
        {/* Era um <Button> sem href nem onClick — inerte desde sempre (achado
            do relatório de QA v2 §1.4). O fluxo de criação vive na view local
            de /portal/cupons, então o destino é a listagem já no formulário. */}
        <Button asChild>
          <Link href="/portal/cupons?novo=1">
            <Plus className="h-4 w-4" /> Novo cupom
          </Link>
        </Button>
      </PageHeader>

      {/* KPIs — sem `delta`: comparar com o mês anterior exige um dado que
          ninguém calcula ainda. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Resgates no mês" value={formatNumber(ind.resgatesMes)} icon="Ticket" />
        <MetricCard
          label="Visualizações (total)"
          value={formatNumber(total.visualizacoes)}
          icon="Eye"
        />
        <MetricCard label="Conversão (total)" value={conversao} icon="TrendingUp" />
        <MetricCard
          label="NPS recebido"
          value={ind.temDados ? String(ind.score) : "—"}
          icon="Star"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* "desde o início" no título de propósito: o funil é acumulado e fica
            ao lado de "Resgates no mês". Sem o rótulo, um mês zerado ao lado de
            1.395 resgates no funil se lê como contradição. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funil de conversão (desde o início)</CardTitle>
          </CardHeader>
          <CardContent>
            {temFunil ? (
              <FunnelChart
                etapas={[
                  { etapa: "Visualizaram cupom", valor: total.visualizacoes, cor: "#3A3AE6" },
                  { etapa: "Clicaram", valor: total.cliques, cor: "#5B5BEF" },
                  { etapa: "Ativaram", valor: total.ativacoes, cor: "#8B8BF5" },
                  { etapa: "Resgataram no balcão", valor: total.resgates, cor: "#B5B5FA" },
                ]}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ainda não há movimento nos seus cupons. O funil aparece assim que os
                clientes começarem a ver e resgatar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resgates por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarOff className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold">Série histórica ainda não disponível</p>
              <p className="text-xs text-muted-foreground">
                Hoje o portal mostra o mês corrente ({ind.resgatesMes}{" "}
                {ind.resgatesMes === 1 ? "resgate" : "resgates"}). O histórico entra
                junto do relatório completo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cupons ativos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ativos.length > 0 ? (
              ativos.slice(0, 4).map((i) => <CouponListItem key={i.cupom.id} cupom={i.cupom} />)
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum cupom ativo no momento.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas notas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ind.ultimas.length > 0 ? (
              ind.ultimas.slice(0, 3).map((u, i) => (
                <div
                  key={`${u.em}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums",
                      u.nota >= 9
                        ? "bg-success-soft text-success"
                        : u.nota >= 7
                          ? "bg-yellow-soft text-yellow-foreground"
                          : "bg-danger-soft text-danger",
                    )}
                  >
                    {u.nota}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Primeiro nome só — a RPC não devolve mais que isso. */}
                    <p className="truncate text-sm font-semibold">{u.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.cupom}</p>
                  </div>
                  {u.em && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatShortDate(u.em)}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <MessageSquareOff className="h-5 w-5 text-muted-foreground" aria-hidden />
                <p className="text-sm font-semibold">Ainda sem avaliações</p>
                <p className="text-xs text-muted-foreground">
                  A nota aparece quando os clientes responderem a pesquisa depois de
                  resgatar.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
