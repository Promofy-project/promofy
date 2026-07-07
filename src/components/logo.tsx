/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

export function Logo({
  className,
  variant = "default",
}: {
  className?: string;
  /** "default" = logo azul (fundos claros) · "light" = logo amarelo (fundos escuros) */
  variant?: "default" | "light";
}) {
  const src =
    variant === "light"
      ? "/lp/marca/logo-promofy-amarelo.png"
      : "/lp/marca/logo-promofy-azul.png";

  return <img src={src} alt="Promofy" className={cn("h-8 w-auto", className)} />;
}
