/**
 * Contrato público da taxonomia 14×75 — SEGMENTO → CATEGORIA.
 *
 * MÓDULO PURO: sem `server-only`, sem DOM, sem `Intl`. Importável pelo
 * Next e por um futuro app RN. A autoridade do catálogo continua nas
 * views (`catalogo_segmentos`, `catalogo_folhas`, `folha_para_segmento`);
 * este arquivo só NORMALIZA a URL e traduz slug → UUID. Não contém a
 * lista de 14×75.
 *
 * URL canônica:
 *   /m/buscar?seg=alimentacao
 *   /m/buscar?seg=alimentacao&cat=pizzaria
 *
 * Legado (Marco 2): `?cat=<segmento-slug>` ainda é compreendido e
 * canonicaliza para `?seg=<segmento-slug>`. UUID nunca entra na URL
 * pública — se chegar, é ignorado.
 */

export interface SegmentoUrl {
  slug: string;
  nome: string;
}

export interface FolhaUrl {
  uuid: string;
  slug: string;
  nome: string;
  segmentoSlug: string;
  /** Folha E segmento ativos — o que a UI oferece para NOVA seleção. */
  ativo: boolean;
}

export interface CatalogoUrl {
  /** Segmentos ATIVOS, na ordem de produto. */
  segmentos: SegmentoUrl[];
  /** Todas as folhas (histórico incluso) — resolução de URL e de filtro. */
  folhas: FolhaUrl[];
}

export interface FiltroUrl {
  seg?: string;
  cat?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: string): boolean {
  return UUID_RE.test(valor.trim());
}

function limpar(valor: string | undefined): string | undefined {
  const t = valor?.trim();
  if (!t || ehUuid(t)) return undefined;
  return t;
}

export function montarCatalogoUrl(args: {
  segmentos: { slug: string | null; nome: string | null }[];
  folhas: {
    categoria_id: string | null;
    slug: string | null;
    nome: string | null;
    segmento_slug: string | null;
    ativo?: boolean | null;
    segmento_ativo?: boolean | null;
  }[];
}): CatalogoUrl {
  const segmentos: SegmentoUrl[] = args.segmentos.flatMap((s) =>
    s.slug && s.nome ? [{ slug: s.slug, nome: s.nome }] : [],
  );
  const folhas: FolhaUrl[] = args.folhas.flatMap((f) =>
    f.categoria_id && f.slug && f.nome && f.segmento_slug
      ? [
          {
            uuid: f.categoria_id,
            slug: f.slug,
            nome: f.nome,
            segmentoSlug: f.segmento_slug,
            ativo: (f.ativo ?? true) && (f.segmento_ativo ?? true),
          },
        ]
      : [],
  );
  return { segmentos, folhas };
}

function segmentoConhecido(slug: string, catalogo: CatalogoUrl): boolean {
  return catalogo.segmentos.some((s) => s.slug === slug);
}

function folhasDoSlug(slug: string, catalogo: CatalogoUrl): FolhaUrl[] {
  return catalogo.folhas.filter((f) => f.slug === slug);
}

/**
 * Estado válido da URL pública.
 *
 * - `?cat=alimentacao` (slug de segmento, sem `seg`) → `{ seg: alimentacao }`
 * - `?cat=pizzaria` (slug de folha único) → `{ seg, cat }`
 * - slug de folha AMBÍGUO (ex.: `esportes` em fitness e educação) sem
 *   `seg` → descarta o filtro, não adivinha
 * - `seg` + `cat` de outro segmento → mantém o segmento, solta a categoria
 * - UUID → ignorado
 */
export function normalizarFiltroUrl(
  input: FiltroUrl,
  catalogo: CatalogoUrl,
): FiltroUrl {
  const segIn = limpar(input.seg);
  const catIn = limpar(input.cat);

  const seg = segIn && segmentoConhecido(segIn, catalogo) ? segIn : undefined;

  // Legado Marco 2: `?cat=<segmento>` sem `seg`.
  if (!seg && catIn && segmentoConhecido(catIn, catalogo)) {
    return { seg: catIn };
  }

  // `?cat=` como folha, sem segmento: só resolve se o slug for único.
  if (!seg && catIn) {
    const hits = folhasDoSlug(catIn, catalogo);
    if (hits.length === 1) return { seg: hits[0].segmentoSlug, cat: hits[0].slug };
    return {};
  }

  if (!seg) return {};

  if (!catIn) return { seg };

  const folha = catalogo.folhas.find(
    (f) => f.slug === catIn && f.segmentoSlug === seg,
  );
  if (!folha) return { seg };
  return { seg, cat: folha.slug };
}

