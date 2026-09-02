"use client";

import * as React from "react";
import Link from "next/link";
import { useFormState } from "react-dom";

import { cadastrarAction } from "@/lib/actions/auth";
import { ESTADO_AUTH_INICIAL } from "@/lib/auth-estado";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/field";

/**
 * Cadastro do consumidor.
 *
 * `<form action={...}>` e não `onSubmit`: sem a `action`, o submit antes da
 * hidratação virava GET e levava para a query string — logo, para os logs de
 * acesso — não só a senha, mas o CPF, o celular e a data de nascimento.
 * Ver `src/lib/actions/auth.ts`.
 *
 * O aceite dos termos deixou de ser apenas o `disabled` do botão (decoração,
 * removível pelo DevTools): agora é um checkbox NATIVO com `required` — que o
 * navegador barra mesmo sem JavaScript — e uma checagem no servidor, que é a
 * que de fato vale.
 */
export default function CadastroPage() {
  const [estado, formAction] = useFormState(
    cadastrarAction,
    ESTADO_AUTH_INICIAL,
  );
  const [aceito, setAceito] = React.useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-start p-5">
      <form
        action={formAction}
        className="my-2 w-full max-w-[360px] rounded-[24px] bg-surface p-7 shadow-xl"
      >
        <h1 className="text-2xl font-extrabold">Cadastre-se</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Prepare-se para desbloquear descontos exclusivos, economizar como nunca
          e aproveitar o melhor da sua cidade. Seu acesso à economia inteligente
          começa agora!
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field
            label="CPF"
            name="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
          <Field
            label="E-mail"
            name="email"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />
          <Field
            label="Nome Completo"
            name="nome"
            placeholder="Seu nome completo"
            autoComplete="name"
            required
          />
          <Field
            label="Celular"
            name="celular"
            type="tel"
            placeholder="(00) 00000-0000"
            autoComplete="tel"
          />
          <Field label="Data de nascimento" name="nascimento" type="date" />
          <Field
            label="Senha"
            name="senha"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={6}
          />
          <Field
            label="Código Promocional"
            placeholder="Em breve"
            disabled
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Código promocional em breve. Não aplicamos benefício fictício.
          </p>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox
            name="aceito"
            value="1"
            required
            checked={aceito}
            onCheckedChange={setAceito}
            className="mt-0.5"
          />
          <span>
            Li e aceito os termos de uso e política de privacidade
          </span>
        </label>

        {estado.erro && (
          <p className="mt-4 text-center text-sm font-semibold text-danger">
            {estado.erro}
          </p>
        )}

        <BotaoEnviar
          variant="onYellow"
          className="mt-6 w-full"
          pendente="Cadastrando…"
        >
          Cadastrar
        </BotaoEnviar>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/m/login" className="font-bold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
