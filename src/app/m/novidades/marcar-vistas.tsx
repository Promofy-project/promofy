"use client";

import * as React from "react";

import { marcarNovidadesVistasAction } from "@/lib/actions/favoritos";

/**
 * Componente invisível (padrão RegistrarVisualizacao): abrir a lista de
 * novidades marca como visto no servidor — o badge zera na próxima
 * renderização da home. Idempotente e seguro de chamar sempre.
 */
export function MarcarNovidadesVistas() {
  React.useEffect(() => {
    void marcarNovidadesVistasAction();
  }, []);
  return null;
}
