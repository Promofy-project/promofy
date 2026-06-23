import { Bell } from "lucide-react";

import { MobilePageHeader } from "@/components/mobile-page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function NotificacoesPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Notificações" back="/m/perfil" />
      <div className="px-4 pt-5">
        <PagePlaceholder
          icon={<Bell className="h-6 w-6" />}
          title="Suas notificações"
          description="O histórico de notificações será detalhado em breve."
        />
      </div>
    </div>
  );
}
