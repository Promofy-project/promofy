import { CreditCard } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PortalPlanos() {
  return (
    <>
      <PageHeader
        title="Planos"
        description="Sua assinatura e formas de pagamento."
      />
      <PagePlaceholder
        icon={<CreditCard className="h-6 w-6" />}
        title="Plano e assinatura"
        description="A gestão de plano e cobrança será detalhada em uma próxima etapa."
      />
    </>
  );
}
