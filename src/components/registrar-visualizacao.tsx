"use client";

import * as React from "react";

import { registrarEventoAction } from "@/lib/actions/cupons";

/**
 * Componente invisível: registra o evento de 'visualizacao' do cupom ao
 * montar (abrir o detalhe). Fica num client component para o
 * /m/cupom/[id] continuar renderizando estático — o evento nunca é
 * disparado no render do servidor. O servidor faz dedup (1/dia) e ignora
 * anônimo, então chamar sempre é seguro.
 */
export function RegistrarVisualizacao({ cupomId }: { cupomId: string }) {
  React.useEffect(() => {
    void registrarEventoAction(cupomId, "visualizacao");
  }, [cupomId]);
  return null;
}
