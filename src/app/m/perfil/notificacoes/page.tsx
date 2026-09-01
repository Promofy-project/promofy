import { MobilePageHeader } from "@/components/mobile-page-header";

export default function NotificacoesPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Notificações" back="/m/perfil" />

      <div className="px-4 pb-6 pt-4">
        <div className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-semibold">Nenhuma notificação por aqui</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quando houver avisos da sua conta, eles aparecem nesta tela. Não
            listamos exemplos no lugar.
          </p>
        </div>
      </div>
    </div>
  );
}
