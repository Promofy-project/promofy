"use client";

import * as React from "react";
import { Search, ArrowDownUp, SearchX } from "lucide-react";

import type { Cupom } from "@/lib/types";
import type { CatalogoUrl, FiltroUrl } from "@/lib/taxonomia-url";
import { nomeDaFolha, nomeDoSegmento } from "@/lib/taxonomia-url";
import { DIAS_SEMANA, cupomDisponivelNoDia } from "@/lib/dias";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CouponListItem } from "@/components/coupon-list-item";
import { CupomSeloUtilizado } from "@/components/cupom-selo-utilizado";
import { FiltroTaxonomiaChips } from "@/components/filtro-taxonomia-chips";

const chips = ["Ordenar", "Mais próximos", "Maior economia", "Melhor avaliados"];

/**
 * Corpo client da busca. O filtro de taxonomia já veio do servidor
 * (`categoria_nova_id`); aqui só restam texto e dia da semana.
 */
export function BuscarClient({
  cupons,
  diaHoje,
  catalogo,
  catalogoVazio,
  filtro,
  diaInicial,
}: {
  cupons: Cupom[];
  diaHoje: string;
  catalogo: CatalogoUrl;
  catalogoVazio: boolean;
  filtro: FiltroUrl;
  diaInicial?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [chip, setChip] = React.useState("Ordenar");
  const [dia, setDia] = React.useState<string>(diaInicial ?? "Todos");

  const termo = query.trim().toLowerCase();
  const resultados = cupons
    .filter(
      (c) =>
        !termo ||
        c.titulo.toLowerCase().includes(termo) ||
        c.estabelecimento.toLowerCase().includes(termo),
    )
    .filter((c) => dia === "Todos" || cupomDisponivelNoDia(c.dias, dia));

  const labelSeg = nomeDoSegmento(filtro.seg, catalogo);
  const labelCat = nomeDaFolha(filtro, catalogo);
  const labelFiltro = labelCat ?? labelSeg;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-extrabold">Pesquisar</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquise cupom..."
          className="h-12 rounded-xl border-2 border-primary pl-10"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {chips.map((c, i) => {
          const selected = chip === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              aria-pressed={selected}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {i === 0 && <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />}
              {c}
            </button>
          );
        })}
      </div>

      {catalogoVazio ? (
        <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar os segmentos agora. A busca por texto
          continua disponível.
        </p>
      ) : (
        <FiltroTaxonomiaChips
          catalogo={catalogo}
          filtro={filtro}
          dia={dia === "Todos" ? undefined : dia}
        />
      )}

      <div
        role="group"
        aria-label="Dia da semana"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {["Todos", ...DIAS_SEMANA].map((d) => {
          const selected = dia === d;
          const hoje = d === diaHoje;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d)}
              aria-pressed={selected}
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
              <SearchX className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-base font-bold">Nenhum cupom encontrado</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {termo
                ? `Não encontramos resultados para “${query}”. Tente outro termo de busca.`
                : labelFiltro
                  ? `Nenhum cupom de “${labelFiltro}”${dia !== "Todos" ? ` em “${dia}”` : ""}. Tente outro filtro.`
                  : `Nenhum cupom disponível${dia !== "Todos" ? ` em “${dia}”` : ""}.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
