"use client";

import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCouponState } from "@/components/coupon-state-provider";
import { calcularNivel, CORES_NIVEL } from "@/lib/gamification";

/**
 * Resumo compacto de pontos para a home (/m). Clicável → /m/perfil, onde fica
 * o card completo. Saldo reativo derivado do CouponStateProvider.
 */
export function PointsSummary() {
  const { getPontos } = useCouponState();
  const pontos = getPontos();
  const { nivel, proximo, faltam } = calcularNivel(pontos);
  const cor = CORES_NIVEL[nivel];

  return (
    <Link
      href="/m/perfil"
      aria-label={`Seus pontos: ${pontos} pontos, nível ${nivel}`}
      className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
        style={{ background: "linear-gradient(135deg, #FACC15 0%, #E6A700 100%)" }}
      >
        <Trophy className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold leading-none tabular-nums text-foreground">
            {pontos.toLocaleString("pt-BR")}
          </span>
          <span className="text-xs font-medium text-muted-foreground">pontos</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold",
              cor.badge,
            )}
          >
            {nivel}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {proximo
            ? `Faltam ${faltam.toLocaleString("pt-BR")} pts para ${proximo}`
            : "Nível máximo alcançado!"}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
