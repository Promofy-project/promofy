"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";

interface Opcao {
  key: string;
  label: string;
  descricao: string;
  inicial: boolean;
}

const SECOES: { titulo: string; descricao: string; opcoes: Opcao[] }[] = [
  {
    titulo: "Notificações",
    descricao: "Escolha o que você quer receber.",
    opcoes: [
      { key: "n-resgates", label: "Novos resgates", descricao: "Avise quando um cliente resgatar um cupom.", inicial: true },
      { key: "n-avaliacoes", label: "Novas avaliações", descricao: "Avise quando alguém avaliar seu estabelecimento.", inicial: true },
      { key: "n-resumo", label: "Resumo semanal por e-mail", descricao: "Um panorama do desempenho toda segunda.", inicial: false },
    ],
  },
  {
    titulo: "Visibilidade no app",
    descricao: "Controle como você aparece para os clientes.",
    opcoes: [
      { key: "v-exibir", label: "Exibir estabelecimento no app", descricao: "Seus cupons aparecem nas buscas e na home.", inicial: true },
      { key: "v-destaque", label: "Destacar como recomendado", descricao: "Maior visibilidade em troca de impulsionamento.", inicial: false },
    ],
  },
  {
    titulo: "Funcionamento",
    descricao: "Disponibilidade para resgates.",
    opcoes: [
      { key: "f-aberto", label: "Aberto agora", descricao: "Aceitar resgates no horário atual.", inicial: true },
      { key: "f-feriados", label: "Funcionar em feriados", descricao: "Manter cupons ativos em feriados.", inicial: false },
    ],
  },
];

export default function PortalConfiguracoes() {
  const [estado, setEstado] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      SECOES.flatMap((s) => s.opcoes.map((o) => [o.key, o.inicial])),
    ),
  );

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências de notificações, visibilidade e funcionamento."
      />

      <div className="flex flex-col gap-6">
        {SECOES.map((secao) => (
          <Card key={secao.titulo} className="p-5 lg:p-6">
            <h2 className="text-lg font-bold">{secao.titulo}</h2>
            <p className="text-sm text-muted-foreground">{secao.descricao}</p>

            <div className="mt-4 divide-y divide-border">
              {secao.opcoes.map((o) => (
                <div
                  key={o.key}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {o.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.descricao}
                    </p>
                  </div>
                  <Switch
                    checked={estado[o.key]}
                    onCheckedChange={(v) =>
                      setEstado((prev) => ({ ...prev, [o.key]: v }))
                    }
                    aria-label={o.label}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
