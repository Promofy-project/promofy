"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setCarregando(false);
      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar agora. Tente novamente.",
      );
      return;
    }
    router.push("/m");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-5">
      <form
        onSubmit={handleLogin}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Senha"
            name="senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        {erro && (
          <p className="mt-4 text-center text-sm font-semibold text-danger">
            {erro}
          </p>
        )}

        <Button
          type="submit"
          variant="onYellow"
          className="mt-7 w-full"
          disabled={carregando}
        >
          {carregando ? "Entrando…" : "Login"}
        </Button>

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
