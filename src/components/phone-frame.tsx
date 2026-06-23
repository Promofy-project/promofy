"use client";

import { usePathname } from "next/navigation";
import { Signal, Wifi, BatteryFull } from "lucide-react";

import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";
import { WaveBackground } from "@/components/wave-background";
import { TutorialDialog } from "@/components/tutorial-dialog";
import { SideMenu } from "@/components/side-menu";

const ENTRY_ROUTES = ["/m/login", "/m/cadastro", "/m/onboarding"];
// Abas com bottom nav (todas as outras telas de /m são telas cheias)
const NAV_ROUTES = ["/m", "/m/buscar", "/m/favoritos", "/m/perfil"];

/**
 * Simula um aparelho de ~390px. Em telas grandes vira um "device" centralizado;
 * no mobile ocupa a tela inteira.
 *
 * Telas de entrada (login/cadastro/onboarding): fundo amarelo com ondas e sem
 * bottom nav. App interno: fundo claro com bottom nav.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEntry = ENTRY_ROUTES.some((r) => pathname.startsWith(r));
  // Filtros é uma tela amarela (como as de entrada)
  const isYellow = isEntry || pathname.startsWith("/m/filtros");
  // Bottom nav só nas abas principais; demais telas de /m são telas cheias
  const showNav = NAV_ROUTES.includes(pathname);

  return (
    <div className="flex min-h-screen justify-center bg-[#e9eaf3] lg:items-center lg:py-10">
      <div
        className={cn(
          // mobile-first: full-width fluido em telas reais (< lg);
          // "device" centralizado com moldura só no lg+ (desktop)
          "relative flex min-h-screen w-full flex-col overflow-hidden lg:h-[884px] lg:min-h-0 lg:max-w-[390px] lg:rounded-[2.75rem] lg:border-[10px] lg:border-[#14141f] lg:shadow-2xl",
          isYellow ? "bg-yellow" : "bg-background",
        )}
      >
        {isYellow && <WaveBackground className="absolute inset-0 z-0 h-full w-full" />}

        {/* coluna de conteúdo acima das ondas */}
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
          <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
            {children}
          </div>

          {showNav && <BottomNav />}
        </div>

        {/* overlays contidos no aparelho */}
        {!isEntry && <SideMenu />}
        <TutorialDialog />
      </div>
    </div>
  );
}
