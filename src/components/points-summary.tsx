"use client";

import Link from "next/link";
import { Trophy, Wallet, LogIn } from "lucide-react";

import { cn, formatBRL } from "@/lib/utils";
import { useCouponState } from "@/components/coupon-state-provider";
import { calcularNivel, CORES_NIVEL } from "@/lib/gamification";

/**
 * Resumo da home (/m): pontos + total economizado REAL, dividindo o espaço.
 * Ambos hidratados do servidor e atualizados no mesmo poll (sobem juntos
 * após uma validação). Anônimo → card-convite de login.
 */
export function PointsSummary() {
  const { logado, getPontos, getEconomia } = useCouponState();

  if (!logado) {
    return (
      <Link
        href="/m/login"
        className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-card-hover"
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #FACC15 0%, #E6A700 100%)" }}
        >
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            Entre para acompanhar seus pontos
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Acumule pontos e veja quanto já economizou.
          </p>
        </div>
        <LogIn className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  const pontos = getPontos();
  const economia = getEconomia();
  const { nivel } = calcularNivel(pontos);
  const cor = CORES_NIVEL[nivel];

  return (
    <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
      <Link
        href="/m/perfil"
        aria-label={`Seus pontos: ${pontos}, nível ${nivel}`}
        className="flex items-center gap-2.5 p-3.5 transition-colors hover:bg-muted/40"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #FACC15 0%, #E6A700 100%)" }}
        >
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-none tabular-nums text-foreground">
            {pontos.toLocaleString("pt-BR")}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            pontos
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                cor.badge,
              )}
            >
              {nivel}
            </span>
          </p>
        </div>
      </Link>

      <Link
        href="/m/perfil"
        aria-label={`Total economizado: ${formatBRL(economia)}`}
        className="flex items-center gap-2.5 p-3.5 transition-colors hover:bg-muted/40"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-none tabular-nums text-foreground">
            {formatBRL(economia)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">economizados</p>
        </div>
      </Link>
    </div>
  );
}
