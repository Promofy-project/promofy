"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary do segmento /m. Como o layout agora lê do banco por
 * requisição, uma falha de rede/DB vira uma tela recuperável em vez de
 * um 500 em branco. Client component, como exige o App Router.
 */
export default function MobileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[/m] erro de runtime:", error);
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
