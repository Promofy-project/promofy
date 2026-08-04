"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import type { AvisoDoLojista } from "@/lib/data/avisos";
import { marcarAvisoLidoAction } from "@/lib/actions/avisos";
import { cn, formatShortDate } from "@/lib/utils";

/**
 * Lista de recados (Fase 8/M1).
 *
 * Abrir MARCA COMO LIDO — é a interação que o cliente descreveu, e evita uma
 * segunda ação ("marcar como lido") que ninguém faria no balcão.
 *
 * O estado de lido é otimista na tela e confirmado no servidor. Se a chamada
 * falhar, o ponto de não-lido volta: melhor o lojista ver de novo um recado
 * que já leu do que perder um que nunca leu.
 */
export function MuralLista({ avisos }: { avisos: AvisoDoLojista[] }) {
  const router = useRouter();
  const [aberto, setAberto] = React.useState<string | null>(null);
  const [lidos, setLidos] = React.useState<Set<string>>(
    () => new Set(avisos.filter((a) => a.lido).map((a) => a.id)),
  );

  async function abrir(aviso: AvisoDoLojista) {
    const fechando = aberto === aviso.id;
    setAberto(fechando ? null : aviso.id);
    if (fechando || lidos.has(aviso.id)) return;

    setLidos((prev) => new Set(prev).add(aviso.id));
    const r = await marcarAvisoLidoAction(aviso.id);
    if (!r.ok) {
      setLidos((prev) => {
        const s = new Set(prev);
        s.delete(aviso.id);
        return s;
      });
      return;
    }
    // Atualiza o badge da bottom nav, que reconta por navegação.
    router.refresh();
  }

  return (
    <ul className="flex flex-col gap-3">
      {avisos.map((aviso) => {
        const lido = lidos.has(aviso.id);
        const expandido = aberto === aviso.id;
        return (
          <li key={aviso.id}>
            <button
              type="button"
              onClick={() => abrir(aviso)}
              aria-expanded={expandido}
              className={cn(
                "w-full rounded-card border bg-surface p-4 text-left transition-colors",
                lido ? "border-border" : "border-primary/40 bg-primary/[0.03]",
              )}
            >
              <div className="flex items-start gap-3">
                {/* Ponto de não-lido: o alvo é o cartão inteiro, não o ponto. */}
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    lido ? "bg-transparent" : "bg-primary",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-base leading-snug", lido ? "font-semibold" : "font-extrabold")}>
                    {aviso.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatShortDate(aviso.publicadoEm)}
                    {!lido && <span className="ml-2 font-semibold text-primary">Novo</span>}
                  </p>
                </div>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                    expandido && "rotate-180",
                  )}
                />
              </div>

              {expandido && (
                <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-sm leading-relaxed text-foreground">
                  {aviso.corpo}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
