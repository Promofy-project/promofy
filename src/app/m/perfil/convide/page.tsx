import { Gift, Link2, Send, Award } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/mobile-page-header";

const passos = [
  { icon: Send, texto: "Envie o link para seus amigos" },
  { icon: Award, texto: "Você ganha pontos para cada indicação que fizer" },
];

export default function ConvidePage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Convide seus amigos" back="/m/perfil" />

      <div className="flex flex-col gap-6 px-4 pb-8 pt-5">
        {/* Ilustração (placeholder mascote) */}
        <div
          className="relative grid h-44 place-items-center overflow-hidden rounded-card shadow-card"
          style={{ background: "linear-gradient(135deg, #FAC81E 0%, #F5A623 100%)" }}
        >
          <div className="bg-dots absolute inset-0 opacity-20" />
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-white/25 backdrop-blur">
            <Gift className="h-10 w-10 text-white" />
          </span>
        </div>

        <h2 className="text-center text-xl font-extrabold">
          Convide os seus amigos
        </h2>

        {/* Passos */}
        <div className="flex flex-col gap-3">
          {passos.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.texto}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-card"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {p.texto}
                </span>
              </div>
            );
          })}
        </div>

        <Button className="w-full" size="lg">
          <Link2 className="h-4 w-4" /> Link
        </Button>
      </div>
    </div>
  );
}
