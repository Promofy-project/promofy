import { DashboardShell } from "@/components/sidebar";
import { buscarEstabelecimentoDaSessao } from "@/lib/data/estab";
import { buscarPendenciasLegais } from "@/lib/data/legal";
import { GateReaceite } from "@/components/gate-reaceite";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [est, pendencias] = await Promise.all([
    buscarEstabelecimentoDaSessao(),
    buscarPendenciasLegais("lojista"),
  ]);

  // Contas lojista já existentes (seed/QA) nunca aceitaram Termos
  // Parceiro/Privacidade — handle_new_user só grava aceite para
  // consumidor (mig. 20260902140000). Fase 16/17: gate no próximo
  // acesso, sem bloquear/apagar nada retroativamente.
  if (pendencias.length > 0) {
    return (
      <DashboardShell
        variant="portal"
        identidade={{ nome: est?.nome ?? "Estabelecimento", papel: "Estabelecimento" }}
      >
        <GateReaceite pendentes={pendencias} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      variant="portal"
      identidade={{
        nome: est?.nome ?? "Estabelecimento",
        papel: "Estabelecimento",
      }}
    >
      {children}
    </DashboardShell>
  );
}
