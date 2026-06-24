"use client";

import { useState } from "react";
import { Clock, MapPin, Trophy, UserPlus, Zap, type LucideIcon } from "lucide-react";

import { MobilePageHeader } from "@/components/mobile-page-header";

type Notificacao = {
  id: string;
  tipo: "cupom_expirando" | "novo_cupom" | "nps_pontos" | "indicacao";
  titulo: string;
  corpo: string;
  tempo: string;
  lida: boolean;
  icone: string;
};

const ICON_MAP: Record<string, LucideIcon> = {
  Clock,
  MapPin,
  Trophy,
  UserPlus,
  Zap,
};

const INITIAL: Notificacao[] = [
  {
    id: "1",
    tipo: "cupom_expirando",
    titulo: "Cupom expirando hoje!",
    corpo: "Seu cupom Hortifresh expira às 23h59. Use agora!",
    tempo: "há 5 min",
    lida: false,
    icone: "Clock",
  },
  {
    id: "2",
    tipo: "novo_cupom",
    titulo: "Novo cupom perto de você",
    corpo: "GymPass lançou 40% off na matrícula. A 0,8 km de você.",
    tempo: "há 2h",
    lida: false,
    icone: "MapPin",
  },
  {
    id: "3",
    tipo: "nps_pontos",
    titulo: "+30 pontos creditados",
    corpo: "Obrigado por avaliar! Você ganhou 30 pontos por responder o NPS.",
    tempo: "ontem",
    lida: false,
    icone: "Trophy",
  },
  {
    id: "4",
    tipo: "indicacao",
    titulo: "Amigo cadastrado pela sua indicação",
    corpo: "Pedro Alves se cadastrou usando seu link. +100 pontos para você!",
    tempo: "há 3 dias",
    lida: true,
    icone: "UserPlus",
  },
  {
    id: "5",
    tipo: "novo_cupom",
    titulo: "Promoção relâmpago!",
    corpo: "Açaí do Norte: compre 1 leve 2 por 4h. Válido até 18h.",
    tempo: "há 4 dias",
    lida: true,
    icone: "Zap",
  },
];

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(INITIAL);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  function marcarLida(id: string) {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    );
  }

  function marcarTodasLidas() {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Notificações" back="/m/perfil" />

      <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
        {naoLidas > 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">
              {naoLidas} não {naoLidas === 1 ? "lida" : "lidas"}
            </span>
            <button
              onClick={marcarTodasLidas}
              className="text-sm font-medium text-primary hover:underline"
            >
              Marcar todas como lidas
            </button>
          </div>
        )}

        {notificacoes.map((n) => {
          const IconCmp = ICON_MAP[n.icone] ?? Clock;
          return (
            <button
              key={n.id}
              onClick={() => !n.lida && marcarLida(n.id)}
              className={[
                "flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors",
                n.lida
                  ? "bg-card"
                  : "bg-primary/5 border-l-2 border-primary",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  n.lida ? "bg-muted" : "bg-primary/10",
                ].join(" ")}
              >
                <IconCmp
                  className={[
                    "h-5 w-5",
                    n.lida ? "text-muted-foreground" : "text-primary",
                  ].join(" ")}
                />
              </span>

              <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                <span
                  className={[
                    "text-sm leading-snug",
                    n.lida
                      ? "font-medium text-muted-foreground"
                      : "font-semibold text-foreground",
                  ].join(" ")}
                >
                  {n.titulo}
                </span>
                <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {n.corpo}
                </span>
                <span className="mt-1 text-xs text-muted-foreground/70">
                  {n.tempo}
                </span>
              </div>

              {!n.lida && (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
