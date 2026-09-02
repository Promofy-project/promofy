"use client";

import Link from "next/link";
import { Search, ChevronDown, SlidersHorizontal, MapPin } from "lucide-react";

import { hrefBusca } from "@/lib/taxonomia-url";
import { extraDeFiltro, type FiltroConsumidor } from "@/lib/filtros-consumidor";
import { Input } from "@/components/ui/input";

export function HomeSearchBar({
  cidades,
  filtro,
}: {
  cidades: string[];
  filtro: FiltroConsumidor;
}) {
  const extra = extraDeFiltro(filtro);

  return (
    <div className="flex flex-col gap-2 px-4">
      <div className="flex items-center gap-2">
        <details className="relative">
          <summary className="flex h-11 list-none cursor-pointer items-center gap-1 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            {filtro.cidade ? filtro.cidade.split(",")[0] : "Cidade"}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </summary>
          <ul className="absolute z-20 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-border bg-surface py-1 shadow-card">
            <li>
              <Link
                href={hrefBusca(
                  {},
                  extraDeFiltro({ ...filtro, cidade: undefined, bairro: undefined }),
                )}
                className="block px-3 py-2 text-sm hover:bg-muted"
              >
                Todas
              </Link>
            </li>
            {cidades.map((c) => (
              <li key={c}>
                <Link
                  href={hrefBusca({}, extraDeFiltro({ ...filtro, cidade: c, bairro: undefined }))}
                  className="block px-3 py-2 text-sm hover:bg-muted"
                >
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </details>

        <Link href="/m/buscar" className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input readOnly placeholder="Pesquisar" className="h-11 cursor-pointer pl-9" />
        </Link>

        <Link
          href={hrefBusca({}, { ...extra, base: "/m/filtros" })}
          aria-label="Filtros"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Link>
      </div>

      <Link
        href={hrefBusca({}, extraDeFiltro({ ...filtro, perto: true }))}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary"
      >
        <MapPin className="h-3.5 w-3.5" />
        Perto de mim
      </Link>
    </div>
  );
}
