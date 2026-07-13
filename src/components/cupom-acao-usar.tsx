"use client";

import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import type { Cupom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCouponState } from "@/components/coupon-state-provider";

/**
 * Botão reativo de "usar cupom" no detalhe. Reflete o ciclo de vida do cupom:
 * disponível → ativar (abre o cupom em tela cheia) → ver ativo → utilizado.
 * Cupons 'indisponivel' (do mock-data) ficam desabilitados.
 *
 * Fase 1: usar cupom exige sessão — sem login, redireciona p/ /m/login.
 * Gate de UX apenas (getSession lê o storage local, sem rede); a fronteira
 * de segurança real é o RLS no banco. O ciclo em si segue mockado.
 */
export function CupomAcaoUsar({
  cupom,
  size = "default",
  full = false,
  className,
}: {
  cupom: Cupom;
  size?: "sm" | "lg" | "default";
  full?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { getStatus, ativarCupom, verCupomAtivo } = useCouponState();
  const indisponivel = cupom.status === "indisponivel";
  const status = getStatus(cupom.id);
  const width = full ? "w-full" : "";

  async function handleUsar() {
    let temSessao = false;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      temSessao = Boolean(data.session);
    } catch {
      // erro ao ler a sessão (ex.: stack parado) → trata como deslogado
      temSessao = false;
    }
    if (!temSessao) {
      router.push("/m/login");
      return;
    }
    ativarCupom(cupom.id);
  }

  if (indisponivel) {
    return (
      <Button size={size} variant="outline" disabled className={cn(width, className)}>
        Indisponível
      </Button>
    );
  }

  if (status === "validado") {
    return full ? (
      <div
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-btn bg-success-soft text-base font-bold text-success",
          className,
        )}
      >
        <BadgeCheck className="h-5 w-5" />
        Cupom utilizado
      </div>
    ) : (
      <Badge variant="success" className={cn("gap-1 px-3 py-1.5", className)}>
        <BadgeCheck className="h-4 w-4" />
        Utilizado
      </Badge>
    );
  }

  if (status === "ativo") {
    return (
      <Button
        size={size}
        variant="secondary"
        onClick={() => verCupomAtivo(cupom.id)}
        className={cn(width, className)}
      >
        Ver cupom ativo
      </Button>
    );
  }

  return (
    <Button
      size={size}
      onClick={handleUsar}
      className={cn(width, className)}
    >
      {size === "sm" ? "Utilizar" : "Usar cupom"}
    </Button>
  );
}
