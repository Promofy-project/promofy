"use client";

import { Menu } from "lucide-react";

import { Logo } from "@/components/logo";
import { useMobileFlow } from "@/components/mobile-flow-provider";

export function HomeHeader() {
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
      <span className="h-10 w-10" aria-hidden />
    </header>
  );
}
