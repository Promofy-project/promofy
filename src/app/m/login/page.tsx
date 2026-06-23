"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";

export default function LoginPage() {
  const router = useRouter();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    // mock — sem auth real
    router.push("/m");
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
          <Field label="E-mail" type="email" placeholder="seu@email.com" autoComplete="email" />
          <Field label="Senha" type="password" placeholder="••••••••" autoComplete="current-password" />
        </div>

        <Button type="submit" variant="onYellow" className="mt-7 w-full">
          Login
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
