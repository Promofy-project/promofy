"use client";

import * as React from "react";
import {
  X,
  Copy,
  Check,
  MapPin,
  CalendarClock,
  Store,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";

import { getCupom } from "@/lib/mock-data";
import {
  formatBRLValue,
  formatDistance,
  formatShortDate,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrFake } from "@/components/qr-fake";
import { useCouponState } from "@/components/coupon-state-provider";

/**
 * Cupom ATIVO em tela cheia (overlay no nível do aparelho, como o SideMenu).
 * Mostra QR + código + identidade real do usuário para a conferência no
 * balcão. A validação acontece de verdade no portal do estabelecimento —
 * aqui fazemos polling (5s) e, quando o servidor marca 'validado', o NPS
 * abre sozinho.
 */
export function CupomAtivoSheet() {
  const { sheetId, getEstado, usuario, fecharCupomAtivo, consultarCupom, abrirNps } =
    useCouponState();
  const [copiado, setCopiado] = React.useState(false);

  React.useEffect(() => setCopiado(false), [sheetId]);

  const estadoAtual = sheetId ? getEstado(sheetId) : null;
  const statusAtual = estadoAtual?.status;

  // Polling enquanto o cupom estiver ATIVO e a tela aberta. Pausa com a
  // aba oculta; o servidor decide a expiração (o cliente nunca compara datas).
  React.useEffect(() => {
    if (!sheetId || statusAtual !== "ativo") return;
    let vivo = true;
    const tick = () => {
      if (!vivo || document.hidden) return;
      void consultarCupom(sheetId);
    };
    const t = window.setInterval(tick, 5000);
    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, [sheetId, statusAtual, consultarCupom]);

  if (!sheetId) return null;
  const cupom = getCupom(sheetId);
  const estado = estadoAtual;
  if (!cupom || !estado) return null;

  const validado = estado.status === "validado";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(estado.codigo);
    } catch {
      /* clipboard pode estar indisponível — feedback visual mesmo assim */
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-3">
        <button
          type="button"
          onClick={fecharCupomAtivo}
          aria-label="Fechar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-bold">Seu cupom</h1>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>

      {/* Conteúdo rolável */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 pt-5">
        {/* Selo */}
        <div className="flex flex-col items-center text-center">
          <Badge variant="success" className="gap-1.5 px-3 py-1 text-sm">
            <BadgeCheck className="h-4 w-4" />
            {validado ? "Cupom utilizado" : "Cupom ativado"}
          </Badge>
          <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
            {validado
              ? "Este cupom já foi validado pelo estabelecimento."
              : "Mostre o QR Code ou informe o código no caixa."}
          </p>
        </div>

        {/* Ticket: QR + código */}
        <div className="mt-5 rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="mx-auto aspect-square w-full max-w-[208px] rounded-xl bg-white p-2.5 ring-1 ring-border">
            <QrFake value={estado.codigo} />
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Código do cupom
          </p>
          <p className="mt-1 text-center font-mono text-2xl font-extrabold tracking-[0.12em] text-foreground">
            {estado.codigo}
          </p>
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copiar}
              aria-live="polite"
            >
              {copiado ? (
                <>
                  <Check className="h-4 w-4 text-success" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar código
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Identidade p/ conferência manual */}
        <div className="mt-4 rounded-card border border-border bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Conferência de identidade
          </div>
          <dl className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">Nome</dt>
              <dd className="text-sm font-bold text-foreground">
                {usuario?.nome || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">CPF</dt>
              <dd className="font-mono text-sm font-bold text-foreground">
                {usuario?.cpfMascarado || "***"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Apresente um documento para a conferência no balcão.
          </p>
        </div>

        {/* Resumo do cupom */}
        <div className="mt-4 rounded-card border border-border bg-surface p-4 shadow-card">
          <h2 className="text-sm font-bold leading-snug">{cupom.titulo}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{cupom.beneficio}</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Store className="h-4 w-4 shrink-0" />
              {cupom.estabelecimento}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {formatDistance(cupom.distanciaKm)}
            </span>
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Válido até {formatShortDate(cupom.validade)}
            </span>
          </div>
          <p className="mt-3 inline-flex w-fit items-center rounded-md bg-yellow-soft px-2 py-1 text-sm font-extrabold text-[#8a6d0b]">
            Economize R$ {formatBRLValue(cupom.economia)}
          </p>
        </div>
      </div>

      {/* Rodapé */}
      <div className="border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {validado ? (
          estado.nps === null ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => abrirNps(sheetId)}
            >
              Avaliar experiência
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-2 py-1.5 text-sm font-bold text-success">
              <BadgeCheck className="h-5 w-5" />
              Cupom utilizado
            </p>
          )
        ) : (
          <p className="py-1.5 text-center text-sm font-medium text-muted-foreground">
            Aguardando validação do estabelecimento…
          </p>
        )}
      </div>
    </div>
  );
}
