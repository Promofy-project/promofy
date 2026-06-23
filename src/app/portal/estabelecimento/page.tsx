import { Store } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PortalEstabelecimento() {
  return (
    <>
      <PageHeader
        title="Estabelecimento"
        description="Informações, endereço e horários do seu negócio."
      />
      <PagePlaceholder
        icon={<Store className="h-6 w-6" />}
        title="Dados do estabelecimento"
        description="O cadastro completo do negócio será detalhado em breve."
      />
    </>
  );
}
