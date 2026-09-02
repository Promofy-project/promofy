"use client";

import * as React from "react";
import { Check, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { salvarConfigPontosAction } from "@/lib/actions/admin";

interface Opcao {
  key: string;
  label: string;
  descricao: string;
}

const OPCOES: Opcao[] = [
  { key: "cadastro", label: "Cadastro de estabelecimentos aberto", descricao: "Novos parceiros podem se inscrever pelo portal." },
  { key: "aprovacao", label: "Aprovação manual de cupons", descricao: "Cupons novos passam por moderação antes de publicar." },
  { key: "ranking", label: "Ranking público de usuários", descricao: "Exibir o ranking de pontos no app do consumidor." },
  { key: "push", label: "Notificações push da plataforma", descricao: "Envio de campanhas e avisos globais." },
  { key: "manutencao", label: "Modo manutenção", descricao: "Suspende o app e o portal temporariamente." },
];

interface RegraPontos {
  key: string;
  acao: string;
}

const REGRAS: RegraPontos[] = [
  { key: "resgate", acao: "Resgatar um cupom" },
  { key: "nps", acao: "Responder NPS" },
  { key: "indicacao", acao: "Indicar um amigo" },
  { key: "visita", acao: "Visita diária ao app" },
];

export function ConfiguracoesClient({
  configPontos,
}: {
  configPontos: Record<string, number>;
}) {
  const [pontos, setPontos] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(REGRAS.map((r) => [r.key, configPontos[r.key] ?? 0])),
  );
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!salvo) return;
    const t = window.setTimeout(() => setSalvo(false), 4000);
    return () => window.clearTimeout(t);
  }, [salvo]);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const r = await salvarConfigPontosAction(pontos);
    setSalvando(false);
    if (r.ok) {
      setSalvo(true);
    } else {
      setErro(r.erro);
    }
  }

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Parâmetros da plataforma e regras de gamificação."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 lg:p-6">
          <h2 className="text-lg font-bold">Plataforma</h2>
          <p className="text-sm text-muted-foreground">
            Controles globais ainda sem backend — não alteram o app.
          </p>
          <div className="mt-4 divide-y divide-border">
            {OPCOES.map((o) => (
              <div key={o.key} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.descricao}</p>
                </div>
                <Badge variant="muted">Em breve</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Trophy className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Tabela de pontos</h2>
              <p className="text-sm text-muted-foreground">
                Quantos pontos cada ação concede. Gravado na tabela de pontos.
              </p>
            </div>
          </div>

          {salvo && (
            <div className="mt-4 flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
              <Check className="h-4 w-4" /> Tabela de pontos salva.
            </div>
          )}
          {erro && (
            <p className="mt-4 text-sm font-semibold text-danger">{erro}</p>
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

          <Button className="mt-5" onClick={() => void salvar()} disabled={salvando}>
            <Check className="h-4 w-4" />
            {salvando ? "Salvando…" : "Salvar tabela de pontos"}
          </Button>
        </Card>
      </div>
    </>
  );
}
