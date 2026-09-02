import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

/**
 * Participação do estabelecimento é gratuita. Planos pagos de parceiro
 * (R$149 / R$349) não são produto vigente — não se apresentam como reais.
 */
export default function PortalPlanos() {
  return (
    <>
      <PageHeader
        title="Participação"
        description="O estabelecimento participa do Promofy sem mensalidade."
      />

      <Card className="max-w-xl p-6">
        <h2 className="text-lg font-extrabold">Gratuito para o parceiro</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Publicar cupons, validar no balcão e acompanhar o desempenho da
          loja não exige plano pago. Não há assinatura Profissional ou
          Premium à venda neste momento.
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          <li>Perfil do estabelecimento no app</li>
          <li>Criação e moderação de cupons</li>
          <li>Validação por código no balcão e no portal</li>
        </ul>
      </Card>
    </>
  );
}
