"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";

import { Logo } from "@/components/logo";
import { useMobileFlow } from "@/components/mobile-flow-provider";

/**
 * Header da home. Fase 4: sino de novidades — a contagem vem do server
 * component da home (page re-renderiza a cada navegação; o layout não,
 * e o badge ficaria stale a sessão inteira). Abrir /m/novidades marca
 * como visto e zera na volta.
 */
export function HomeHeader({ novidades = 0 }: { novidades?: number }) {
  const { openMenu } = useMobileFlow();
  return (
    <header className="sticky top-0 z-30 flex items-center bg-background/90 px-4 pb-3 pt-4 backdrop-blur">
      <button
        type="button"
        onClick={openMenu}
        aria-label="Abrir menu"
        className="grid h-10 w-10 place-items-center rounded-xl text-foreground hover:bg-muted"
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex flex-1 justify-center">
        <Logo />
      </div>
      <Link
        href="/m/novidades"
        aria-label={
          novidades > 0
            ? `Novidades dos favoritos: ${novidades} não vistas`
            : "Novidades dos favoritos"
        }
        className="relative grid h-10 w-10 place-items-center rounded-xl text-foreground hover:bg-muted"
      >
        <Bell className="h-6 w-6" />
        {novidades > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {novidades > 9 ? "9+" : novidades}
          </span>
        )}
      </Link>
    </header>
  );
}
