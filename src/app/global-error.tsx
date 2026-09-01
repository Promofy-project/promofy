"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertCircle } from "lucide-react";

/**
 * Boundary da RAIZ do App Router. Os segmentos `/m`, `/e`, `/portal` e
 * `/admin` já têm `error.tsx`. Este arquivo cobre falha no `layout.tsx`
 * raiz — sem ele o Next mostra a página genérica e o Sentry avisa
 * `global-error.js` ausente.
 *
 * Precisa de `<html>` e `<body>` próprios: o root layout não envolve
 * este componente.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f6fb",
          color: "#14141f",
        }}
      >
        <div style={{ maxWidth: 280, textAlign: "center", padding: 20 }}>
          <div
            style={{
              margin: "0 auto",
              width: 56,
              height: 56,
              display: "grid",
              placeItems: "center",
              borderRadius: 16,
              background: "#fee2e2",
              color: "#b91c1c",
            }}
          >
            <AlertCircle aria-hidden width={28} height={28} />
          </div>
          <h1 style={{ marginTop: 16, fontSize: 18 }}>Não foi possível carregar</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#5b5b70" }}>
            Ocorreu um erro inesperado. Tente novamente.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              height: 44,
              width: "100%",
              border: 0,
              borderRadius: 12,
              background: "#1414DC",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
