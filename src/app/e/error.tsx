"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary do /e. Falha de rede/DB vira tela recuperável, não 500
 * cru. Client component, como exige o App Router.
 */
export default function EstabError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[/e] erro de runtime:", error);
  }, [error]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-5">
      <div className="max-w-xs text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Não foi possível carregar</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ocorreu um erro ao falar com o servidor. Verifique sua conexão e tente
          novamente.
        </p>
        <Button className="mt-5 w-full" onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
