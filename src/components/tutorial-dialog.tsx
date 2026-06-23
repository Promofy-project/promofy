"use client";

import { usePathname } from "next/navigation";
import { ImageIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMobileFlow } from "@/components/mobile-flow-provider";

/**
 * Pop-up de boas-vindas mostrado UMA vez ao chegar na home vindo do onboarding.
 * Renderizado dentro do PhoneFrame, então fica contido no aparelho.
 */
export function TutorialDialog() {
  const pathname = usePathname();
  const { tutorialPending, consumeTutorial } = useMobileFlow();

  if (!tutorialPending || pathname !== "/m") return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
        onClick={consumeTutorial}
      />
      <div className="animate-fade-up relative w-full max-w-[320px] rounded-[24px] bg-surface p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-extrabold">Seja Bem Vindo ao promofy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Economize em suas compras com cupons exclusivos. Veja como funciona
        </p>

        {/* Área de imagem / placeholder */}
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed border-border bg-muted/60 text-muted-foreground">
          <div className="flex flex-col items-center gap-1.5">
            <ImageIcon className="h-7 w-7" />
            <span className="text-xs">Imagem do tutorial</span>
          </div>
        </div>

        <Button className="mt-5 w-full" onClick={consumeTutorial}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
