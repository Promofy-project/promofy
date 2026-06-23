"use client";

import { Menu } from "lucide-react";

import { Logo } from "@/components/logo";
import { useMobileFlow } from "@/components/mobile-flow-provider";

export function HomeHeader() {
  const { openMenu } = useMobileFlow();
  return (
    <header className="flex items-center px-4 pt-4">
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
