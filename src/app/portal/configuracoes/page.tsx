import { Settings } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PortalConfiguracoes() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências da conta e da equipe."
      />
      <PagePlaceholder
        icon={<Settings className="h-6 w-6" />}
        title="Configurações"
        description="As opções de conta e notificações serão detalhadas em breve."
      />
    </>
  );
}
