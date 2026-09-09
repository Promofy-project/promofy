"use client";

/**
 * Recorte da imagem do cupom antes do upload.
 *
 * PONTO DE TROCA NATIVO↔WEB — Canvas, pointer events e object URL. No
 * app nativo este arquivo é reescrito (cropper do SO / lib nativa); a
 * geometria (`src/lib/recorte-imagem.ts`) e a Action de upload ficam.
 *
 * O que o lojista vê no quadro é o que a superfície vai mostrar: pan +
 * zoom, sem biblioteca. O JPEG sai no máximo na largura pedida, para não
 * inflar o arquivo além do que a superfície usa.
 *
 * PARAMETRIZADO, NÃO DUPLICADO (CLIENT-RETURNS-03) — a galeria do perfil
 * precisa de 4:3, o card de cupom de 2:1. Escrever um segundo cropper por
 * causa de um número seria duplicar pan, zoom, clamp e export. `aspecto`,
 * `larguraExport` e `titulo` são OPCIONAIS e caem exatamente nos valores do
 * cupom quando ninguém passa nada — quem já usava não muda.
 */
import * as React from "react";
import { Check, X } from "lucide-react";

import {
  ASPECTO_IMAGEM_CUPOM,
  LARGURA_EXPORT_IMAGEM_CUPOM,
  escalaCover,
  limitarPan,
  retanguloFonte,
} from "@/lib/recorte-imagem";
import { Button } from "@/components/ui/button";

interface CropImagemProps {
  arquivo: File;
  onCancelar: () => void;
  onConfirmar: (arquivo: File) => void;
  /** Largura / altura do recorte. Default: o card do cupom (2:1). */
  aspecto?: number;
  /** Largura máxima do JPEG exportado. Default: 1200 (card do cupom). */
  larguraExport?: number;
  /** Instrução no topo. Default: a do card do cupom. */
  titulo?: string;
}

export function CropImagem({
  arquivo,
  onCancelar,
  onConfirmar,
  aspecto = ASPECTO_IMAGEM_CUPOM,
  larguraExport = LARGURA_EXPORT_IMAGEM_CUPOM,
  titulo = "Enquadre a imagem no formato do card",
}: CropImagemProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [pronta, setPronta] = React.useState(false);
  const [view, setView] = React.useState({ w: 1, h: 1 });
  const [panX, setPanX] = React.useState(0);
  const [panY, setPanY] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [exportando, setExportando] = React.useState(false);
  const arrasto = React.useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  React.useEffect(() => {
    const objectUrl = URL.createObjectURL(arquivo);
    setUrl(objectUrl);
    setPronta(false);
    return () => {
      URL.revokeObjectURL(objectUrl);
      imgRef.current = null;
    };
  }, [arquivo]);

  React.useLayoutEffect(() => {
    const box = viewportRef.current;
    if (!box) return;
    const medir = () => setView({ w: box.clientWidth, h: box.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(box);
    return () => ro.disconnect();
  }, [pronta]);

  function limites() {
    const img = imgRef.current;
    if (!img) return null;
    const cover = escalaCover(img.naturalWidth, img.naturalHeight, view.w, view.h);
    const scale = cover * zoom;
    return {
      viewW: view.w,
      viewH: view.h,
      dispW: img.naturalWidth * scale,
      dispH: img.naturalHeight * scale,
    };
  }

  function pointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, panX, panY };
  }

  function pointerMove(e: React.PointerEvent) {
    if (!arrasto.current) return;
    const lim = limites();
    if (!lim) return;
    const dx = e.clientX - arrasto.current.x;
    const dy = e.clientY - arrasto.current.y;
    setPanX(limitarPan(arrasto.current.panX + dx, lim.dispW, lim.viewW));
    setPanY(limitarPan(arrasto.current.panY + dy, lim.dispH, lim.viewH));
  }

  function pointerUp() {
    arrasto.current = null;
  }

  function wheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.12 : -0.12))));
  }

  async function confirmar() {
    const img = imgRef.current;
    if (!img) return;
    setExportando(true);
    try {
      const fonte = retanguloFonte({
        viewW: view.w,
        viewH: view.h,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        panX,
        panY,
        zoom,
      });
      const outW = Math.min(larguraExport, Math.round(fonte.sw));
      const outH = Math.max(1, Math.round(outW / aspecto));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, fonte.sx, fonte.sy, fonte.sw, fonte.sh, 0, 0, outW, outH);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) return;
      const recortado = new File([blob], "cupom.jpg", { type: "image/jpeg" });
      onConfirmar(recortado);
    } finally {
      setExportando(false);
    }
  }

  const img = imgRef.current;
  let imgStyle: React.CSSProperties | undefined;
  if (img) {
    const cover = escalaCover(img.naturalWidth, img.naturalHeight, view.w, view.h);
    const scale = cover * zoom;
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    const px = limitarPan(panX, dispW, view.w);
    const py = limitarPan(panY, dispH, view.h);
    imgStyle = {
      width: dispW,
      height: dispH,
      left: (view.w - dispW) / 2 + px,
      top: (view.h - dispH) / 2 + py,
    };
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-foreground/80 p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3">
        <p className="text-center text-sm font-semibold text-white">{titulo}</p>
        <div
          ref={viewportRef}
          className="relative w-full overflow-hidden rounded-xl bg-black touch-none"
          style={{ aspectRatio: `${aspecto} / 1` }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onWheel={wheel}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={imgStyle}
              onLoad={(e) => {
                imgRef.current = e.currentTarget;
                setPronta(true);
              }}
            />
          )}
        </div>
        <label className="flex items-center gap-3 text-xs font-medium text-white/90">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-yellow"
            aria-label="Zoom da imagem"
          />
        </label>
        <p className="text-center text-xs text-white/70">
          Arraste para posicionar. No celular, use o controle de zoom.
        </p>
        <div className="mt-auto flex gap-2">
          <Button type="button" variant="outline" className="flex-1 bg-white" onClick={onCancelar}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!pronta || exportando}
            onClick={() => void confirmar()}
          >
            <Check className="h-4 w-4" />
            {exportando ? "Preparando…" : "Usar recorte"}
          </Button>
        </div>
      </div>
    </div>
  );
}
