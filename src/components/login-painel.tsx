"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";

const CONFIG = {
  portal: {
    titulo: "Portal do estabelecimento",
    subtitulo: "Acesse com a conta do seu estabelecimento.",
    papel: "lojista",
    destino: "/portal",
  },
  admin: {
    titulo: "Painel administrativo",
    subtitulo: "Acesso restrito à equipe Promofy.",
    papel: "admin",
    destino: "/admin",
  },
} as const;

/**
 * Tela de login do portal/admin (Fase 1). Após autenticar, confere o
 * papel em profiles — conta de outro papel é deslogada com aviso.
 * O redirect final é reforçado pelo middleware (fronteira de UX);
 * a fronteira de segurança real é o RLS.
 */
export function LoginPainel({ variant }: { variant: keyof typeof CONFIG }) {
  const { titulo, subtitulo, papel, destino } = CONFIG[variant];
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error || !data.user) {
      setCarregando(false);
      setErro(
        error?.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar agora. Tente novamente.",
      );
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.role !== papel) {
      await supabase.auth.signOut();
      setCarregando(false);
      setErro("Esta conta não tem acesso a esta área.");
      return;
    }

    router.push(destino);
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-5">
      <form
        onSubmit={handleLogin}
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

        <Button type="submit" className="mt-7 w-full" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
