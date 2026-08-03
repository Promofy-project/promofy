import Link from "next/link";
import { ArrowLeft, Plus, Pencil, AlertTriangle } from "lucide-react";

import { buscarCuponsPortal } from "@/lib/data/cupons";
import { Button } from "@/components/ui/button";
import { ReenviarCupomButton } from "@/components/estab/reenviar-cupom-button";
import { cn, formatBRLValue, formatShortDate } from "@/lib/utils";
import {
  listarPtBr,
  rotuloEconomia,
  rotulosFormasConsumo,
  rotulosTaxas,
} from "@/lib/cupom-campos";

export const dynamic = "force-dynamic";

// Rótulo + cor por status do portal (inclui 'rejeitado', tratado no Bloco C).
const STATUS: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-success-soft text-success" },
  pendente: { label: "Em análise", cls: "bg-yellow/25 text-foreground" },
  rejeitado: { label: "Rejeitado", cls: "bg-danger-soft text-danger" },
  esgotado: { label: "Esgotado", cls: "bg-muted text-muted-foreground" },
  expirado: { label: "Expirado", cls: "bg-muted text-muted-foreground" },
};

export default async function CuponsPage() {
  const { itens } = await buscarCuponsPortal();

  return (
    <div className="flex flex-1 flex-col gap-4 p-5">
      <header className="flex items-center gap-2">
        <Link
          href="/e"
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Meus cupons</h1>
      </header>

      <Button asChild size="lg" className="w-full">
        <Link href="/e/cupom/novo">
          <Plus className="h-5 w-5" />
          Novo cupom
        </Link>
      </Button>

      {itens.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Você ainda não criou cupons.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((it) => {
            const s = STATUS[it.statusPortal] ?? STATUS.ativo;
            return (
              <li
                key={it.cupom.id}
                className="rounded-card border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold leading-tight">{it.cupom.titulo}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      s.cls,
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {it.cupom.beneficio && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {it.cupom.beneficio}
                  </p>
                )}
                {/* Fase 6: o lojista vê o que cadastrou — economia (com o
                    "a partir de" quando variável), formas de consumo e as
                    taxas que ficaram de fora. Campo vazio não vira linha. */}
                <p className="mt-2 text-sm font-bold text-foreground">
                  Economia{" "}
                  {rotuloEconomia(
                    `R$ ${formatBRLValue(it.cupom.economia)}`,
                    it.cupom.economiaVariavel,
                  )}
                </p>
                {(it.cupom.formasConsumo?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {listarPtBr(rotulosFormasConsumo(it.cupom.formasConsumo ?? []))}
                  </p>
                )}
                {(it.cupom.taxas?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Não inclui{" "}
                    {listarPtBr(rotulosTaxas(it.cupom.taxas ?? [])).toLowerCase()}.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <b className="text-foreground">{it.metricas.resgates}</b>{" "}
                    resgates
                  </span>
                  <span>Validade {formatShortDate(it.cupom.validade)}</span>
                  {it.limiteUsuario == null && <span>Ilimitado por cliente</span>}
                </div>

                {/* Fase 6.5/C5 — o motivo fica junto da ação de corrigir. */}
                {it.statusPortal === "rejeitado" && it.motivoRejeicao && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    <span>
                      <b className="font-semibold">Motivo da recusa:</b>{" "}
                      {it.motivoRejeicao}
                    </span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/e/cupom/${it.cupom.id}/editar`}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Link>
                  </Button>
                  {it.statusPortal === "rejeitado" && (
                    <ReenviarCupomButton
                      cupomId={it.cupom.id}
                      titulo={it.cupom.titulo}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
