import { MobilePageHeader } from "@/components/mobile-page-header";

export default function PreferenciasPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Preferências" back="/m/perfil" />

      <div className="px-4 pb-6 pt-4">
        <div className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-semibold">
            Preferências ainda não estão disponíveis
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Categorias de interesse, raio e avisos ainda não têm cadastro neste
            app. Não gravamos escolhas só na tela.
          </p>
        </div>
      </div>
    </div>
  );
}
