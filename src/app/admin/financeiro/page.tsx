import { DollarSign } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function AdminFinanceiro() {
  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receita, repasses e assinaturas da plataforma."
      />
      <PagePlaceholder
        icon={<DollarSign className="h-6 w-6" />}
        title="Visão financeira"
        description="Relatórios de receita e repasses serão detalhados em breve."
      />
    </>
  );
}
