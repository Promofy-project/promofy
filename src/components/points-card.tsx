"use client";

import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCouponState } from "@/components/coupon-state-provider";
import { Progress } from "@/components/ui/progress";
import {
  calcularNivel,
  CORES_NIVEL,
  COMO_GANHAR,
} from "@/lib/gamification";

/**
 * Card de pontos / gamificação do consumidor (full, para /m/perfil).
 * Saldo reativo derivado do CouponStateProvider — validar cupom / responder NPS
 * incrementa os pontos exibidos aqui ao vivo.
 */
export function PointsCard() {
  const { getPontos } = useCouponState();
  const pontos = getPontos();
  const { nivel, proximo, faltam, progresso } = calcularNivel(pontos);
  const cor = CORES_NIVEL[nivel];

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      {/* Topo — saldo + nível */}
      <div
        className="relative px-4 py-5 text-white"
        style={{
          background:
            "linear-gradient(135deg, #1414DC 0%, #4B4BEC 60%, #6E6EF2 100%)",
        }}
      >
        <div className="bg-dots absolute inset-0 opacity-15" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/70">Seus pontos</p>
            <p className="mt-0.5 text-3xl font-extrabold leading-none tabular-nums">
              {pontos.toLocaleString("pt-BR")}
            </p>
          </div>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-2 ring-inset",
              cor.badge,
              cor.ring,
            )}
          >
            <Trophy className="h-4 w-4" />
            {nivel}
          </span>
        </div>

        {/* Progresso para o próximo nível */}
        <div className="relative mt-4">
          <Progress
            value={progresso}
            className="h-2 bg-white/25"
            indicatorClassName="bg-yellow"
          />
          <p className="mt-1.5 text-xs text-white/80">
            {proximo
              ? `Faltam ${faltam.toLocaleString("pt-BR")} pts para ${proximo}`
              : "Você atingiu o nível máximo!"}
          </p>
        </div>
      </div>

      {/* Como ganhar pontos */}
      <div className="px-4 pb-4 pt-3.5">
        <p className="mb-2.5 text-sm font-bold text-foreground">
          Como ganhar pontos
        </p>
        <ul className="flex flex-col divide-y divide-border">
          {COMO_GANHAR.map((g) => {
            const Icon = g.icon;
            return (
              <li
                key={g.key}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-sm text-foreground">{g.label}</span>
                <span className="shrink-0 text-sm font-bold text-primary">
                  +{g.pontos}
                </span>
              </li>
            );
          })}
        </ul>

        <Link
          href="/m/premiacoes"
          className="mt-3 flex items-center justify-between rounded-xl bg-yellow-soft px-3.5 py-3 text-sm font-semibold text-[#8a6d0b] transition-colors hover:bg-yellow-soft/70"
        >
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Ver prêmios e ranking
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
