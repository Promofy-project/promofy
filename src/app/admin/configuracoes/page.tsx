import { Settings } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function AdminConfiguracoes() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Parâmetros gerais da plataforma e permissões."
      />
      <PagePlaceholder
        icon={<Settings className="h-6 w-6" />}
        title="Configurações da plataforma"
        description="As opções administrativas serão detalhadas em uma próxima etapa."
      />
    </>
  );
}
