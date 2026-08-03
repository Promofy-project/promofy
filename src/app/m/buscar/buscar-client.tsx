"use client";

import * as React from "react";
import { Search, ArrowDownUp, SearchX } from "lucide-react";

import type { Cupom } from "@/lib/types";
import type { CategoriaFiltro } from "@/lib/data/categorias";
import { DIAS_SEMANA, cupomDisponivelNoDia } from "@/lib/dias";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CouponListItem } from "@/components/coupon-list-item";
import { CupomSeloUtilizado } from "@/components/cupom-selo-utilizado";

const chips = ["Ordenar", "Mais próximos", "Maior economia", "Melhor avaliados"];

/**
 * Corpo client da busca (Fase 4): os cupons chegam do banco via server
 * component e o filtro por dia da semana roda aqui. `diaHoje` é calculado
 * NO SERVIDOR (BRT) — o client na Vercel roda em UTC e marcaria o dia
 * errado à noite.
 *
 * Fase 6/H5: aceita a seleção inicial vinda do "Aplicar" de /m/filtros
 * (`?cat=`/`?dia=`, já saneados no server component) e filtra por
 * categoria com o mesmo shape do filtro de dia.
 */
export function BuscarClient({
  cupons,
  diaHoje,
  categorias = [],
  catInicial,
  diaInicial,
}: {
  cupons: Cupom[];
  diaHoje: string;
  categorias?: CategoriaFiltro[];
  catInicial?: string;
  diaInicial?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [chip, setChip] = React.useState("Ordenar");
  const [dia, setDia] = React.useState<string>(diaInicial ?? "Todos");
  const [cat, setCat] = React.useState<string>(catInicial ?? "Todos");

  const termo = query.trim().toLowerCase();
  const resultados = cupons
    .filter(
      (c) =>
        !termo ||
        c.titulo.toLowerCase().includes(termo) ||
        c.estabelecimento.toLowerCase().includes(termo),
    )
    .filter((c) => cat === "Todos" || c.categoria === cat)
    .filter((c) => dia === "Todos" || cupomDisponivelNoDia(c.dias, dia));

  const labelCat =
    cat === "Todos" ? null : (categorias.find((c) => c.id === cat)?.label ?? cat);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-extrabold">Pesquisar</h1>

      {/* Campo de busca (borda azul) */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquise cupom..."
          className="h-12 rounded-xl border-2 border-primary pl-10"
        />
      </div>

      {/* Chips / ordenar */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {chips.map((c, i) => {
          const selected = chip === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {i === 0 && <ArrowDownUp className="h-3.5 w-3.5" />}
              {c}
            </button>
          );
        })}
      </div>

      {/* Filtro por categoria (Fase 6) — só aparece quando há categorias */}
      {categorias.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {[{ id: "Todos", label: "Todas" }, ...categorias].map((c) => {
            const selected = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filtro por dia da semana (Fase 4) */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {["Todos", ...DIAS_SEMANA].map((d) => {
          const selected = dia === d;
          const hoje = d === diaHoje;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
              {hoje && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase",
                    selected ? "text-primary-foreground/80" : "text-primary",
                  )}
                >
                  hoje
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Resultados */}
      {resultados.length > 0 ? (
        <div className="flex flex-col gap-3">
          {resultados.map((c) => (
            <CouponListItem
              key={c.id}
              cupom={c}
              href={`/m/cupom/${c.id}`}
              overlay={<CupomSeloUtilizado cupomId={c.id} variante="lista" />}
            />
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-card border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <div className="max-w-[240px]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <SearchX className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-bold">Nenhum cupom encontrado</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {termo
                ? `Não encontramos resultados para “${query}”. Tente outro termo de busca.`
                : labelCat
                  ? `Nenhum cupom de “${labelCat}”${dia !== "Todos" ? ` em “${dia}”` : ""}. Tente outro filtro.`
                  : `Nenhum cupom disponível em “${dia}”. Tente outro dia.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
