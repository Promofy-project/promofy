import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** R$ 9,90 — Brazilian currency. */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** 9,90 — currency value without the R$ prefix. */
export function formatBRLValue(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** 1.234 — integer with pt-BR thousands separator. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** "1,2 km" or "850 m" from a distance in kilometers. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

/**
 * "23/06" — short day/month from an ISO date string.
 *
 * Lê os componentes da data ISO direto (sem criar um Date), porque
 * `new Date("2026-06-30")` é interpretado como meia-noite UTC e, ao formatar
 * com o fuso local, desloca o dia em offsets negativos (ex.: UTC-3 → "29/06").
 * No SSR isso diverge entre servidor (UTC na Vercel) e navegador (UTC-3 do
 * usuário), causando erro de hidratação do React (#418/#423/#425). Formatar a
 * partir dos componentes torna o resultado determinístico em qualquer fuso.
 */
export function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}`;
  // Outros formatos (com hora/offset): fixa UTC p/ servidor e cliente concordarem.
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * "DD/MM/AAAA HH:MM" em horário de Brasília — para a linha do tempo de
 * moderação no admin (Fase 7/P4).
 *
 * Aqui o fuso é FIXADO em America/Sao_Paulo, não em UTC como `formatShortDate`.
 * O motivo é outro: este carimbo é uma hora de RELÓGIO que o moderador vai
 * comparar com "quando o lojista me ligou". Mostrá-lo em UTC seria mostrar uma
 * hora que não aconteceu para ninguém. Fixar o fuso (em vez de deixar o local)
 * mantém o determinismo que a nota acima exige.
 *
 * Só-web: usa `Intl`. Por isso vive aqui e não em `moderacao.ts`, que é puro e
 * o app nativo reaproveita como está.
 */
export function formatDateTimeBRT(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
