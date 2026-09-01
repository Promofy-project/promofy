import Link from "next/link";
import { BarChart3, Store, Users, Ticket } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

/**
 * Painel geral. Receita, funil, MRR e ranking não têm fetcher de produto.
 * Cadastros reais estão nas telas ao lado.
 */
export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="Painel geral"
        description="Moderação e cadastros estão nas telas ao lado. Indicadores de receita, funil e ranking ainda não estão no ar."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/estabelecimentos"
          className="rounded-card border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <Store className="h-5 w-5 text-primary" aria-hidden />
          <p className="mt-3 text-sm font-bold">Estabelecimentos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lista real — ativos, pendentes e suspensos.
          </p>
        </Link>
        <Link
          href="/admin/usuarios"
          className="rounded-card border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <Users className="h-5 w-5 text-primary" aria-hidden />
          <p className="mt-3 text-sm font-bold">Usuários</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Consumidores e economia gerada no banco.
          </p>
        </Link>
        <Link
          href="/admin/cupons"
          className="rounded-card border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
        >
          <Ticket className="h-5 w-5 text-primary" aria-hidden />
          <p className="mt-3 text-sm font-bold">Cupons</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fila de moderação com dados reais.
          </p>
        </Link>
      </div>

      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Indicadores de plataforma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-semibold">Ainda não disponíveis</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            MRR, funil, crescimento e ranking de consumidores não têm fonte
            operacional neste app. Não exibimos números de exemplo no lugar.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
