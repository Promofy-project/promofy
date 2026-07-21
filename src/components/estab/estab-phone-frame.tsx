"use client";

import { usePathname } from "next/navigation";
import { Signal, Wifi, BatteryFull } from "lucide-react";

import { cn } from "@/lib/utils";
import { EstabBottomNav } from "@/components/estab/estab-bottom-nav";

// Abas com bottom nav; /e/validar, /e/cupom/novo e /e/login são telas cheias.
const NAV_ROUTES = ["/e", "/e/cupons", "/e/perfil"];

/**
 * Moldura de aparelho do app do estabelecimento — irmã do PhoneFrame do
 * consumidor, mas SEM os overlays do consumidor (SideMenu/CupomAtivoSheet/
 * NpsDialog/TutorialDialog) e com a bottom nav do lojista. Mesma paridade de
 * demo (device no desktop, tela cheia no mobile).
 */
export function EstabPhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = NAV_ROUTES.includes(pathname);

  return (
    <div className="flex min-h-[100dvh] justify-center bg-[#e9eaf3] lg:items-center lg:py-10">
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background lg:h-[884px] lg:max-w-[390px] lg:rounded-[2.75rem] lg:border-[10px] lg:border-[#14141f] lg:shadow-2xl">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {/* status bar (apenas no device desktop) */}
          <div className="hidden items-center justify-between px-7 pt-3 text-[11px] font-semibold text-foreground lg:flex">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <Signal className="h-3.5 w-3.5" />
              <Wifi className="h-3.5 w-3.5" />
              <BatteryFull className="h-4 w-4" />
            </div>
          </div>

          {/* área rolável */}
          <div className={cn("no-scrollbar flex flex-1 flex-col overflow-y-auto")}>
            {children}
          </div>

          {showNav && <EstabBottomNav />}
        </div>
      </div>
    </div>
  );
}
