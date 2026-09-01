"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary do /admin. Mesmo padrão do /m e /portal: sem stack crua
 * para o operador.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[/admin] erro de runtime:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Não foi possível carregar</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ocorreu um erro ao falar com o servidor. Tente novamente.
        </p>
        <Button className="mt-5" onClick={() => reset()}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
