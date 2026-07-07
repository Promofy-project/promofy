"use client";
import { UserPlus, Eye, Store, ChevronRight } from "lucide-react";
import { Fragment } from "react";

const PASSOS = [
  { icon: UserPlus, titulo: "Cadastre", desc: "Crie seu cupom em minutos, de graça." },
  { icon: Eye, titulo: "Usuários veem", desc: "Ele aparece para todo o app na sua cidade." },
  { icon: Store, titulo: "Cliente chega", desc: "Quem resgata já vem com intenção de consumir." },
];

export function FluxoSolucao() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 sm:flex-row sm:items-start">
      {PASSOS.map((p, i) => (
        <Fragment key={p.titulo}>
          <div className="flex w-full max-w-[15rem] flex-col items-center text-center">
            <div className="relative grid h-24 w-24 place-items-center rounded-full border-[3px] border-primary bg-white/60">
              <p.icon className="h-9 w-9 text-primary" strokeWidth={2} />
              <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-bold text-white shadow-sm">
                {i + 1}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold text-primary">{p.titulo}</h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/70">{p.desc}</p>
          </div>
          {i < PASSOS.length - 1 && (
            <ChevronRight
              className="my-1 h-8 w-8 shrink-0 rotate-90 text-primary/40 sm:mt-8 sm:rotate-0"
              strokeWidth={2.5}
              aria-hidden
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
