/**
 * Geometria do recorte da imagem do cupom.
 *
 * MÓDULO PURO: sem DOM, sem Canvas, sem `Intl`. O componente web
 * (`crop-imagem.tsx`) aplica isto no canvas; o nativo pode aplicar no
 * mesmo contrato com outra API de recorte.
 *
 * O card do cupom é uma faixa larga (`h-36 w-full`). Recortamos nessa
 * proporção para o `object-cover` do card não cortar de novo, noutro
 * lugar, o que o lojista acabou de enquadrar.
 */

/** Largura / altura do card (faixa ~2:1). */
export const ASPECTO_IMAGEM_CUPOM = 2;

/** Largura máxima do JPEG exportado — o card não precisa de 4K. */
export const LARGURA_EXPORT_IMAGEM_CUPOM = 1200;

export interface ViewportRecorte {
  viewW: number;
  viewH: number;
  naturalW: number;
  naturalH: number;
  panX: number;
  panY: number;
  /** 1 = cover exato; >1 = zoom. */
  zoom: number;
}

export interface RetanguloFonte {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Escala "cover": a imagem preenche o viewport sem barras. */
export function escalaCover(
  naturalW: number,
  naturalH: number,
  viewW: number,
  viewH: number,
): number {
  if (naturalW <= 0 || naturalH <= 0 || viewW <= 0 || viewH <= 0) return 1;
  return Math.max(viewW / naturalW, viewH / naturalH);
}

/** Pan limitado para a imagem nunca deixar buraco no viewport. */
export function limitarPan(pan: number, displayed: number, view: number): number {
  const max = Math.max(0, (displayed - view) / 2);
  if (pan > max) return max;
  if (pan < -max) return -max;
  return pan;
}

/**
 * Retângulo da imagem original que o viewport está mostrando.
 *
 * Origem (0,0) do viewport mapeia para (sx, sy) na imagem; o tamanho do
 * viewport mapeia para (sw, sh). Valores fora da imagem são clamados.
 */
export function retanguloFonte(v: ViewportRecorte): RetanguloFonte {
  const cover = escalaCover(v.naturalW, v.naturalH, v.viewW, v.viewH);
  const zoom = v.zoom >= 1 ? v.zoom : 1;
  const scale = cover * zoom;
  const dispW = v.naturalW * scale;
  const dispH = v.naturalH * scale;
  const panX = limitarPan(v.panX, dispW, v.viewW);
  const panY = limitarPan(v.panY, dispH, v.viewH);
  const left = (v.viewW - dispW) / 2 + panX;
  const top = (v.viewH - dispH) / 2 + panY;

  let sx = (0 - left) / scale;
  let sy = (0 - top) / scale;
  let sw = v.viewW / scale;
  let sh = v.viewH / scale;

  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > v.naturalW) sw = v.naturalW - sx;
  if (sy + sh > v.naturalH) sh = v.naturalH - sy;
  if (sw < 1) sw = 1;
  if (sh < 1) sh = 1;

  return { sx, sy, sw, sh };
}
