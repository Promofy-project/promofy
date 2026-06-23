import { Signal, Wifi, BatteryFull } from "lucide-react";

import { BottomNav } from "@/components/bottom-nav";

/**
 * Simula um aparelho de ~390px. Em telas grandes vira um "device" centralizado
 * com moldura, status bar e bottom nav; no mobile ocupa a tela inteira.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-[#e9eaf3] lg:items-center lg:py-10">
      <div className="relative flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden bg-background lg:h-[884px] lg:min-h-0 lg:max-w-[390px] lg:rounded-[2.75rem] lg:border-[10px] lg:border-[#14141f] lg:shadow-2xl">
        {/* status bar (desktop device only) */}
        <div className="hidden items-center justify-between px-7 pt-3 text-[11px] font-semibold text-foreground lg:flex">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Signal className="h-3.5 w-3.5" />
            <Wifi className="h-3.5 w-3.5" />
            <BatteryFull className="h-4 w-4" />
          </div>
        </div>

        {/* scrollable content */}
        <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>

        <BottomNav />
      </div>
    </div>
  );
}
