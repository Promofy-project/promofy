import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn text-sm font-semibold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-dark",
        secondary:
          "bg-yellow text-yellow-foreground shadow-sm hover:brightness-95",
        outline:
          "border border-border bg-surface text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-95",
        link: "text-primary underline-offset-4 hover:underline",
        // Botão das telas amarelas: fundo branco, borda fina, texto laranja
        onYellow:
          "border border-cta/30 bg-white text-cta shadow-sm hover:bg-cta-soft",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-md px-3 text-[13px]",
        lg: "h-12 px-7 text-base",
        // "Modo totem" (/e balcão): alvo grande (64px), texto ampliado
        xl: "h-16 px-8 text-lg font-bold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * `type` PADRÃO É `"button"`, e isso é uma decisão de segurança.
 *
 * O default do HTML é `submit`. Como este componente não definia `type`, todo
 * `<Button>` sem `type` que caísse dentro de um `<form>` virava um submit
 * acidental — em silêncio, sem erro de tipo, sem aviso.
 *
 * Custou caro na Fase 8: o botão "Buscar" do painel de validação por CPF
 * (`src/components/estab/validar-por-cpf.tsx`) vive dentro do `<form>` do
 * `/e/validar`. Clicar nele disparava a busca **e** submetia o formulário, o
 * que validava o código digitado no campo ao lado — de forma **permanente**,
 * porque a unique de `cupons_usuario` impede reativar. Um cupom de cliente
 * queimado por um clique em "Buscar".
 *
 * A inversão é segura porque submeter é a exceção e já era declarado: os
 * quatro submits do projeto dizem `type="submit"` explicitamente, incluindo o
 * `BotaoEnviar` — que é o que faz os cinco formulários de autenticação
 * funcionarem SEM JavaScript. Quem precisa submeter continua pedindo.
 *
 * LIMITE: isto cobre `<Button>`. Um `<button>` cru dentro de um form continua
 * sendo submit por default do navegador — hoje todos os do projeto declaram
 * `type`, e a suíte guarda isso.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // `asChild` delega para outro elemento (ex.: <a>), que não aceita type.
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
