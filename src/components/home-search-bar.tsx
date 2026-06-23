import Link from "next/link";
import { Search, ChevronDown, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";

export function HomeSearchBar() {
  return (
    <div className="flex items-center gap-2 px-4">
      {/* Seletor de cidade */}
      <button
        type="button"
        className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground"
      >
        Cidade
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Campo de busca */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Pesquisar" className="h-11 pl-9" />
      </div>

      {/* Filtro → /m/filtros */}
      <Link
        href="/m/filtros"
        aria-label="Filtros"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
      >
        <SlidersHorizontal className="h-5 w-5" />
      </Link>
    </div>
  );
}
