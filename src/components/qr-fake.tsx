import { cn } from "@/lib/utils";

/**
 * QR "fake" determinístico: NÃO é escaneável, mas tem a anatomia de um QR real
 * (finder patterns nos 3 cantos, separadores, timing e um alignment pattern) e
 * um campo de dados estável derivado do `value` — fica nítido e convincente.
 *
 * Determinístico por construção (sem Math.random no render), então é seguro em
 * SSR/hydration. Renderiza um único <path> de módulos pretos sobre fundo branco.
 */
const N = 25; // módulos (QR v2)

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGrid(value: string): boolean[][] {
  const grid: boolean[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => false),
  );
  const reserved: boolean[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => false),
  );

  const setBlock = (r0: number, c0: number, h: number, w: number, on: boolean) => {
    for (let r = r0; r < r0 + h; r++)
      for (let c = c0; c < c0 + w; c++) {
        if (r < 0 || c < 0 || r >= N || c >= N) continue;
        grid[r][c] = on;
        reserved[r][c] = true;
      }
  };

  // Finder pattern 7x7 + separador (a borda reservada de 1 módulo fica branca)
  const finder = (r0: number, c0: number) => {
    // separador (8x8) reservado/branco
    setBlock(r0 - 1, c0 - 1, 9, 9, false);
    setBlock(r0, c0, 7, 7, true); // anel externo preto
    setBlock(r0 + 1, c0 + 1, 5, 5, false); // anel branco
    setBlock(r0 + 2, c0 + 2, 3, 3, true); // miolo preto
  };
  finder(0, 0); // topo-esquerda
  finder(0, N - 7); // topo-direita
  finder(N - 7, 0); // base-esquerda

  // Timing patterns (linha/coluna 6) — alternados
  for (let i = 8; i < N - 8; i++) {
    grid[6][i] = i % 2 === 0;
    reserved[6][i] = true;
    grid[i][6] = i % 2 === 0;
    reserved[i][6] = true;
  }

  // Alignment pattern 5x5 (centro ~ 18,18 no v2)
  const a0 = N - 9;
  setBlock(a0, a0, 5, 5, true);
  setBlock(a0 + 1, a0 + 1, 3, 3, false);
  setBlock(a0 + 2, a0 + 2, 1, 1, true);

  // Campo de dados: preenche o restante de forma determinística (~48%)
  const rnd = mulberry32(hashSeed(value || "PROMOFY"));
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!reserved[r][c]) grid[r][c] = rnd() > 0.52;

  return grid;
}

export function QrFake({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const grid = buildGrid(value);
  let d = "";
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c]) d += `M${c} ${r}h1v1h-1z`;

  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      role="img"
      aria-label="QR Code do cupom"
      shapeRendering="crispEdges"
      className={cn("h-full w-full", className)}
    >
      <rect width={N} height={N} fill="#ffffff" />
      <path d={d} fill="#0b0b14" />
    </svg>
  );
}
