import { DashboardShell } from "@/components/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      variant="admin"
      identidade={{ nome: "Equipe Promofy", papel: "Administrador" }}
    >
      {children}
    </DashboardShell>
  );
}
