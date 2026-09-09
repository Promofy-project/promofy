import { notFound } from "next/navigation";
import { MapPin, Store, Ticket } from "lucide-react";

import { buscarEstabelecimentoPublico } from "@/lib/data/estab";
import { buscarGaleriaPublica } from "@/lib/data/galeria-estab";
import { buscarCuponsDoEstabelecimento } from "@/lib/data/cupons";
import {
  CATEGORIA_VISUAL_FALLBACK,
  rotuloHierarquico,
} from "@/lib/categoria-visual";
import { urlPublicaImagem } from "@/lib/imagem-cupom";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { GaleriaPerfilEstab } from "@/components/galeria-perfil-estab";
import { CouponListItem } from "@/components/coupon-list-item";
import { FavoriteButton } from "@/components/favorite-button";
import { Icon } from "@/components/icon";

/**
 * Perfil público do estabelecimento (CLIENT-RETURNS-03).
 *
 * POR QUE ESTA ROTA NASCE AQUI. O WP partiu de "o detalhe do estabelecimento
 * no consumidor já existe" — e não existia: o /m tinha a LISTA
 * (`/m/estabelecimentos`) e o detalhe do CUPOM, e o cupom já dizia em voz alta
 * que "é no perfil do estabelecimento que essas avaliações ficam". A galeria é
 * do perfil; sem uma tela de perfil ela não teria onde aparecer para o
 * consumidor, e a entrega ficaria pela metade.
 *
 * O que esta página mostra é só o que o schema tem: identidade, categoria,
 * localização (cidade/bairro), a galeria e os cupons visíveis. Telefone,
 * WhatsApp, endereço e nota não entram — inventá-los seria dado falso ao lado
 * de oferta real, que é o que a Fase 9/Z3 tirou do app.
 */
export const dynamic = "force-dynamic";

export default async function EstabelecimentoPerfil({
  params,
}: {
  params: { id: string };
}) {
  const est = await buscarEstabelecimentoPublico(params.id);
  // `null` = não existe OU não está ativo. Os dois viram 404: a rota não
  // confirma o cadastro de quem está pendente/suspenso.
  if (!est) notFound();

  const [galeria, cupons] = await Promise.all([
    buscarGaleriaPublica(est.id),
    buscarCuponsDoEstabelecimento(est.id),
  ]);

  const categoria = est.categoriaVisual ?? CATEGORIA_VISUAL_FALLBACK;
  const logoUrl = urlPublicaImagem(
    est.logo,
    est.id,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const local = [est.bairro, est.cidade].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Estabelecimento" back="/m/estabelecimentos" />

      <div className="flex flex-col gap-6 px-4 pb-10 pt-4">
        {/* Identidade — a logo continua sendo a logo, no mesmo lugar de sempre.
            A galeria é uma seção ADICIONAL, mais abaixo. */}
        <header className="flex items-start gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
              style={{ background: categoria.gradiente }}
            >
              <Icon name={categoria.icon} className="h-8 w-8 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold leading-snug">{est.nome}</h2>
            <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
              {rotuloHierarquico(categoria.segmentoLabel, categoria.label)}
            </p>
            {local ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {local}
              </p>
            ) : null}
          </div>
          <FavoriteButton estabelecimentoId={est.id} />
        </header>

        {/* Galeria do PERFIL. Devolve `null` quando não há imagem — sem título
            órfão, sem retângulo cinza. */}
        <GaleriaPerfilEstab
          nomeEstabelecimento={est.nome}
          imagens={galeria.map((i) => ({ id: i.id, url: i.url }))}
        />

        <section>
          <h3 className="mb-2 text-base font-bold">Ofertas deste estabelecimento</h3>
          {cupons.length === 0 ? (
            <div className="flex items-start gap-3 rounded-card border border-border bg-card p-4">
              <Ticket
                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold">Nenhuma oferta no momento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Favorite o estabelecimento para acompanhar as próximas.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {cupons.map((c) => (
                <li key={c.id}>
                  <CouponListItem cupom={c} href={`/m/cupom/${c.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Estado honesto: o que o cadastro não tem, a tela não inventa. */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Telefone, endereço completo e avaliações ainda não fazem parte do
          cadastro do estabelecimento.
        </p>
      </div>
    </div>
  );
}
