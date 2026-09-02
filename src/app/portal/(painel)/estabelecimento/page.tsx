import { Store, MapPin, Tag } from "lucide-react";

import { buscarEstabelecimentoDaSessao } from "@/lib/data/estab";
import { buscarCatalogoResolucao } from "@/lib/data/taxonomia";
import { rotuloHierarquico } from "@/lib/categoria-visual";
import { urlPublicaImagem } from "@/lib/imagem-cupom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EstabelecimentoForm } from "./estabelecimento-form";

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
 * Identidade do estabelecimento da SESSÃO. Nome, cidade e logo persistem
 * de verdade (grant + coluna `logo`). Categoria e status não se editam
 * aqui — são do cadastro/moderação.
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

  const logoUrl = est
    ? urlPublicaImagem(
        est.logo,
        est.id,
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      )
    : null;

  return (
    <>
      <PageHeader
        title="Estabelecimento"
        description="Dados do seu negócio. Nome, cidade e logo são gravados no cadastro."
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
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-20 w-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Store className="h-9 w-9" />
              </div>
            )}
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
            <EstabelecimentoForm
              id={est.id}
              nomeInicial={est.nome}
              cidadeInicial={est.cidade}
              bairroInicial={est.bairro}
              latitudeInicial={est.latitude}
              longitudeInicial={est.longitude}
              logoInicial={est.logo}
            />
            <dl className="mt-6 flex flex-col gap-4 border-t border-border pt-4 text-sm">
              <div>
                <dt className="font-semibold text-foreground">Categoria</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {categoriaLabel
                    ? rotuloHierarquico(segmentoLabel, categoriaLabel)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Cidade cadastrada</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {est.cidade || "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">
              Telefone, WhatsApp, Instagram, descrição e galeria ainda não
              têm cadastro neste app.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
