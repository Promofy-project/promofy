"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const secoes = [
  { id: "categoria", label: "Categoria", opcoes: ["Todos", "Alimentação", "Lazer", "Compras", "Serviços"] },
  { id: "localizacao", label: "Localização", opcoes: ["Todos", "Perto de mim", "Cidade toda", "Regiões próximas"] },
  { id: "promocao", label: "Promoção", opcoes: ["Todos", "Desconto direto", "2 por 1", "Brinde grátis"] },
  { id: "frequencia", label: "Frequência de uso", opcoes: ["Todos", "Diária", "Semanal", "Mensal"] },
  { id: "valor", label: "Valor de compra (mínimo)", opcoes: ["Todos", "Até R$ 50", "R$ 50 – R$ 150", "Acima de R$ 150"] },
  { id: "relevancia", label: "Por relevância ou afinidade", opcoes: ["Todos", "Relevância", "Afinidade", "Mais recentes"] },
];

export default function FiltrosPage() {
  const [aberta, setAberta] = React.useState<string | null>(null);
  const [selecao, setSelecao] = React.useState<Record<string, string>>(
    Object.fromEntries(secoes.map((s) => [s.id, "Todos"])),
  );

  return (
    <div className="flex min-h-full flex-col">
      {/* Header amarelo */}
      <header className="flex items-center gap-2 px-3 py-4">
        <Link
          href="/m"
          aria-label="Voltar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-black/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-lg font-extrabold uppercase tracking-wide text-foreground">
          Filtros
        </h1>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>

      {/* Seções */}
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-2">
        {secoes.map((s) => {
          const open = aberta === s.id;
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
            >
              <button
                type="button"
                onClick={() => setAberta(open ? null : s.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left"
              >
                <span className="text-sm font-bold text-foreground">
                  {s.label}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  {selecao[s.id]}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </span>
              </button>

              {open && (
                <ul className="border-t border-border">
                  {s.opcoes.map((op) => {
                    const sel = selecao[s.id] === op;
                    return (
                      <li key={op}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelecao((prev) => ({ ...prev, [s.id]: op }))
                          }
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted",
                            sel ? "font-semibold text-primary" : "text-foreground",
                          )}
                        >
                          {op}
                          {sel && <Check className="h-4 w-4" strokeWidth={3} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 bg-gradient-to-t from-yellow via-yellow to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Button asChild variant="onYellow" className="w-full" size="lg">
          <Link href="/m">Aplicar</Link>
        </Button>
      </div>
    </div>
  );
}
