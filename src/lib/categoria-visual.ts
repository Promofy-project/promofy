// ============================================================
// Categoria — visual (ícone + gradiente) sourced do catálogo real
// (public.categorias). Módulo puro: sem `server-only`, sem `Intl`, sem
// DOM — importável tanto pelo Next quanto por um futuro app RN.
// ============================================================

export interface CategoriaVisual {
  id: string;
  label: string;
  /** lucide-react icon name, mapeado a um componente na UI layer. */
  icon: string;
  /** CSS gradient usado em placeholders + avatares de categoria. */
  gradiente: string;
}

/**
 * Fallback de TOLERÂNCIA VISUAL — nunca de negócio. Aparece quando um id de
 * categoria não está (ainda) no catálogo carregado: dado em transição,
 * categoria nova, ou falha de leitura. Nunca vira opção de cadastro.
 */
export const CATEGORIA_VISUAL_FALLBACK: CategoriaVisual = {
  id: "",
  label: "Categoria",
  icon: "Ticket",
  gradiente: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
};

/** Lookup tolerante: id fora do catálogo → fallback, nunca undefined/throw. */
export function resolverCategoriaVisual(
  id: string,
  catalogo: readonly CategoriaVisual[],
): CategoriaVisual {
  return catalogo.find((c) => c.id === id) ?? CATEGORIA_VISUAL_FALLBACK;
}
