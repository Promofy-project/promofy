"use client";

import * as React from "react";
import { useFormState } from "react-dom";

import { entrarPortalAction, entrarAdminAction } from "@/lib/actions/auth";
import { ESTADO_AUTH_INICIAL, type EstadoAuth } from "@/lib/auth-estado";
import { Logo } from "@/components/logo";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Field } from "@/components/field";

type AcaoAuth = (
  anterior: EstadoAuth,
  formData: FormData,
) => Promise<EstadoAuth>;

const CONFIG: Record<
  "portal" | "admin",
  { titulo: string; subtitulo: string; acao: AcaoAuth }
> = {
  portal: {
    titulo: "Portal do estabelecimento",
    subtitulo: "Acesse com a conta do seu estabelecimento.",
    acao: entrarPortalAction,
  },
  admin: {
    titulo: "Painel administrativo",
    subtitulo: "Acesso restrito à equipe Promofy.",
    acao: entrarAdminAction,
  },
};

/**
 * Tela de login do portal/admin (Fase 1). A conferência de papel e o destino
 * mudaram-se para a Server Action — conta de outro papel é deslogada com aviso.
 * O redirect final é reforçado pelo middleware (fronteira de UX); a fronteira
 * de segurança real é o RLS.
 *
 * A ação é escolhida por `variant` em tempo de render, e NÃO vem do formulário:
 * um campo escondido com o papel seria adulterável — não daria escalada (o
 * servidor confere o papel real em `profiles`), mas convida à confusão.
 *
 * `<form action={...}>` e não `onSubmit`: ver `src/lib/actions/auth.ts`.
 */
export function LoginPainel({ variant }: { variant: keyof typeof CONFIG }) {
  const { titulo, subtitulo, acao } = CONFIG[variant];
  const [estado, formAction] = useFormState(acao, ESTADO_AUTH_INICIAL);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-5">
      <form
        action={formAction}
        className="w-full max-w-[380px] rounded-card bg-surface p-8 shadow-card"
      >
        <div className="flex flex-col items-center text-center">
          <Logo />
          <h1 className="mt-5 text-lg font-bold">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
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

        <BotaoEnviar className="mt-7 w-full" pendente="Entrando…">
          Entrar
        </BotaoEnviar>
      </form>
    </div>
  );
}
