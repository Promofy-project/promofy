"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";

/**
 * Login do app do estabelecimento (/e). Após autenticar, confere que a
 * conta é lojista (profiles.role) — conta de outro papel é deslogada com
 * aviso. O middleware reforça o redirect (fronteira de UX); a segurança
 * real é o RLS. Destino pós-login: /e.
 */
export default function EstabLoginPage() {
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

    if (profile?.role !== "lojista") {
      await supabase.auth.signOut();
      setCarregando(false);
      setErro("Esta conta não é de um estabelecimento.");
      return;
    }

    router.push("/e");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col justify-center p-6">
      <form
        onSubmit={handleLogin}
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

        <Button type="submit" size="lg" className="mt-7 w-full" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
