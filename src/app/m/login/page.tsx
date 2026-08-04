"use client";

import * as React from "react";
import Link from "next/link";
import { useFormState } from "react-dom";

import { entrarConsumidorAction } from "@/lib/actions/auth";
import { ESTADO_AUTH_INICIAL } from "@/lib/auth-estado";
import { Logo } from "@/components/logo";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Field } from "@/components/field";

/**
 * Login do consumidor.
 *
 * `<form action={...}>` com Server Action, e não `onSubmit`: sem a `action` o
 * navegador faz submit nativo em GET antes da hidratação e a senha vai parar na
 * query string — e nos logs de acesso. Ver `src/lib/actions/auth.ts`.
 */
export default function LoginPage() {
  const [estado, formAction] = useFormState(
    entrarConsumidorAction,
    ESTADO_AUTH_INICIAL,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-5">
      <form
        action={formAction}
        className="w-full max-w-[340px] rounded-[24px] bg-surface p-7 shadow-xl"
      >
        <div className="flex flex-col items-center text-center">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A plataforma que transforma ofertas exclusivas em experiências
            incríveis e economia de verdade!
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-4">
          <Field
            label="E-mail"
            name="email"
            type="email"
            placeholder="seu@email.com"
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

        <BotaoEnviar
          variant="onYellow"
          className="mt-7 w-full"
          pendente="Entrando…"
        >
          Login
        </BotaoEnviar>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link
            href="/m/cadastro"
            className="font-bold text-primary hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  );
}
