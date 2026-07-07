"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { User, Store, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Opcao {
  id: "consumidor" | "estabelecimento";
  label: string;
  href: string;
  icon: LucideIcon;
}

const OPCOES: Opcao[] = [
  { id: "consumidor", label: "Consumidor", href: "/para-voce", icon: User },
  {
    id: "estabelecimento",
    label: "Estabelecimento",
    href: "/para-empresas",
    icon: Store,
  },
];

/**
 * Tela "Você quer acessar como?" — card branco sobre fundo bg-navy.
 * A seleção destaca a opção (estado local); "Cadastrar" navega para a LP.
 */
export function AcessoChooser() {
  const router = useRouter();
  const [sel, setSel] = React.useState<Opcao["id"]>("consumidor");
  const selecionado = OPCOES.find((o) => o.id === sel) ?? OPCOES[0];

  return (
    <section className="bg-navy">
      <div className="mx-auto flex max-w-3xl justify-center px-4 py-16 sm:px-6 lg:py-24">
        <div className="w-full max-w-xl rounded-card bg-surface p-6 text-center shadow-2xl sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Você quer acessar como?
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A plataforma que transforma ofertas exclusivas em experiências
            incríveis e economia de verdade!
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            {OPCOES.map((o) => {
              const Icon = o.icon;
              const ativo = sel === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSel(o.id)}
                  aria-pressed={ativo}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-card border-2 px-4 py-7 transition-colors",
                    ativo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground hover:border-primary/40",
                  )}
                >
                  <Icon className="h-9 w-9" strokeWidth={1.75} />
                  <span className="text-sm font-bold">{o.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => router.push(selecionado.href)}
          >
            Cadastrar
          </Button>
        </div>
      </div>
    </section>
  );
}
