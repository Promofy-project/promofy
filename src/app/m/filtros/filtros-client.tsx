"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";

import type { CatalogoUrl, FiltroUrl } from "@/lib/taxonomia-url";
import {
  folhasAtivasDoSegmento,
  hrefBusca,
  nomeDaFolha,
  nomeDoSegmento,
} from "@/lib/taxonomia-url";
import { DIAS_SEMANA } from "@/lib/dias";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TODOS = "Todos";

export function FiltrosClient({
  catalogo,
  catalogoVazio,
  filtroInicial,
  diaHoje,
  diaInicial,
}: {
  catalogo: CatalogoUrl;
  catalogoVazio: boolean;
  filtroInicial: FiltroUrl;
  diaHoje: string;
  diaInicial?: string;
}) {
  const router = useRouter();
  const [aberta, setAberta] = React.useState<string | null>(null);
  const [filtro, setFiltro] = React.useState<FiltroUrl>(filtroInicial);
  const [dia, setDia] = React.useState<string>(diaInicial ?? TODOS);

  const folhas = folhasAtivasDoSegmento(filtro.seg, catalogo);
  const labelSeg = nomeDoSegmento(filtro.seg, catalogo) ?? TODOS;
  const labelCat = nomeDaFolha(filtro, catalogo) ?? "Todas as categorias";

  function escolherSeg(slug: string) {
    if (slug === TODOS) setFiltro({});
    else setFiltro({ seg: slug });
  }

  function escolherCat(slug: string) {
    if (!filtro.seg) return;
    if (slug === TODOS) setFiltro({ seg: filtro.seg });
    else setFiltro({ seg: filtro.seg, cat: slug });
  }

  const aplicar = () => {
    router.push(hrefBusca(filtro, { dia: dia === TODOS ? undefined : dia }));
  };

  return (
    <div className="flex min-h-full flex-col">
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
        {catalogoVazio ? (
          <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os segmentos agora.
          </p>
        ) : (
          <>
            <Secao
              id="segmento"
              label="Segmento"
              valorLabel={labelSeg}
              aberta={aberta === "segmento"}
              onToggle={() => setAberta(aberta === "segmento" ? null : "segmento")}
              opcoes={[
                { valor: TODOS, label: TODOS },
                ...catalogo.segmentos.map((s) => ({
                  valor: s.slug,
                  label: s.nome,
                })),
              ]}
              selecionado={filtro.seg ?? TODOS}
              selecionar={escolherSeg}
            />

            <Secao
              id="categoria"
              label="Categoria"
              valorLabel={filtro.seg ? labelCat : "Escolha um segmento"}
              aberta={aberta === "categoria"}
              onToggle={() =>
                setAberta(aberta === "categoria" ? null : "categoria")
              }
              opcoes={
                filtro.seg
                  ? [
                      { valor: TODOS, label: "Todas as categorias" },
                      ...folhas.map((f) => ({ valor: f.slug, label: f.nome })),
                    ]
                  : []
              }
              selecionado={filtro.cat ?? TODOS}
              selecionar={escolherCat}
              vazio="Primeiro escolha um segmento — as categorias aparecem em seguida."
            />
          </>
        )}

        <Secao
          id="diaSemana"
          label="Dia da semana"
          valorLabel={dia}
          aberta={aberta === "diaSemana"}
          onToggle={() => setAberta(aberta === "diaSemana" ? null : "diaSemana")}
          opcoes={[
            { valor: TODOS, label: TODOS },
            ...DIAS_SEMANA.map((d) => ({
              valor: d,
              label: d === diaHoje ? `${d} (hoje)` : d,
            })),
          ]}
          selecionado={dia}
          selecionar={setDia}
        />
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-yellow via-yellow to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Button variant="onYellow" className="w-full" size="lg" onClick={aplicar}>
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Secao({
  id,
  label,
  valorLabel,
  aberta,
  onToggle,
  opcoes,
  selecionado,
  selecionar,
  vazio,
}: {
  id: string;
  label: string;
  valorLabel: string;
  aberta: boolean;
  onToggle: () => void;
  opcoes: { valor: string; label: string }[];
  selecionado: string;
  selecionar: (v: string) => void;
  vazio?: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        aria-controls={`filtro-${id}`}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          {valorLabel}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", aberta && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {aberta && (
        <ul id={`filtro-${id}`} className="border-t border-border">
          {opcoes.length === 0 && vazio ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">{vazio}</li>
          ) : (
            opcoes.map((op) => {
              const sel = selecionado === op.valor;
              return (
                <li key={op.valor}>
                  <button
                    type="button"
                    onClick={() => selecionar(op.valor)}
                    aria-pressed={sel}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted",
                      sel ? "font-semibold text-primary" : "text-foreground",
                    )}
                  >
                    {op.label}
                    {sel && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
