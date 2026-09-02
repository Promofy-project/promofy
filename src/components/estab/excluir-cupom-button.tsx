"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { excluirCupomAction } from "@/lib/actions/cupons";
import { Button } from "@/components/ui/button";

/**
 * Exclusão lógica no /e. Ilha client: a lista é server component.
 * Confirmação via `window.confirm` — ponto de troca nativo, igual ao portal.
 */
export function ExcluirCupomButton({
  cupomId,
  titulo,
}: {
  cupomId: string;
  titulo: string;
}) {
  const router = useRouter();
  const [excluindo, setExcluindo] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function excluir() {
    const ok = window.confirm(
      `Excluir “${titulo}”?\n\n` +
        "O cupom sai do app. Os resgates, as avaliações e os números que ele já gerou continuam no histórico.",
    );
    if (!ok) return;
    setErro(null);
    setExcluindo(true);
    const r = await excluirCupomAction(cupomId);
    setExcluindo(false);
    if (r.ok) {
      router.refresh();
      return;
    }
    setErro(r.erro);
  }

  return (
    <span className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void excluir()}
        disabled={excluindo}
        className="text-danger hover:bg-danger-soft hover:text-danger"
        aria-label={`Excluir ${titulo}`}
      >
        <Trash2 className="h-4 w-4" />
        {excluindo ? "Excluindo…" : "Excluir"}
      </Button>
      {erro && <span className="text-xs font-medium text-danger">{erro}</span>}
    </span>
  );
}
