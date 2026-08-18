import { AlertTriangle, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { getCategoria } from "@/lib/mock-data";
import { cn, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { FunnelChart } from "@/components/funnel-chart";
import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { urlPublicaImagem } from "@/lib/imagem-cupom";

const STATUS_BADGE = {
  ativo: { variant: "success" as const, label: "Ativo" },
  esgotado: { variant: "yellow-soft" as const, label: "Esgotado" },
  expirado: { variant: "danger" as const, label: "Expirado" },
  pendente: { variant: "yellow-soft" as const, label: "Em análise" },
  rejeitado: { variant: "danger" as const, label: "Rejeitado" },
  // Fase 9/C4: neutro de propósito. Excluído não é erro nem alerta — é uma
  // decisão do próprio lojista, e pintá-lo de vermelho ao lado de
  // "Rejeitado" (que é recusa da moderação) confundiria as duas coisas.
  excluido: { variant: "outline" as const, label: "Excluído" },
};

export function CouponPortalCard({
  item,
  onEditar,
  onReenviar,
  reenviando,
  onExcluir,
  excluindo,
}: {
  item: ItemCupomPortal;
  /** Fase 6.5/C2: ausente = card só de leitura (landing, seed). */
  onEditar?: (item: ItemCupomPortal) => void;
  /** Fase 6.5/C5: reenviar cupom rejeitado para moderação. */
  onReenviar?: (item: ItemCupomPortal) => void;
  reenviando?: boolean;
  /** Fase 9/C4: exclusão lógica. Ausente = o card não oferece a ação. */
  onExcluir?: (item: ItemCupomPortal) => void;
  excluindo?: boolean;
}) {
  const { cupom, statusPortal, metricas } = item;
  const categoria = getCategoria(cupom.categoria);
  const imagemUrl = urlPublicaImagem(
    cupom.imagem,
    cupom.estabelecimentoId,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const badge = STATUS_BADGE[statusPortal];
  const conversao = metricas.visualizacoes
    ? Math.round((metricas.resgates / metricas.visualizacoes) * 100)
    : 0;

  const etapas = [
    { etapa: "Visualizações", valor: metricas.visualizacoes, cor: "#1414DC" },
    { etapa: "Cliques", valor: metricas.cliques, cor: "#3A3AE6" },
    { etapa: "Ativações", valor: metricas.ativacoes, cor: "#7A7AEF" },
    { etapa: "Resgates", valor: metricas.resgates, cor: "#FAC81E" },
  ];

  return (
    <Card className={cn("p-5", statusPortal !== "ativo" && "opacity-90")}>
      <div className="flex items-start gap-3">
        {/* Miniatura: imagem real quando houver (Fase 7/C4), senão o gradiente
            da categoria — o mesmo fallback dos outros pontos de exibição. */}
        {imagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagemUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ background: categoria.gradiente }}
          >
            <Icon name={categoria.icon} className="h-6 w-6 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold leading-tight">
              {cupom.titulo}
            </h3>
            <Badge variant={badge.variant} className="shrink-0">
              {badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cupom.beneficio}
          </p>
        </div>
      </div>

      {/* 4 métricas pedidas pelo cliente */}
      <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-muted/50 p-3 text-center">
        {[
          { label: "Visualizações", valor: metricas.visualizacoes },
          { label: "Cliques", valor: metricas.cliques },
          { label: "Ativações", valor: metricas.ativacoes },
          { label: "Resgates", valor: metricas.resgates },
        ].map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="truncate text-[11px] font-medium text-muted-foreground">
              {m.label}
            </dt>
            <dd className="mt-0.5 text-base font-extrabold tabular-nums">
              {formatNumber(m.valor)}
            </dd>
          </div>
        ))}
      </dl>

      {/* Mini-funil de conversão */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">
            Funil de conversão
          </span>
          <span className="font-bold text-primary">{conversao}% resgatam</span>
        </div>
        <FunnelChart etapas={etapas} />
      </div>

      {/* Fase 6.5/C5 — o motivo da rejeição fica ao lado da ação de corrigir:
          ler o porquê e não ter onde agir seria pior do que não mostrar. */}
      {statusPortal === "rejeitado" && item.motivoRejeicao && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <span>
            <b className="font-semibold">Motivo da recusa:</b>{" "}
            {item.motivoRejeicao}
          </span>
        </p>
      )}

      {(onEditar || onReenviar || onExcluir) && statusPortal !== "excluido" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onEditar && (
            <Button size="sm" variant="outline" onClick={() => onEditar(item)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
          {onReenviar && statusPortal === "rejeitado" && (
            <Button size="sm" onClick={() => onReenviar(item)} disabled={reenviando}>
              <RotateCcw className="h-4 w-4" />
              {reenviando ? "Enviando…" : "Reenviar para análise"}
            </Button>
          )}
          {/* Excluir por último e discreto: é a ação irreversível do card
              (Fase 9/C4). Some quando o cupom JÁ está excluído — repetir a
              oferta sobre algo já feito só confunde. */}
          {onExcluir && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExcluir(item)}
              disabled={excluindo}
              className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              {excluindo ? "Excluindo…" : "Excluir"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