export function precisaCanonicalizar(bruto: FiltroUrl, canon: FiltroUrl): boolean {
  const bSeg = limpar(bruto.seg) ?? "";
  const bCat = limpar(bruto.cat) ?? "";
  // UUID na entrada também precisa sair da barra de endereço.
  const tinhaUuid = Boolean(
    (bruto.seg && ehUuid(bruto.seg)) || (bruto.cat && ehUuid(bruto.cat)),
  );
  const cSeg = canon.seg ?? "";
  const cCat = canon.cat ?? "";
  return tinhaUuid || bSeg !== cSeg || bCat !== cCat;
}

export function hrefBusca(
  filtro: FiltroUrl,
  extra?: { dia?: string },
): string {
  const p = new URLSearchParams();
  if (filtro.seg && !ehUuid(filtro.seg)) p.set("seg", filtro.seg);
  if (filtro.cat && !ehUuid(filtro.cat)) p.set("cat", filtro.cat);
  if (extra?.dia) p.set("dia", extra.dia);
  const q = p.toString();
  return q ? `/m/buscar?${q}` : "/m/buscar";
}

/**
 * UUIDs para o predicado `cupons.categoria_nova_id`.
 *
 * `null`  → sem filtro de taxonomia (catálogo inteiro)
 * `[]`    → filtro válido que não casa nada (não vira "mostra tudo")
 * `[…]`   → folhas do segmento, ou a folha específica
 *
 * Inclui folha inativa: cupom histórico continua aparecendo no segmento.
 */
export function idsParaConsulta(
  filtro: FiltroUrl,
  catalogo: CatalogoUrl,
): string[] | null {
  const n = normalizarFiltroUrl(filtro, catalogo);
  if (!n.seg) return null;
  if (n.cat) {
    const folha = catalogo.folhas.find(
      (f) => f.slug === n.cat && f.segmentoSlug === n.seg,
    );
    return folha ? [folha.uuid] : [];
  }
  return catalogo.folhas.filter((f) => f.segmentoSlug === n.seg).map((f) => f.uuid);
}

export function folhasAtivasDoSegmento(
  seg: string | undefined,
  catalogo: CatalogoUrl,
): FolhaUrl[] {
  if (!seg) return [];
  return catalogo.folhas.filter((f) => f.segmentoSlug === seg && f.ativo);
}

export function nomeDoSegmento(
  slug: string | undefined,
  catalogo: CatalogoUrl,
): string | undefined {
  if (!slug) return undefined;
  return catalogo.segmentos.find((s) => s.slug === slug)?.nome;
}

export function nomeDaFolha(
  filtro: FiltroUrl,
  catalogo: CatalogoUrl,
): string | undefined {
  const n = normalizarFiltroUrl(filtro, catalogo);
  if (!n.seg || !n.cat) return undefined;
  return catalogo.folhas.find((f) => f.slug === n.cat && f.segmentoSlug === n.seg)
    ?.nome;
}

export function agruparPorSegmento<
  T extends { segmentoSlug?: string; segmentoLabel?: string; label: string },
>(itens: T[]): { slug: string; label: string; itens: T[] }[] {
  const grupos = new Map<string, { slug: string; label: string; itens: T[] }>();
  const ordem: string[] = [];
  for (const item of itens) {
    const slug = item.segmentoSlug || "_";
    const label = item.segmentoLabel || item.segmentoSlug || "Outros";
    const atual = grupos.get(slug);
    if (atual) atual.itens.push(item);
    else {
      grupos.set(slug, { slug, label, itens: [item] });
      ordem.push(slug);
    }
  }
  return ordem.map((s) => grupos.get(s)!);
}
