import { Suspense } from "react";

import { buscarCrmClientes } from "@/lib/data/crm";
import type { CrmFiltro } from "@/lib/crm-tipos";
import { ClientesClient } from "./clientes-client";

export const dynamic = "force-dynamic";

const FILTROS: CrmFiltro[] = ["todos", "recentes", "recorrentes", "periodo_90d"];

function lerFiltro(raw: string | undefined): CrmFiltro {
  if (raw && (FILTROS as string[]).includes(raw)) return raw as CrmFiltro;
  return "todos";
}

export default async function PortalClientesPage({
  searchParams,
}: {
  searchParams?: { q?: string; filtro?: string; pagina?: string };
}) {
  const q = searchParams?.q ?? "";
  const filtro = lerFiltro(searchParams?.filtro);
  const pagina = Math.max(1, Number(searchParams?.pagina ?? 1) || 1);

  const lista = await buscarCrmClientes({
    q: q || null,
    filtro,
    pagina,
    porPagina: 20,
  });

  return (
    <Suspense fallback={null}>
      <ClientesClient
        clientes={lista.clientes}
        resumo={lista.resumo}
        total={lista.total}
        pagina={lista.pagina}
        porPagina={lista.porPagina}
        qInicial={q}
        filtroInicial={filtro}
      />
    </Suspense>
  );
}
