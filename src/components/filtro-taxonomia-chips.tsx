"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import {
  folhasAtivasDoSegmento,
  hrefBusca,
  type CatalogoUrl,
  type FiltroUrl,
} from "@/lib/taxonomia-url";

/**
 * Filtro hierárquico SEGMENTO → CATEGORIA.
 *
 * Nunca lista as 75 folhas de uma vez: primeiro os 14 segmentos; as
 * categorias só aparecem depois que um segmento está escolhido.
 *
 * `onSelecionar` (filtros / rascunho): botões que só mudam estado local.
 * Sem callback (busca): a URL é a fonte da verdade — cada chip é um Link.
 */
export function FiltroTaxonomiaChips({
  catalogo,
  filtro,
  dia,
  onSelecionar,
  icones = false,
}: {
  catalogo: CatalogoUrl;
  filtro: FiltroUrl;
  dia?: string;
  onSelecionar?: (prox: FiltroUrl) => void;
  /** Home/busca: o ícone do catálogo viaja com o rótulo (nunca sozinho). */
  icones?: boolean;
}) {
  const folhas = folhasAtivasDoSegmento(filtro.seg, catalogo);

  function ir(prox: FiltroUrl) {
    if (onSelecionar) onSelecionar(prox);
  }

  function Chip({
    selected,
    label,
    href,
    icon,
    onClick,
  }: {
    selected: boolean;
    label: string;
    href?: string;
    icon?: string;
    onClick?: () => void;
  }) {
    const classe = cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-surface text-muted-foreground hover:text-foreground",
    );
    const corpo = (
      <>
        {icones && icon ? (
          <Icon name={icon} className="h-3.5 w-3.5" aria-hidden />
        ) : null}
        {label}
      </>
    );
    if (onSelecionar || onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          className={classe}
        >
          {corpo}
        </button>
      );
    }
    return (
      <Link
        href={href!}
        scroll={false}
        aria-pressed={selected}
        aria-current={selected ? "true" : undefined}
        className={classe}
      >
        {corpo}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="Segmento"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
      >
        <Chip
          selected={!filtro.seg}
          label="Todos"
          href={hrefBusca({}, { dia })}
          onClick={onSelecionar ? () => ir({}) : undefined}
        />
        {catalogo.segmentos.map((s) => (
          <Chip
            key={s.slug}
            selected={filtro.seg === s.slug}
            label={s.nome}
            href={hrefBusca({ seg: s.slug }, { dia })}
            onClick={
              onSelecionar
                ? () => ir(filtro.seg === s.slug ? {} : { seg: s.slug })
                : undefined
            }
          />
        ))}
      </div>

      {filtro.seg && folhas.length > 0 && (
        <div
          role="group"
          aria-label="Categoria"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
        >
          <Chip
            selected={!filtro.cat}
            label="Todas as categorias"
            href={hrefBusca({ seg: filtro.seg }, { dia })}
            onClick={onSelecionar ? () => ir({ seg: filtro.seg }) : undefined}
          />
          {folhas.map((f) => (
            <Chip
              key={f.uuid}
              selected={filtro.cat === f.slug}
              label={f.nome}
              href={hrefBusca({ seg: filtro.seg, cat: f.slug }, { dia })}
              onClick={
                onSelecionar
                  ? () =>
                      ir(
                        filtro.cat === f.slug
                          ? { seg: filtro.seg }
                          : { seg: filtro.seg, cat: f.slug },
                      )
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
