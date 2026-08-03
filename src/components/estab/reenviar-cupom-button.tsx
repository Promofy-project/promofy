"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { reenviarCupomAction } from "@/lib/actions/cupons";
import { Button } from "@/components/ui/button";

/**
 * "Reenviar para análise" no /e (Fase 6.5/C5).
 *
 * Ilha client dentro de uma página server: `/e/cupons` é server component
 * (força-dinâmica) e só este botão precisa de estado. `router.refresh()`
 * re-renderiza a lista com o status novo — sem F5 e sem duplicar a leitura
 * no cliente.
 *
 * A transição rejeitado → pendente é feita pela RPC `security definer`,
 * porque `status` não está no grant por coluna do lojista.
 */
export function ReenviarCupomButton({
  cupomId,
  titulo,
}: {
  cupomId: string;
  titulo: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function reenviar() {
    setErro(null);
    setEnviando(true);
    const r = await reenviarCupomAction(cupomId);
    setEnviando(false);
    if (r.ok) {
      router.refresh();
      return;
    }
    setErro(r.erro);
  }

  return (
    <span className="flex flex-col gap-1">
      <Button size="sm" onClick={reenviar} disabled={enviando} aria-label={`Reenviar ${titulo}`}>
        <RotateCcw className="h-4 w-4" />
        {enviando ? "Enviando…" : "Reenviar para análise"}
      </Button>
      {erro && <span className="text-xs font-medium text-danger">{erro}</span>}
    </span>
  );
}
