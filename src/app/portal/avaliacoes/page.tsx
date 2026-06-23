import { Star } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PortalAvaliacoes() {
  return (
    <>
      <PageHeader
        title="Avaliações"
        description="O que os clientes estão dizendo sobre você."
      />
      <PagePlaceholder
        icon={<Star className="h-6 w-6" />}
        title="Avaliações dos clientes"
        description="O painel de avaliações e respostas será detalhado em breve."
      />
    </>
  );
}
