"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Botão de submit que conhece o estado do `<form action={...}>` acima dele.
 *
 * Precisa ser um componente SEPARADO: `useFormStatus` só enxerga o form quando
 * é lido de dentro de um filho dele — chamado no mesmo componente que renderiza
 * o `<form>`, devolve `pending: false` para sempre.
 *
 * Sem JavaScript ele é apenas um `<button type="submit">`: o rótulo nunca troca
 * para "Entrando…", e é assim mesmo — o navegador já mostra o próprio progresso
 * de navegação.
 */
export function BotaoEnviar({
  children,
  pendente,
  ...props
}: ButtonProps & { pendente: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendente : children}
    </Button>
  );
}
