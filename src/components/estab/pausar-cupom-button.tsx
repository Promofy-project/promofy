"use client";

import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { pausarCupomAction, retomarCupomAction } from "@/lib/actions/cupons";
import { COPY_CONFIRMAR_PAUSA } from "@/lib/cupom-indicadores";

/**
 * Pausa/retoma no /e. A confirmação é `window.confirm` — só-web, mesmo
 * ponto de troca de `ExcluirCupomButton`.
 */
export function PausarCupomButton({
  cupomId,
  titulo,
  modo,
}: {
  cupomId: string;
  titulo: string;
  modo: "pausar" | "retomar";
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function agir() {
    if (modo === "pausar") {
      const ok = window.confirm(`Pausar “${titulo}”?\n\n${COPY_CONFIRMAR_PAUSA}`);
      if (!ok) return;
    }
    setBusy(true);
    const r =
      modo === "pausar"
        ? await pausarCupomAction(cupomId)
        : await retomarCupomAction(cupomId);
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <Button size="sm" variant={modo === "pausar" ? "outline" : "default"} onClick={agir} disabled={busy}>
      {modo === "pausar" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {busy ? (modo === "pausar" ? "Pausando…" : "Retomando…") : modo === "pausar" ? "Pausar" : "Retomar"}
    </Button>
  );
}
