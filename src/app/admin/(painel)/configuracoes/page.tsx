"use client";

import * as React from "react";
import { Check, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";

interface Opcao {
  key: string;
  label: string;
  descricao: string;
  inicial: boolean;
}

const OPCOES: Opcao[] = [
  { key: "cadastro", label: "Cadastro de estabelecimentos aberto", descricao: "Novos parceiros podem se inscrever pelo portal.", inicial: true },
  { key: "aprovacao", label: "Aprovação manual de cupons", descricao: "Cupons novos passam por moderação antes de publicar.", inicial: true },
  { key: "ranking", label: "Ranking público de usuários", descricao: "Exibir o ranking de pontos no app do consumidor.", inicial: true },
  { key: "push", label: "Notificações push da plataforma", descricao: "Envio de campanhas e avisos globais.", inicial: false },
  { key: "manutencao", label: "Modo manutenção", descricao: "Suspende o app e o portal temporariamente.", inicial: false },
];

interface RegraPontos {
  key: string;
  acao: string;
  inicial: number;
}

const REGRAS: RegraPontos[] = [
  { key: "resgate", acao: "Resgatar um cupom", inicial: 50 },
  { key: "nps", acao: "Responder NPS", inicial: 30 },
  { key: "indicacao", acao: "Indicar um amigo", inicial: 100 },
  { key: "visita", acao: "Visita diária ao app", inicial: 10 },
];

export default function AdminConfiguracoes() {
  const [toggles, setToggles] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(OPCOES.map((o) => [o.key, o.inicial])),
  );
  const [pontos, setPontos] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(REGRAS.map((r) => [r.key, r.inicial])),
  );
  const [salvo, setSalvo] = React.useState(false);

  React.useEffect(() => {
    if (!salvo) return;
    const t = window.setTimeout(() => setSalvo(false), 4000);
    return () => window.clearTimeout(t);
  }, [salvo]);

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Parâmetros da plataforma e regras de gamificação."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plataforma */}
        <Card className="p-5 lg:p-6">
          <h2 className="text-lg font-bold">Plataforma</h2>
          <p className="text-sm text-muted-foreground">
            Controles globais do app e do portal.
          </p>
          <div className="mt-4 divide-y divide-border">
            {OPCOES.map((o) => (
              <div key={o.key} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.descricao}</p>
                </div>
                <Switch
                  checked={toggles[o.key]}
                  onCheckedChange={(v) =>
                    setToggles((prev) => ({ ...prev, [o.key]: v }))
                  }
                  aria-label={o.label}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Tabela de pontos */}
        <Card className="p-5 lg:p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Trophy className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Tabela de pontos</h2>
              <p className="text-sm text-muted-foreground">
                Quantos pontos cada ação concede.
              </p>
            </div>
          </div>

          {salvo && (
            <div className="mt-4 flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
              <Check className="h-4 w-4" /> Tabela de pontos salva.
            </div>
          )}

          <div className="mt-4 divide-y divide-border">
            {REGRAS.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm font-medium text-foreground">{r.acao}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={pontos[r.key]}
                    onChange={(e) =>
                      setPontos((prev) => ({
                        ...prev,
                        [r.key]: Number(e.target.value),
                      }))
                    }
                    className="h-10 w-24 text-right"
                    aria-label={`Pontos por ${r.acao}`}
                  />
                  <span className="text-sm text-muted-foreground">pts</span>
                </div>
              </div>
            ))}
          </div>

          <Button className="mt-5" onClick={() => setSalvo(true)}>
            <Check className="h-4 w-4" /> Salvar tabela de pontos
          </Button>
        </Card>
      </div>
    </>
  );
}
