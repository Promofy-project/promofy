"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/field";

export default function CadastroPage() {
  const router = useRouter();
  const [promo, setPromo] = React.useState("");
  const [aceito, setAceito] = React.useState(false);

  function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    router.push("/m/onboarding");
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
          <Field label="CPF" inputMode="numeric" placeholder="000.000.000-00" />
          <Field label="E-mail" type="email" placeholder="seu@email.com" />
          <Field label="Nome Completo" placeholder="Seu nome completo" />
          <Field label="Celular" type="tel" placeholder="(00) 00000-0000" />
          <Field label="Data de nascimento" type="date" />
          <Field label="Senha" type="password" placeholder="••••••••" />
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

        <Button
          type="submit"
          variant="onYellow"
          className="mt-6 w-full"
          disabled={!aceito}
        >
          Cadastrar
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
