"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import type { Cupom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCouponState } from "@/components/coupon-state-provider";
import { registrarEventoAction } from "@/lib/actions/cupons";

/** Mesma frase no espelho (botão esmaecido) e na recusa do servidor. */
const FORA_DA_JANELA = "Cupom fora do intervalo de consumo.";

// Motivos do servidor → mensagem amigável.
const MENSAGEM_ERRO: Record<string, string> = {
  limite_usuario: "Você já usou este cupom.",
  esgotado: "Este cupom está esgotado.",
  fora_da_validade: "Este cupom está fora da validade.",
  fora_da_janela: FORA_DA_JANELA,
  indisponivel: "Cupom indisponível no momento.",
  nao_encontrado: "Cupom indisponível no momento.",
  sem_sessao: "Entre para usar o cupom.",
};

/**
 * Botão reativo de "usar cupom" no detalhe. Reflete o ciclo de vida do cupom:
 * disponível → ativar (abre o cupom em tela cheia) → ver ativo → utilizado.
 * Cupons 'indisponivel' (do mock-data) ficam desabilitados.
 *
 * Fase 2: a ativação acontece no SERVIDOR (RPC via Server Action), que
 * aplica todas as regras (validade, limites, estabelecimento ativo).
 * Sem sessão → /m/login. Erros viram mensagem discreta.
 */
export function CupomAcaoUsar({
  cupom,
  size = "default",
  full = false,
  className,
  foraDaJanela = false,
}: {
  cupom: Cupom;
  size?: "sm" | "lg" | "default";
  full?: boolean;
  className?: string;
  /**
   * Espelho da janela de consumo, calculado NO SERVIDOR e passado por
   * prop (nunca `new Date()` aqui: o "agora" do cliente na Vercel é UTC
   * e divergiria do BRT, quebrando a hidratação). A barreira real é a
   * RPC — se esta prop chegar velha, o servidor recusa com
   * 'fora_da_janela' e a mensagem é a mesma.
   */
  foraDaJanela?: boolean;
}) {
  const router = useRouter();
  const { logado, getStatus, ativarCupom, verCupomAtivo } = useCouponState();
  const indisponivel = cupom.status === "indisponivel";
  const status = getStatus(cupom.id);
  const width = full ? "w-full" : "";
  const [ativando, setAtivando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function handleUsar() {
    if (!logado) {
      router.push("/m/login");
      return;
    }
    setErro(null);
    setAtivando(true);
    // clique é métrica de app — fire-and-forget, não bloqueia o fluxo
    void registrarEventoAction(cupom.id, "clique");
    // o CUPOM inteiro (e não o id) vai para o provider: é o que a folha
    // renderiza. Aqui ele já veio do banco, via server component (Fase 6/H3).
    const r = await ativarCupom(cupom);
    setAtivando(false);
    if (!r.ok) {
      setErro(MENSAGEM_ERRO[r.motivo] ?? "Não foi possível usar o cupom agora.");
    }
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
        onClick={() => verCupomAtivo(cupom)}
        className={cn(width, className)}
      >
        Ver cupom ativo
      </Button>
    );
  }

  // Fora do dia/horário de consumo: esmaecido, mas AINDA CLICÁVEL —
  // `aria-disabled` em vez de `disabled`, senão o toque não dispara nada
  // e o usuário fica sem saber por que o botão não funciona.
  if (foraDaJanela) {
    return (
      <div className={cn(full ? "w-full" : "", "flex flex-col items-stretch gap-1")}>
        <Button
          size={size}
          aria-disabled
          onClick={() => setErro(FORA_DA_JANELA)}
          className={cn(width, "cursor-not-allowed opacity-50", className)}
        >
          {size === "sm" ? "Utilizar" : "Usar cupom"}
        </Button>
        {erro && (
          <p className="text-center text-xs font-medium text-danger">{erro}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn(full ? "w-full" : "", "flex flex-col items-stretch gap-1")}>
      <Button
        size={size}
        onClick={handleUsar}
        disabled={ativando}
        className={cn(width, className)}
      >
        {ativando ? "Ativando…" : size === "sm" ? "Utilizar" : "Usar cupom"}
      </Button>
      {erro && (
        <p className="text-center text-xs font-medium text-danger">{erro}</p>
      )}
    </div>
  );
}
