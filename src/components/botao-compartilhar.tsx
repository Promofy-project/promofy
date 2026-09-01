"use client";

import * as React from "react";
import { Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Compartilhar a URL atual.
 *
 * Só-web: `navigator.share` / clipboard. No nativo isto vira Share.shareAsync
 * — o ponto de troca é este arquivo.
 */
export function BotaoCompartilhar({
  titulo,
  className,
}: {
  titulo: string;
  className?: string;
}) {
  const [aviso, setAviso] = React.useState<string | null>(null);

  async function compartilhar() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: titulo, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setAviso("Link copiado");
        window.setTimeout(() => setAviso(null), 2000);
        return;
      }
      setAviso("Não foi possível compartilhar agora");
      window.setTimeout(() => setAviso(null), 2000);
    } catch (err) {
      const cancelou =
        err instanceof DOMException && err.name === "AbortError";
      if (cancelou) return;
      setAviso("Não foi possível compartilhar agora");
      window.setTimeout(() => setAviso(null), 2000);
    }
  }

  return (
    <span className="relative">
      <button
        type="button"
        aria-label="Compartilhar"
        onClick={() => void compartilhar()}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full hover:bg-white/15",
          className,
        )}
      >
        <Share2 className="h-5 w-5" />
      </button>
      {aviso ? (
        <span
          role="status"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[11px] font-semibold text-white"
        >
          {aviso}
        </span>
      ) : null}
    </span>
  );
}
