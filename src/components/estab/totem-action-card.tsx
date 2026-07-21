"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cartão de ação "modo totem" (ícone + rótulo + seta), inspirado na tela
 * "Gerenciar cupom" das referências. Alvo grande (≥64px) para uso de balcão.
 * `variant="primary"` = ação dominante (azul sólido); "surface" = card branco.
 * Reusa os tokens do design system (rounded-card, shadow-card, bg-primary).
 */
interface TotemActionCardProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "surface";
  className?: string;
}

export function TotemActionCard({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  variant = "surface",
  className,
}: TotemActionCardProps) {
  const primary = variant === "primary";

  const inner = (
    <span
      className={cn(
        "flex min-h-[72px] w-full items-center gap-4 rounded-card px-5 py-4 text-left shadow-card transition-transform active:scale-[0.99]",
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
          primary ? "bg-white/15 text-white" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-tight">{label}</span>
        {description && (
          <span
            className={cn(
              "mt-0.5 block text-sm",
              primary ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {description}
          </span>
        )}
      </span>
      <ChevronRight
        className={cn(
          "h-5 w-5 shrink-0",
          primary ? "text-white/80" : "text-muted-foreground",
        )}
      />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full">
      {inner}
    </button>
  );
}
