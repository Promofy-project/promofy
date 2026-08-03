import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Campo de texto multilinha — mesmas classes do `Input` (borda, raio, foco,
 * disabled), trocando a altura fixa por `min-h` + `resize-y`.
 *
 * Nasceu na Fase 6.5 para o motivo da rejeição: o admin precisa escrever
 * uma frase, não uma palavra, e o repo não tinha o primitivo.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[92px] w-full resize-y rounded-btn border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
