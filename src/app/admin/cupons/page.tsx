import { Ticket } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function AdminCupons() {
  return (
    <>
      <PageHeader
        title="Cupons"
        description="Todos os cupons publicados na plataforma."
      />
      <PagePlaceholder
        icon={<Ticket className="h-6 w-6" />}
        title="Moderação de cupons"
        description="A curadoria e a moderação de cupons serão detalhadas em breve."
      />
    </>
  );
}
