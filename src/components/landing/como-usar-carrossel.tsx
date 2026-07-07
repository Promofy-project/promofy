/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const IMG = "/lp/consumidores";

const PASSOS = [
  {
    label: "1° Passo",
    titulo: "Cadastro fácil e gratuito",
    texto:
      "Baixe o app e crie sua conta em menos de 2 minutos. É de graça e você já começa a ver ofertas perto de você.",
  },
  {
    label: "2° Passo",
    titulo: "Escolha seu cupom",
    texto:
      "Navegue por categoria, cidade ou dia da semana e ache a promoção perfeita. Favorite estabelecimentos e receba aviso de novos cupons.",
  },
  {
    label: "3° Passo",
    titulo: "Ative e mostre o código",
    texto:
      "Na hora de usar, o app gera um código único (PRM-XXXXXX). É só mostrar na tela no estabelecimento — sem imprimir nada.",
  },
  {
    label: "4° Passo",
    titulo: "Economize e pontue",
    texto:
      "O parceiro confirma o resgate, você economiza na hora e ainda ganha PromoPoints para subir no ranking e trocar por recompensas.",
  },
];

/** Carrossel "Como usar o aplicativo?" — 4 passos navegáveis pelas setas ‹ ›. */
export function ComoUsarCarrossel() {
  const [i, setI] = React.useState(0);
  const passo = PASSOS[i];
  const prev = () => setI((v) => (v - 1 + PASSOS.length) % PASSOS.length);
  const next = () => setI((v) => (v + 1) % PASSOS.length);

  return (
    <div className="relative rounded-2xl border border-border/60 bg-surface p-6 shadow-[0_1px_2px_rgba(20,20,60,0.04),0_10px_30px_-12px_rgba(20,20,60,0.15)] sm:p-8">
      {/* setas de navegação */}
      <div className="absolute right-6 top-6 z-10 flex gap-2 sm:right-8 sm:top-8">
        <button
          type="button"
          aria-label="Passo anterior"
          onClick={prev}
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Próximo passo"
          onClick={next}
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
          <img
            src={`${IMG}/como-usar-mulher.png`}
            alt="Mulher usando o app Promofy no celular"
            className="h-full w-full object-cover grayscale"
          />
        </div>

        <div className="pr-0 lg:pr-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Como usar o aplicativo?
          </h2>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {passo.label}
          </p>
          <p className="mt-2 text-xl font-bold text-cta">{passo.titulo}</p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/70">
            {passo.texto}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <img
              src={`${IMG}/badge-google-play.png`}
              alt="Disponível no Google Play"
              className="h-10 w-auto"
            />
            <img
              src={`${IMG}/badge-app-store.png`}
              alt="Baixar na App Store"
              className="h-10 w-auto"
            />
          </div>

          <Button
            className="mt-6 rounded-xl bg-yellow text-[15px] text-yellow-foreground hover:brightness-95"
            size="lg"
            asChild
          >
            <Link href="/m">Baixar agora</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
