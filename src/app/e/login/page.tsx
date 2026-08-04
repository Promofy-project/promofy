"use client";

import * as React from "react";
import { useFormState } from "react-dom";

import { entrarLojistaAction } from "@/lib/actions/auth";
import { ESTADO_AUTH_INICIAL } from "@/lib/auth-estado";
import { Logo } from "@/components/logo";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Field } from "@/components/field";

/**
 * Login do app do estabelecimento (/e). A conferência de papel mora agora na
 * Server Action — conta de outro papel é deslogada com aviso. O middleware
 * reforça o redirect (fronteira de UX); a segurança real é o RLS.
 *
 * `<form action={...}>` e não `onSubmit`: ver `src/lib/actions/auth.ts`.
 */
export default function EstabLoginPage() {
  const [estado, formAction] = useFormState(
    entrarLojistaAction,
    ESTADO_AUTH_INICIAL,
  );

  return (
    <div className="flex flex-1 flex-col justify-center p-6">
      <form
        action={formAction}
        className="w-full rounded-card bg-surface p-7 shadow-card"
      >
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-5 text-lg font-bold">App do estabelecimento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para validar cupons no balcão.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-4">
          <Field
            label="E-mail"
            name="email"
            type="email"
            placeholder="voce@empresa.com"
            autoComplete="email"
            required
          />
          <Field
            label="Senha"
            name="senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {estado.erro && (
          <p className="mt-4 text-center text-sm font-semibold text-danger">
            {estado.erro}
          </p>
        )}

        <BotaoEnviar size="lg" className="mt-7 w-full" pendente="Entrando…">
          Entrar
        </BotaoEnviar>
      </form>
    </div>
  );
}
