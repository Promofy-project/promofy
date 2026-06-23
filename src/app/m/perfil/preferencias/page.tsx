import { SlidersHorizontal } from "lucide-react";

import { MobilePageHeader } from "@/components/mobile-page-header";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PreferenciasPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Preferências de cupons" back="/m/perfil" />
      <div className="px-4 pt-5">
        <PagePlaceholder
          icon={<SlidersHorizontal className="h-6 w-6" />}
          title="Preferências de cupons"
          description="A configuração de categorias e alertas favoritos chega em breve."
        />
      </div>
    </div>
  );
}
