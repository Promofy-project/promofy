"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

interface Opcao {
  key: string;
  label: string;
  descricao: string;
}

const SECOES: { titulo: string; descricao: string; opcoes: Opcao[] }[] = [
  {
    titulo: "Notificações",
    descricao: "Ainda não disparamos estes avisos. Quando existirem, esta tela passa a gravá-los.",
    opcoes: [
      { key: "n-resgates", label: "Novos resgates", descricao: "Avise quando um cliente resgatar um cupom." },
      { key: "n-avaliacoes", label: "Novas avaliações", descricao: "Avise quando alguém avaliar seu estabelecimento." },
      { key: "n-resumo", label: "Resumo semanal por e-mail", descricao: "Um panorama do desempenho toda segunda." },
    ],
  },
  {
    titulo: "Visibilidade no app",
    descricao: "A vitrine hoje segue o status do estabelecimento no cadastro, não um interruptor aqui.",
    opcoes: [
      { key: "v-exibir", label: "Exibir estabelecimento no app", descricao: "Seus cupons aparecem nas buscas e na home." },
      { key: "v-destaque", label: "Destacar como recomendado", descricao: "Maior visibilidade em troca de impulsionamento." },
    ],
  },
  {
    titulo: "Funcionamento",
    descricao: "Horário de consumo vive no cupom, não nesta tela.",
    opcoes: [
      { key: "f-aberto", label: "Aberto agora", descricao: "Aceitar resgates no horário atual." },
      { key: "f-feriados", label: "Funcionar em feriados", descricao: "Manter cupons ativos em feriados." },
    ],
  },
];

export default function PortalConfiguracoes() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências ainda não operacionais — nada aqui altera o app."
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
                  <Badge variant="muted">Em breve</Badge>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
