"use client";

import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Stub trocável do scanner de QR (B4). NÃO abre a câmera por ora — a
 * digitação (campo acima) é sempre o caminho primário e nunca falha.
 * Isolado de propósito: na versão React Native este componente vira a
 * câmera nativa, sem tocar na lógica da tela de validação.
 */
export function QrScanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-border bg-muted/40 p-4 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        <Camera className="h-4 w-4" />
        Ler QR pela câmera
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Em breve no app — por ora, digite o código acima.
      </p>
    </div>
  );
}
