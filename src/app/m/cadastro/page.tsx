"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/field";

export default function CadastroPage() {
  const router = useRouter();
  const [cpf, setCpf] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [celular, setCelular] = React.useState("");
  const [nascimento, setNascimento] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [promo, setPromo] = React.useState("");
  const [aceito, setAceito] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState(false);

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const supabase = createClient();
    // Dados de perfil vão em options.data (user_metadata) — o trigger
    // handle_new_user copia p/ profiles. Papel NUNCA vai por aqui.
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
          cpf: cpf.trim(),
          telefone: celular.trim(),
          nascimento, // yyyy-mm-dd do input type=date (validado no trigger)
        },
      },
    });
    if (error) {
      setCarregando(false);
      setErro(
        error.message.includes("already registered")
          ? "Este e-mail já está cadastrado. Faça login."
          : error.message.toLowerCase().includes("password")
            ? "A senha precisa ter pelo menos 6 caracteres."
            : "Não foi possível concluir o cadastro. Tente novamente.",
      );
      return;
    }
    // Confirmação de e-mail desligada no ambiente local: a sessão já
    // existe aqui e o fluxo segue direto para o onboarding.
    router.push("/m/onboarding");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-start p-5">
      <form
        onSubmit={handleCadastro}
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
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />
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
            label="Nome Completo"
            name="nome"
            placeholder="Seu nome completo"
            autoComplete="name"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Field
            label="Celular"
            name="celular"
            type="tel"
            placeholder="(00) 00000-0000"
            autoComplete="tel"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
          />
          <Field
            label="Data de nascimento"
            name="nascimento"
            type="date"
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
          />
          <Field
            label="Senha"
            name="senha"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Field
            label="Código Promocional"
            placeholder="Ex.: PROMOFY30"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />

          {promo.trim().length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Parabéns! Seu plano VIP está ativado por 30 dias.
            </div>
          )}
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox
            checked={aceito}
            onCheckedChange={setAceito}
            className="mt-0.5"
          />
          <span>
            Li e aceito os termos de uso e política de privacidade
          </span>
        </label>

        {erro && (
          <p className="mt-4 text-center text-sm font-semibold text-danger">
            {erro}
          </p>
        )}

        <Button
          type="submit"
          variant="onYellow"
          className="mt-6 w-full"
          disabled={!aceito || carregando}
        >
          {carregando ? "Cadastrando…" : "Cadastrar"}
        </Button>

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
