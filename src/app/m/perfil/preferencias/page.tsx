"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { categorias } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/mobile-page-header";

const DISTANCIAS = ["1km", "5km", "10km", "25km"];

export default function PreferenciasPage() {
  const [interesses, setInteresses] = React.useState<Set<string>>(
    new Set(["alimentacao", "saude"]),
  );
  const [distancia, setDistancia] = React.useState("5km");
  const [notifs, setNotifs] = React.useState({
    proximosMim: true,
    expirando: true,
    novidades: false,
  });
  const [comunicacao, setComunicacao] = React.useState({
    email: true,
    resumoSemanal: false,
  });
  const [salvo, setSalvo] = React.useState(false);

  React.useEffect(() => {
    if (!salvo) return;
    const t = window.setTimeout(() => setSalvo(false), 3000);
    return () => window.clearTimeout(t);
  }, [salvo]);

  function toggleInteresse(id: string) {
    setInteresses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Preferências" back="/m/perfil" />

      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        {/* Section 1 — Categorias de interesse */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-bold text-foreground">
            Categorias de interesse
          </p>
          <div className="flex flex-wrap gap-2">
            {categorias.map((cat) => {
              const sel = interesses.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleInteresse(cat.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    sel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Section 2 — Raio de distância */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-bold text-foreground">
            Raio de distância
          </p>
          <div className="flex gap-2">
            {DISTANCIAS.map((d) => {
              const sel = distancia === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistancia(d)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    sel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Section 3 — Notificações */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-bold text-foreground">Notificações</p>
          <div className="flex flex-col divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground">Cupons próximos a mim</span>
              <Switch
                checked={notifs.proximosMim}
                onCheckedChange={(v) =>
                  setNotifs((prev) => ({ ...prev, proximosMim: v }))
                }
                aria-label="Cupons próximos a mim"
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground">Cupons expirando</span>
              <Switch
                checked={notifs.expirando}
                onCheckedChange={(v) =>
                  setNotifs((prev) => ({ ...prev, expirando: v }))
                }
                aria-label="Cupons expirando"
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground">Novidades da plataforma</span>
              <Switch
                checked={notifs.novidades}
                onCheckedChange={(v) =>
                  setNotifs((prev) => ({ ...prev, novidades: v }))
                }
                aria-label="Novidades da plataforma"
              />
            </div>
          </div>
        </Card>

        {/* Section 4 — Comunicação */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-bold text-foreground">Comunicação</p>
          <div className="flex flex-col divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground">Ofertas por e-mail</span>
              <Switch
                checked={comunicacao.email}
                onCheckedChange={(v) =>
                  setComunicacao((prev) => ({ ...prev, email: v }))
                }
                aria-label="Ofertas por e-mail"
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground">Resumo semanal</span>
              <Switch
                checked={comunicacao.resumoSemanal}
                onCheckedChange={(v) =>
                  setComunicacao((prev) => ({ ...prev, resumoSemanal: v }))
                }
                aria-label="Resumo semanal"
              />
            </div>
          </div>
        </Card>

        {/* Save feedback + button */}
        {salvo && (
          <div className="flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
            <Check className="h-4 w-4" /> Preferências salvas
          </div>
        )}

        <Button className="w-full" onClick={() => setSalvo(true)}>
          Salvar preferências
        </Button>
      </div>
    </div>
  );
}
