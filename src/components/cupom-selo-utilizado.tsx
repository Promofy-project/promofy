"use client";

import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCouponState } from "@/components/coupon-state-provider";

/**
 * Selo "Utilizado" sobre o card/linha do cupom na home e nas listas.
 *
 * REGRA (do servidor, não daqui): aparece quando o usuário já validou o
 * cupom E não tem mais uso disponível. Com cota sobrando — ou com cupom
 * ILIMITADO — NÃO aparece: o cupom continua utilizável e marcá-lo como
 * usado seria mentira.
 *
 * Fase 6: a decisão vem pronta em `pode_reusar`, calculado por
 * `meu_estado_consumidor` com a MESMA expressão de `ativar_cupom`.
 * NUNCA voltar a decidir por `restantes` aqui: era
 * `if (uso.restantes > 0) return null`, e tanto `null > 0` (ilimitado)
 * quanto `0 > 0` dão false — o selo aparecia justamente no cupom que o
 * servidor deixaria reusar. `restantes` é dado de exibição; a condição
 * é `pode_reusar`.
 *
 * Renderiza `null` na esmagadora maioria dos cards, então o overlay não
 * cobra layout de quem não usou o cupom.
 */
export function CupomSeloUtilizado({
  cupomId,
  variante = "card",
}: {
  cupomId: string;
  /** card = grid da home · lista = linha de busca/favoritos/novidades */
  variante?: "card" | "lista";
}) {
  const { getStatus, getUsos } = useCouponState();

  if (getStatus(cupomId) !== "validado") return null;
  const uso = getUsos(cupomId);
  if (!uso || uso.pode_reusar) return null;

  return (
    <div
      // pointer-events-none: o card inteiro continua clicável (o stretched
      // link fica embaixo) — o selo é informação, não obstáculo.
      className={cn(
        "pointer-events-none absolute inset-0 z-[3] flex rounded-card bg-surface/55",
        // card: centrado sobre a thumb (h-36), como o overlay
        // "Indisponível" que já existe — não briga com o badge de
        // destaque (topo-esquerda) nem com o coração (topo-direita)
        variante === "card"
          ? "items-start justify-center pt-14"
          : "items-center justify-end p-3",
      )}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success shadow-sm">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
        Utilizado
      </span>
    </div>
  );
}
