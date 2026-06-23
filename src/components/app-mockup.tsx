import { Menu, Signal, Wifi, BatteryFull } from "lucide-react";

import { cupons, getCategoria } from "@/lib/mock-data";
import { formatBRLValue } from "@/lib/utils";
import { Logo } from "@/components/logo";

/** Mockup estático da home do app (mini "device") para a landing. */
export function AppMockup() {
  const tiles = [cupons[0], cupons[4]];

  return (
    <div className="relative mx-auto w-[250px]">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[3rem] bg-primary/10 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-[2.4rem] border-[10px] border-[#14141f] bg-background shadow-2xl">
        {/* status bar */}
        <div className="flex items-center justify-between px-5 pt-2.5 text-[9px] font-semibold text-foreground">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <Signal className="h-2.5 w-2.5" />
            <Wifi className="h-2.5 w-2.5" />
            <BatteryFull className="h-3 w-3" />
          </div>
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-4 py-2">
          <Menu className="h-4 w-4 text-foreground" />
          <span className="scale-[0.78]">
            <Logo />
          </span>
          <span className="h-4 w-4" />
        </div>

        {/* banner */}
        <div
          className="mx-4 flex h-16 flex-col justify-end rounded-xl p-2.5 text-white"
          style={{ background: "linear-gradient(135deg, #1414DC 0%, #4B4BEC 100%)" }}
        >
          <p className="text-[10px] font-extrabold leading-none">
            Ofertas da semana
          </p>
          <p className="mt-0.5 text-[8px] text-white/80">
            Até 50% OFF perto de você
          </p>
        </div>

        {/* chips */}
        <div className="flex gap-1.5 px-4 py-2.5">
          {["Alimentação", "Lazer", "Compras"].map((c) => (
            <span
              key={c}
              className="rounded-full bg-yellow px-2 py-0.5 text-[8px] font-semibold text-yellow-foreground"
            >
              {c}
            </span>
          ))}
        </div>

        {/* mini coupon tiles */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          {tiles.map((t) => (
            <div
              key={t.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div
                className="h-12"
                style={{ background: getCategoria(t.categoria).gradiente }}
              />
              <div className="p-1.5">
                <p className="line-clamp-1 text-[9px] font-bold leading-tight">
                  {t.titulo}
                </p>
                <p className="mt-0.5 text-[8px] font-extrabold text-primary">
                  Economize R$ {formatBRLValue(t.economia)}
                </p>
                <div className="mt-1 rounded-md bg-primary py-1 text-center text-[8px] font-bold text-white">
                  Usar agora
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
