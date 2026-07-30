"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

/**
 * Input de senha com "visualizar senha" (olho).
 *
 * Componente ÚNICO: as cinco telas de login (/m/login, /m/cadastro,
 * /e/login e o LoginPainel que serve /portal/login + /admin/login) chegam
 * aqui pelo mesmo `Field`, então nenhuma delas repete o botão.
 *
 * Fica isolado num arquivo próprio (em vez de dentro do `Field`) para o
 * `Field` continuar server-safe: /m/perfil/dados é server component e usa
 * `Field` sem senha — não deve carregar estado de cliente por causa disto.
 *
 * Só-web por natureza (`<input type>` + ícone): no app nativo isto vira um
 * TextInput com `secureTextEntry` e um Pressable — mesma ideia, outra
 * implementação. O ponto de troca é este arquivo.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  // `type` não é desestruturado: ele vem no spread e é SOBRESCRITO logo
  // abaixo pelo estado — quem manda no tipo do input é o olho, não o chamador.
  ({ className, ...props }, ref) => {
    const [visivel, setVisivel] = React.useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          // o tipo é estado, nunca vem de fora
          type={visivel ? "text" : "password"}
          // espaço para o olho não cobrir o texto digitado
          className={cn("pr-11", className)}
        />
        <button
          type="button" // nunca submete o formulário
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          aria-controls={props.id}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {visivel ? (
            <EyeOff className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Eye className="h-[18px] w-[18px]" aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
