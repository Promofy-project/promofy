import { DashboardShell } from "@/components/sidebar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell variant="portal">{children}</DashboardShell>;
}
