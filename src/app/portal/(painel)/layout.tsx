import { DashboardShell } from "@/components/sidebar";
import { buscarEstabelecimentoDaSessao } from "@/lib/data/estab";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const est = await buscarEstabelecimentoDaSessao();
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
