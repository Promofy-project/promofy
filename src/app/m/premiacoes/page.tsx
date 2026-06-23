"use client";

import * as React from "react";
import { Trophy, Gift, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/mobile-page-header";

const premios = [
  { id: "p1", titulo: "Premio exemplo lorem", data: "DD/DD/DDDD", desc: "Lorem ipsum dolor sit amet. Eum nisi" },
  { id: "p2", titulo: "Premio exemplo lorem", data: "DD/DD/DDDD", desc: "Lorem ipsum dolor sit amet. Eum nisi" },
  { id: "p3", titulo: "Premio exemplo lorem", data: "DD/DD/DDDD", desc: "Lorem ipsum dolor sit amet. Eum nisi" },
];

export default function PremiacoesPage() {
  const [showDesc, setShowDesc] = React.useState(false);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Premiações" back="/m" />

      <div className="flex flex-col gap-6 px-4 pb-8 pt-5">
        {/* Banner ilustrativo (mascote + troféu) */}
        <div
          className="relative grid h-44 place-items-center overflow-hidden rounded-card shadow-card"
          style={{ background: "linear-gradient(135deg, #1414DC 0%, #4B4BEC 55%, #FAC81E 100%)" }}
        >
          <div className="bg-dots absolute inset-0 opacity-20" />
          <Gift className="absolute -left-3 bottom-2 h-24 w-24 text-white/15" />
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-white/15 backdrop-blur">
            <Trophy className="h-10 w-10 text-white" />
          </span>
        </div>

        {/* Boas-vindas */}
        <p className="text-sm leading-relaxed text-foreground">
          Bem-vindo ao ranking de consumidores Promofy, onde economizar fica
          ainda mais divertido! Aqui, quanto mais cupons você usar, mais pontos
          você acumula e maiores são as suas chances de ganhar prêmios incríveis!
        </p>

        {/* Como funciona? -> revela Descrição */}
        <Button
          variant={showDesc ? "outline" : "default"}
          className="w-full"
          onClick={() => setShowDesc((v) => !v)}
        >
          Como funciona?
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showDesc && "rotate-180")}
          />
        </Button>

        {showDesc && (
          <section className="animate-fade-up flex flex-col gap-5 rounded-card border border-border bg-card p-5 shadow-card">
            <div>
              <h2 className="mb-1.5 text-base font-bold text-primary">
                Por que participar?
              </h2>
              <p className="text-sm leading-relaxed text-foreground">
                Além de economizar com as melhores ofertas da cidade, você pode
                ser premiado por aproveitar as promoções! É a chance de economizar
                dobrado: nos cupons e nos prêmios. Acompanhe o ranking e use mais
                cupons para alcançar o topo. A Promofy transforma cada promoção em
                diversão e recompensas para você! Que tal começar agora? Bora
                economizar e pontuar!
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-bold text-primary">
                Como funciona?
              </h2>
              <ul className="flex flex-col gap-2.5">
                {[
                  "Cada cupom resgatado na Promofy vale pontos.",
                  "Os pontos se acumulam automaticamente no seu perfil.",
                  "Os consumidores com maior pontuação dentro do prazo determinado aparecem no nosso Ranking de Top Usuários e podem conquistar prêmios exclusivos.",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow" />
                    <span className="text-foreground">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button className="w-full">Começar agora!</Button>
          </section>
        )}

        {/* Lista de premiações */}
        <section>
          <h2 className="mb-3 text-base font-bold">Premiações</h2>
          <div className="flex flex-col gap-3">
            {premios.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-3 shadow-card"
              >
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #FAC81E 0%, #F5A623 100%)" }}
                >
                  <Trophy className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{p.titulo}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Data de resgate {p.data}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
