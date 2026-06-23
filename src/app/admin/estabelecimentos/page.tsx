import { Store } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function AdminEstabelecimentos() {
  return (
    <>
      <PageHeader
        title="Estabelecimentos"
        description="Aprovação, gestão e desempenho dos parceiros."
      />
      <PagePlaceholder
        icon={<Store className="h-6 w-6" />}
        title="Gestão de estabelecimentos"
        description="A moderação e os detalhes de cada parceiro chegam em breve."
      />
    </>
  );
}
