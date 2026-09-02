"use client";

import * as React from "react";

/**
 * Geolocalização do consumidor — só-web.
 *
 * Ponto de troca para o app nativo: no React Native isto vira
 * `expo-location` (ou equivalente) com o MESMO contrato — pedir
 * permissão explícita, devolver lat/lng só em memória, nunca persistir.
 * Coordenada exata NÃO vai para URL, log, analytics nem servidor.
 *
 * Precedente de isolamento: `password-input.tsx`, `campo-imagem.tsx`.
 */

export type EstadoGeo =
  | { status: "idle" }
  | { status: "pendente" }
  | { status: "ok"; lat: number; lng: number }
  | { status: "negado" }
  | { status: "indisponivel" };

export function pedirLocalizacaoDispositivo(): Promise<EstadoGeo> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ status: "indisponivel" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          status: "ok",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) resolve({ status: "negado" });
        else resolve({ status: "indisponivel" });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export function useLocalizacaoDispositivo() {
  const [estado, setEstado] = React.useState<EstadoGeo>({ status: "idle" });

  const pedir = React.useCallback(async () => {
    setEstado({ status: "pendente" });
    const prox = await pedirLocalizacaoDispositivo();
    setEstado(prox);
    return prox;
  }, []);

  return { estado, pedir };
}
