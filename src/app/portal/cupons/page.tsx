import { Ticket } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PortalCupons() {
  return (
    <>
      <PageHeader
        title="Cupons"
        description="Crie, edite e acompanhe os cupons do seu estabelecimento."
      />
      <PagePlaceholder
        icon={<Ticket className="h-6 w-6" />}
        title="Gestão de cupons"
        description="A criação e edição de cupons será detalhada em uma próxima etapa."
      />
    </>
  );
}
