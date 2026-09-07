import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buscarCrmClienteDetalhe } from "@/lib/data/crm";
import { crmCampoOuNaoInformado } from "@/lib/crm-tipos";
import { formatBRL, formatShortDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PortalClienteDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID_RE.test(params.id)) notFound();

  const det = await buscarCrmClienteDetalhe(params.id);
  if (!det.ok || !det.cliente) notFound();

  const c = det.cliente;

  return (
    <>
      <PageHeader
        title={crmCampoOuNaoInformado(c.nome)}
        description="Histórico de resgates neste estabelecimento."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/portal/clientes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">E-mail</p>
          <p className="mt-1 text-sm font-semibold break-all">
            {crmCampoOuNaoInformado(c.email)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Telefone</p>
          <p className="mt-1 text-sm font-semibold">
            {crmCampoOuNaoInformado(c.telefone)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Nascimento</p>
          <p className="mt-1 text-sm font-semibold">
            {crmCampoOuNaoInformado(c.nascimento)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Resgates</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {c.totalResgates}
            <span className="ml-2 font-normal text-muted-foreground">
              · primeiro{" "}
              {c.primeiroResgate ? formatShortDate(c.primeiroResgate) : "—"}
            </span>
          </p>
        </Card>
      </div>

      <h2 className="mt-8 text-base font-bold">Histórico de resgates</h2>

      {det.historico.length === 0 ? (
        <Card className="mt-3 p-6 text-sm text-muted-foreground">
          Nenhum resgate confirmado.
        </Card>
      ) : (
        <>
          <div className="mt-3 hidden overflow-x-auto rounded-card border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cupom</th>
                  <th className="px-4 py-3 font-semibold">Benefício</th>
                  <th className="px-4 py-3 font-semibold">Economia</th>
                  <th className="px-4 py-3 font-semibold">Validado em</th>
                  <th className="px-4 py-3 font-semibold">NPS</th>
                </tr>
              </thead>
              <tbody>
                {det.historico.map((h, i) => (
                  <tr
                    key={`${h.cupomId}-${h.validadoEm}-${i}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{h.titulo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.beneficio}</td>
                    <td className="px-4 py-3">
                      {h.economiaVariavel
                        ? "Variável"
                        : h.economia != null
                          ? formatBRL(h.economia)
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {h.validadoEm ? formatShortDate(h.validadoEm) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {h.nps != null ? h.nps : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-col gap-3 md:hidden">
            {det.historico.map((h, i) => (
              <Card key={`${h.cupomId}-${h.validadoEm}-${i}`} className="p-4">
                <p className="font-semibold">{h.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{h.beneficio}</p>
                <p className="mt-2 text-sm">
                  {h.validadoEm ? formatShortDate(h.validadoEm) : "—"}
                  {" · "}
                  {h.economiaVariavel
                    ? "Economia variável"
                    : h.economia != null
                      ? formatBRL(h.economia)
                      : "—"}
                  {h.nps != null ? ` · NPS ${h.nps}` : ""}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
