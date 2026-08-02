"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";

import type { CategoriaFiltro } from "@/lib/data/categorias";
import { DIAS_SEMANA } from "@/lib/dias";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TODOS = "Todos";

/**
 * Corpo client dos filtros. Só guarda a seleção; quem filtra é o /m/buscar
 * (e, para a categoria, a consulta no servidor). "Aplicar" LEVA a seleção —
 * antes era um <Link href="/m"> que a jogava fora.
 */
export function FiltrosClient({
  categorias,
  catInicial,
  diaHoje,
  diaInicial,
}: {
  categorias: CategoriaFiltro[];
  catInicial?: string;
  diaHoje: string;
  diaInicial?: string;
}) {
  const router = useRouter();
  const [aberta, setAberta] = React.useState<string | null>(null);
  const [cat, setCat] = React.useState<string>(catInicial ?? TODOS);
  const [dia, setDia] = React.useState<string>(diaInicial ?? TODOS);

  const labelCat =
    cat === TODOS ? TODOS : (categorias.find((c) => c.id === cat)?.label ?? TODOS);

  const secoes = [
    {
      id: "categoria",
      label: "Categoria",
      valorLabel: labelCat,
      opcoes: [
        { valor: TODOS, label: TODOS },
        ...categorias.map((c) => ({ valor: c.id, label: c.label })),
      ],
      selecionado: cat,
      selecionar: setCat,
    },
    {
      id: "diaSemana",
      label: "Dia da semana",
      valorLabel: dia,
      opcoes: [
        { valor: TODOS, label: TODOS },
        ...DIAS_SEMANA.map((d) => ({
          valor: d,
          label: d === diaHoje ? `${d} (hoje)` : d,
        })),
      ],
      selecionado: dia,
      selecionar: setDia,
    },
  ];

  const aplicar = () => {
    const params = new URLSearchParams();
    if (cat !== TODOS) params.set("cat", cat);
    if (dia !== TODOS) params.set("dia", dia);
    const qs = params.toString();
    router.push(qs ? `/m/buscar?${qs}` : "/m/buscar");
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* Header amarelo */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-yellow/90 px-3 py-4 backdrop-blur">
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
                  {s.valorLabel}
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
                    const sel = s.selecionado === op.valor;
                    return (
                      <li key={op.valor}>
                        <button
                          type="button"
                          onClick={() => s.selecionar(op.valor)}
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted",
                            sel ? "font-semibold text-primary" : "text-foreground",
                          )}
                        >
                          {op.label}
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

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Mais filtros (localização, tipo de promoção e afinidade) chegam com a
          nova organização de segmentos e categorias.
        </p>
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 bg-gradient-to-t from-yellow via-yellow to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Button variant="onYellow" className="w-full" size="lg" onClick={aplicar}>
          Aplicar
        </Button>
      </div>
    </div>
  );
}
