import { Tag } from "lucide-react";

import { buscarPlanosConsumidor } from "@/lib/data/planos";
import { PlanCard } from "@/components/plan-card";
import { MobilePageHeader } from "@/components/mobile-page-header";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const planos = await buscarPlanosConsumidor();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Planos" back="/m/perfil" />

      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        <p className="text-center text-sm text-muted-foreground">
          Planos pagos são contrato anual de 12 meses. O valor mostrado é a
          parcela — não um plano mensal avulso. Pagamento à vista ou em 12
          parcelas quando a cobrança estiver no ar.
        </p>

        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
          <Tag className="h-4 w-4" />
          Código promocional em breve
        </p>

        <div className="flex flex-col gap-5">
          {planos.map((p) => (
            <PlanCard key={p.id} plano={p} actionTone="yellow" />
          ))}
        </div>
      </div>
    </div>
  );
}
