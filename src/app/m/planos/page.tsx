"use client";

import * as React from "react";
import { Tag, X, PartyPopper } from "lucide-react";

import { planosMobile } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanCard } from "@/components/plan-card";
import { MobilePageHeader } from "@/components/mobile-page-header";

type ModalStep = "closed" | "input" | "success";

// Confete decorativo do modal de sucesso
const CONFETTI = [
  { left: "10%", top: "12%", color: "#1414DC", rotate: -18 },
  { left: "24%", top: "4%", color: "#FAC81E", rotate: 24 },
  { left: "40%", top: "16%", color: "#16A34A", rotate: -8 },
  { left: "56%", top: "6%", color: "#F5A623", rotate: 30 },
  { left: "72%", top: "14%", color: "#DC2626", rotate: -22 },
  { left: "86%", top: "8%", color: "#1414DC", rotate: 12 },
  { left: "16%", top: "30%", color: "#FAC81E", rotate: 16 },
  { left: "82%", top: "32%", color: "#16A34A", rotate: -14 },
];

export default function PlanosPage() {
  const [ciclo, setCiclo] = React.useState<"mensal" | "anual">("mensal");
  const [modal, setModal] = React.useState<ModalStep>("closed");
  const [codigo, setCodigo] = React.useState("");

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Planos" back="/m/perfil" />

      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        {/* Toggle Mensal | Anual */}
        <div className="mx-auto flex w-full max-w-[280px] rounded-full bg-muted p-1">
          {(["mensal", "anual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCiclo(c)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-colors",
                ciclo === c
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Atalho código promocional */}
        <button
          type="button"
          onClick={() => {
            setCodigo("");
            setModal("input");
          }}
          className="flex items-center justify-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <Tag className="h-4 w-4" />
          Tenho um código promocional
        </button>

        {/* Planos */}
        <div className="flex flex-col gap-5">
          {planosMobile.map((p) => (
            <PlanCard key={p.id} plano={p} actionTone="yellow" />
          ))}
        </div>
      </div>

      {/* Modal código promocional */}
      {modal !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
            onClick={() => setModal("closed")}
          />

          {modal === "input" ? (
            <div className="animate-fade-up relative w-full max-w-[340px] rounded-[24px] bg-surface p-6 shadow-2xl">
              <button
                aria-label="Fechar"
                onClick={() => setModal("closed")}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Tag className="h-6 w-6" />
              </div>
              <h2 className="text-center text-lg font-extrabold">
                Aplique agora seu Código!
              </h2>
              <div className="mt-5 flex flex-col gap-1.5">
                <label
                  htmlFor="codigo-promo"
                  className="text-sm font-semibold text-foreground"
                >
                  Código Promocional
                </label>
                <Input
                  id="codigo-promo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex.: PROMOFY30"
                  className="h-12 rounded-xl"
                />
              </div>
              <Button
                className="mt-5 w-full"
                onClick={() => setModal("success")}
              >
                Aplicar código
              </Button>
            </div>
          ) : (
            <div className="animate-fade-up relative w-full max-w-[340px] overflow-hidden rounded-[24px] bg-surface p-7 text-center shadow-2xl">
              {/* Confete */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28">
                {CONFETTI.map((c, i) => (
                  <span
                    key={i}
                    className="absolute h-2.5 w-1.5 rounded-[1px]"
                    style={{
                      left: c.left,
                      top: c.top,
                      background: c.color,
                      transform: `rotate(${c.rotate}deg)`,
                    }}
                  />
                ))}
              </div>
              <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-success-soft">
                <PartyPopper className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-extrabold">
                Código aplicado com sucesso!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu benefício já está ativo na sua conta.
              </p>
              <Button className="mt-6 w-full" onClick={() => setModal("closed")}>
                Aplicar código
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
