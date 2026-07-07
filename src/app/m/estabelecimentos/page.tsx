"use client";

import * as React from "react";
import { Bell, MapPin, Ticket } from "lucide-react";

import type { Estabelecimento } from "@/lib/types";
import { estabelecimentos, getCategoria } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { CategoryChips } from "@/components/category-chips";
import { FavoriteButton } from "@/components/favorite-button";
import { StarRating } from "@/components/star-rating";
import { Icon } from "@/components/icon";

/** Sino "notificar novos cupons" — só visual, alterna on/off (protótipo). */
function NotifyBell({ nome }: { nome: string }) {
  const [on, setOn] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={
        on
          ? `Desativar avisos de novos cupons de ${nome}`
          : `Avisar sobre novos cupons de ${nome}`
      }
      onClick={() => setOn((v) => !v)}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full border shadow-sm transition hover:scale-105 active:scale-95",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground",
      )}
    >
      <Bell className={cn("h-[18px] w-[18px]", on && "fill-current")} />
    </button>
  );
}

function EstabelecimentoCard({ e }: { e: Estabelecimento }) {
  const categoria = getCategoria(e.categoria);
  return (
    <article className="flex items-start gap-3 rounded-card border border-border bg-card p-3.5 shadow-card">
      {/* Avatar da categoria */}
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={{ background: categoria.gradiente }}
      >
        <Icon name={categoria.icon} className="h-6 w-6 text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold leading-snug">{e.nome}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{categoria.label}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {e.cidade}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <StarRating rating={e.rating} />
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            <Ticket className="h-3.5 w-3.5" />
            {e.cuponsAtivos} cupons ativos
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <FavoriteButton cupomId={`est:${e.id}`} />
        <NotifyBell nome={e.nome} />
      </div>
    </article>
  );
}

export default function EstabelecimentosPage() {
  const [categoria, setCategoria] = React.useState("todos");

  const lista =
    categoria === "todos"
      ? estabelecimentos
      : estabelecimentos.filter((e) => e.categoria === categoria);

  return (
    <div className="flex flex-col">
      <MobilePageHeader title="Estabelecimentos" back="/m" />

      {/* Filtro por categoria */}
      <div className="border-b border-border px-4 py-2.5">
        <CategoryChips value={categoria} onChange={setCategoria} />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
        {lista.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhum estabelecimento nesta categoria.
          </p>
        ) : (
          lista.map((e) => <EstabelecimentoCard key={e.id} e={e} />)
        )}
      </div>
    </div>
  );
}
