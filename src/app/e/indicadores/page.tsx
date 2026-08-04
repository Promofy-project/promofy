import { TrendingUp, Star } from "lucide-react";

import { buscarIndicadores } from "@/lib/data/indicadores";
import { cn, formatShortDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Indicadores do estabelecimento (Fase 8/M2) — modo totem.
 *
 * É RESUMO. O relatório completo (série histórica, filtros, exportação, o
 * desenho de `docs/modelo/estabelecimento-mobile/NPS.png`) fica para o portal
 * web — está no backlog. Aqui cabe o que o dono olha entre um cliente e outro.
 */
export default async function IndicadoresPage() {
  const ind = await buscarIndicadores();

  const faixa = (n: number) => (ind.respostas > 0 ? Math.round((n / ind.respostas) * 100) : 0);
  const barras = [
    { rotulo: "Promotores", nota: "9–10", valor: ind.promotores, cor: "bg-success" },
    { rotulo: "Neutros", nota: "7–8", valor: ind.neutros, cor: "bg-yellow" },
    { rotulo: "Detratores", nota: "0–6", valor: ind.detratores, cor: "bg-danger" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <header>
        <h1 className="text-xl font-extrabold">Indicadores</h1>
        <p className="text-sm text-muted-foreground">O que os clientes acham do seu negócio.</p>
      </header>

      {/* NPS */}
      <section className="rounded-card border border-border bg-surface p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          NPS
        </p>
        {ind.temDados ? (
          <>
            <p
              className={cn(
                "mt-1 text-5xl font-extrabold tabular-nums",
                (ind.score ?? 0) >= 50 ? "text-success" : (ind.score ?? 0) >= 0 ? "text-yellow-foreground" : "text-danger",
              )}
            >
              {ind.score}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              de {ind.respostas} {ind.respostas === 1 ? "avaliação" : "avaliações"}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-base font-bold">Ainda sem avaliações</p>
            <p className="mx-auto mt-1 max-w-[240px] text-xs text-muted-foreground">
              A nota aparece assim que os clientes começarem a responder depois de resgatar.
            </p>
          </>
        )}
      </section>

      {/* Distribuição */}
      {ind.temDados && (
        <section className="flex flex-col gap-3">
          {barras.map((b) => (
            <div key={b.rotulo}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold">
                  {b.rotulo} <span className="text-muted-foreground">({b.nota})</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {b.valor} · {faixa(b.valor)}%
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", b.cor)} style={{ width: `${faixa(b.valor)}%` }} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Resgates do mês */}
      <section className="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-2xl font-extrabold leading-none tabular-nums">{ind.resgatesMes}</p>
          <p className="text-xs text-muted-foreground">resgates neste mês</p>
        </div>
      </section>

      {/* Últimas notas */}
      {ind.ultimas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold">Últimas notas</h2>
          <ul className="flex flex-col gap-2">
            {ind.ultimas.map((u, i) => (
              <li
                key={`${u.em}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums",
                    u.nota >= 9 ? "bg-success-soft text-success"
                      : u.nota >= 7 ? "bg-yellow-soft text-yellow-foreground"
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
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
        <Star className="h-3.5 w-3.5" aria-hidden />
        Resumo. O relatório completo fica no portal web.
      </p>
    </div>
  );
}
