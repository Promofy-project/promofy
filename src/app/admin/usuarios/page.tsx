import { Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function AdminUsuarios() {
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Base de assinantes, níveis e atividade."
      />
      <PagePlaceholder
        icon={<Users className="h-6 w-6" />}
        title="Gestão de usuários"
        description="A listagem completa e os perfis de usuário chegam em breve."
      />
    </>
  );
}
