import { CircleDollarSign } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

/**
 * Financeiro. Não há fetcher de assinatura no runtime — a tabela existe,
 * mas nenhum fluxo de produto a alimenta nem a lê.
 */
export default function AdminFinanceiro() {
  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receita e assinaturas da plataforma."
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <CircleDollarSign className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-semibold">Indicadores financeiros ainda não estão no ar</p>
          <p className="max-w-md text-sm text-muted-foreground">
            MRR, ticket médio, LTV e churn não têm fonte operacional neste app.
            Não exibimos valores de exemplo no lugar.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
