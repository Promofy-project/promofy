import { Store, MapPin, Tag } from "lucide-react";

import { buscarEstabelecimentoDaSessao } from "@/lib/data/estab";
import { buscarCatalogoResolucao } from "@/lib/data/taxonomia";
import { rotuloHierarquico } from "@/lib/categoria-visual";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Em análise",
  suspenso: "Suspenso",
};

const STATUS_VARIANT: Record<string, "success" | "yellow-soft" | "danger"> = {
  ativo: "success",
  pendente: "yellow-soft",
  suspenso: "danger",
};

/**
 * Identidade do estabelecimento da SESSÃO. Sem save: nome/cidade/status
 * existem no schema; descrição, Instagram, WhatsApp e telefone não.
 * O CTA "Salvar" anterior só setava estado local e fingia persistência.
 */
export default async function PortalEstabelecimento() {
  const est = await buscarEstabelecimentoDaSessao();

  let categoriaLabel: string | null = null;
  let segmentoLabel: string | null = null;
  if (est?.categoriaPrincipalId) {
    const catalogo = await buscarCatalogoResolucao();
    const vis = catalogo.find((c) => c.id === est.categoriaPrincipalId);
    categoriaLabel = vis?.label ?? null;
    segmentoLabel = vis?.segmentoLabel ?? null;
  }

  return (
    <>
      <PageHeader
        title="Estabelecimento"
        description="Dados cadastrados do seu negócio. A edição ainda não está disponível nesta tela."
      />

      {!est ? (
        <Card className="border-dashed px-4 py-16 text-center">
          <p className="text-sm font-semibold">Nenhum estabelecimento vinculado</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Esta conta ainda não tem estabelecimento. Não exibimos um exemplo
            no lugar.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="flex flex-col items-center p-6 text-center lg:self-start">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Store className="h-9 w-9" />
            </div>
            <h2 className="mt-4 text-lg font-bold">{est.nome}</h2>
            <p className="text-sm text-muted-foreground">{est.cidade || "—"}</p>
            <Badge
              variant={STATUS_VARIANT[est.status] ?? "muted"}
              className="mt-3"
            >
              {STATUS_LABEL[est.status] ?? est.status}
            </Badge>
          </Card>

          <Card className="p-5 lg:p-6">
            <dl className="flex flex-col gap-4 text-sm">
              <div>
                <dt className="font-semibold text-foreground">Nome</dt>
                <dd className="mt-1 text-muted-foreground">{est.nome}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Cidade</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {est.cidade || "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Categoria</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {categoriaLabel
                    ? rotuloHierarquico(segmentoLabel, categoriaLabel)
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">
              Telefone, WhatsApp, Instagram e descrição ainda não têm cadastro
              neste app. Alterações não são gravadas por esta tela.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
