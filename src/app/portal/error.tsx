"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary do segmento /portal. Converte um erro de runtime em uma tela
 * visível e recuperável (em vez de falhar silenciosamente / em branco).
 * Client component, como exige o App Router.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // visível no console do navegador e nos logs da Vercel
    console.error("[portal] erro de runtime:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Algo deu errado nesta tela</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ocorreu um erro inesperado ao carregar esta seção do portal. Tente
          recarregar — seus dados de demonstração não são perdidos.
        </p>
        {error?.digest && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            ref: {error.digest}
          </p>
        )}
        <Button className="mt-5" onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
