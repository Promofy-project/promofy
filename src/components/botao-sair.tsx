"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Botão de logout reutilizável nas três frentes (consumidor, portal,
 * admin). Faz signOut real no Supabase e redireciona para o login da
 * frente correspondente.
 */
export function BotaoSair({
  redirect,
  children,
  ...props
}: ButtonProps & { redirect: string }) {
  const router = useRouter();
  const [saindo, setSaindo] = React.useState(false);

  async function handleSair() {
    setSaindo(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // stack local parado etc. — segue para o login mesmo assim
    }
    router.push(redirect);
    router.refresh();
  }

  return (
    <Button onClick={handleSair} disabled={saindo} {...props}>
      {children}
    </Button>
  );
}
