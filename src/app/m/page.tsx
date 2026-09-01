import { redirect } from "next/navigation";
import Link from "next/link";

import { buscarCuponsHome, contarNovidades } from "@/lib/data/cupons";
import { buscarFiltrosPublicos } from "@/lib/data/categorias";
import { buscarFiltrosTaxonomia } from "@/lib/data/taxonomia";
import {
  hrefBusca,
  normalizarFiltroUrl,
  precisaCanonicalizar,
} from "@/lib/taxonomia-url";
import { HomeHeader } from "@/components/home-header";
import { BannerCarousel } from "@/components/banner-carousel";
import { HomeSearchBar } from "@/components/home-search-bar";
import { HomeCategoryChips } from "@/components/home-category-chips";
import { CouponCard } from "@/components/coupon-card";
import { CupomSeloUtilizado } from "@/components/cupom-selo-utilizado";
import { RankingBlock } from "@/components/ranking-block";
import { PointsSummary } from "@/components/points-summary";
import { NpsPendenteCard } from "@/components/nps-pendente-card";

export const dynamic = "force-dynamic";

export default async function MobileHome({
  searchParams,
}: {
  searchParams?: { cat?: string; seg?: string };
}) {
  // `buscarFiltrosPublicos` permanece: test-tx-p2a exige essa fronteira
  // nas telas de descoberta. O snapshot de URL vem da mesma view.
  const [categorias, filtroTax] = await Promise.all([
    buscarFiltrosPublicos(),
    buscarFiltrosTaxonomia(),
  ]);

  const bruto = { seg: searchParams?.seg, cat: searchParams?.cat };
  if (bruto.seg || bruto.cat) {
    const canon = normalizarFiltroUrl(bruto, filtroTax.catalogoUrl);
    if (precisaCanonicalizar(bruto, canon) || canon.seg) {
      redirect(hrefBusca(canon));
    }
  }

  const [grid, novidades] = await Promise.all([
    buscarCuponsHome(6),
    contarNovidades(),
  ]);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <HomeHeader novidades={novidades} />
      <BannerCarousel />
      <HomeSearchBar />

      <div className="px-4">
        <PointsSummary />
      </div>

      <div className="px-4 empty:hidden">
        <NpsPendenteCard />
      </div>

      <div className="px-4">
        {categorias.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os segmentos agora.
          </p>
        ) : (
          <HomeCategoryChips categorias={categorias} />
        )}
      </div>

      <section className="px-4">
        {grid.length === 0 && (
          <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum cupom por enquanto.{" "}
            <Link href="/m/buscar" className="font-bold text-primary hover:underline">
              Ver busca
            </Link>
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          {grid.map((c) => (
            <CouponCard
              key={c.id}
              cupom={c}
              href={`/m/cupom/${c.id}`}
              economiaTone="blue"
              compact
              overlay={<CupomSeloUtilizado cupomId={c.id} />}
            />
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/m/buscar"
            className="text-sm font-bold text-primary hover:underline"
          >
            Ver mais
          </Link>
        </div>
      </section>

      <div className="px-4">
        <RankingBlock />
      </div>
    </div>
  );
}
