import type { Plano } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { PlanCard } from "@/components/plan-card";

// Planos de assinatura do estabelecimento (visão do lojista) — só do portal.
const planosEstabelecimento: Plano[] = [
  {
    id: "divulgacao",
    nome: "Divulgação",
    preco: 0,
    periodo: "/mês",
    descricao: "Para começar a aparecer no app.",
    beneficios: [
      "Perfil do estabelecimento no app",
      "Até 2 cupons ativos",
      "Métricas básicas de desempenho",
    ],
  },
  {
    id: "profissional",
    nome: "Profissional",
    preco: 149,
    periodo: "/mês",
    descricao: "O plano de quem leva os cupons a sério.",
    beneficios: [
      "Cupons ilimitados",
      "Métricas avançadas e funil por cupom",
      "Validação por código e QR",
      "Destaque nas buscas do app",
    ],
    destaque: true,
    badge: "Plano atual",
  },
  {
    id: "premium",
    nome: "Premium",
    preco: 349,
    periodo: "/mês",
    descricao: "Máxima exposição e suporte dedicado.",
    beneficios: [
      "Tudo do Profissional",
      "Campanhas patrocinadas na home",
      "Gerente de conta dedicado",
      "Relatórios mensais personalizados",
    ],
  },
];

export default function PortalPlanos() {
  return (
    <>
      <PageHeader
        title="Planos"
        description="Escolha o plano que mais combina com o seu negócio."
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {planosEstabelecimento.map((p) => (
          <PlanCard key={p.id} plano={p} />
        ))}
      </div>
    </>
  );
}
