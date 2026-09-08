import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatShortDate } from "@/lib/utils";
import { buscarAceitesDaSessao } from "@/lib/data/legal";
import {
  DOC_TERMOS_PARCEIRO,
  DOC_PRIVACIDADE,
  DOC_COOKIES,
  EMAIL_PRIVACIDADE,
} from "@/lib/documentos-legais";

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

export default async function PortalConfiguracoes() {
  const aceites = await buscarAceitesDaSessao();
  const aceitosPorDoc = new Map(aceites.map((a) => [a.documento, a]));
  const docsPrivacidade = [DOC_TERMOS_PARCEIRO, DOC_PRIVACIDADE, DOC_COOKIES];

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências ainda não operacionais — nada aqui altera o app."
      />

      <div className="flex flex-col gap-6">
        <Card className="p-5 lg:p-6">
          <h2 className="text-lg font-bold">Privacidade e dados</h2>
          <p className="text-sm text-muted-foreground">
            Documentos que regem sua conta de parceiro Promofy.
          </p>

          <div className="mt-4 divide-y divide-border">
            {docsPrivacidade.map((doc) => {
              const aceito = aceitosPorDoc.get(doc.documento);
              const emDia = aceito?.versao === doc.versao;
              return (
                <div
                  key={doc.documento}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/legal/${doc.slug}`}
                      target="_blank"
                      className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {doc.titulo}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {aceito
                        ? emDia
                          ? `Aceito em ${formatShortDate(aceito.aceitoEm)} (v${aceito.versao})`
                          : `Versão anterior aceita (v${aceito.versao}) — nova versão v${doc.versao} disponível`
                        : `Ainda não aceito (v${doc.versao})`}
                    </p>
                  </div>
                  <Badge variant={emDia ? "success" : "muted"}>
                    {emDia ? "Em dia" : "Pendente"}
                  </Badge>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Responsabilidades do CRM: você é controlador dos dados dos
            clientes que resgataram cupons no seu estabelecimento — o
            Promofy isola cada estabelecimento (você nunca vê dados de
            outro parceiro) e não guarda CPF nem texto de busca na
            auditoria de exportação. Para encerramento de conta de
            parceiro ou solicitações sobre dados de terceiros, fale com{" "}
            <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="underline">
              {EMAIL_PRIVACIDADE}
            </a>
            — este fluxo ainda não é self-service no portal.
          </p>
        </Card>

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
