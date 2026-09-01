import { MobilePageHeader } from "@/components/mobile-page-header";

export default function PagamentoPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Pagamento" back="/m/perfil" />

      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        <div className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-semibold">Nenhum cartão cadastrado</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            O cadastro de pagamento ainda não está disponível neste app. Não
            exibimos um cartão de exemplo no lugar.
          </p>
        </div>
      </div>
    </div>
  );
}
