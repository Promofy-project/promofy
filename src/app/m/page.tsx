import Link from "next/link";

import { buscarCuponsHome, contarNovidades } from "@/lib/data/cupons";
import { buscarCategorias, categoriaValida } from "@/lib/data/categorias";
import { HomeHeader } from "@/components/home-header";
import { BannerCarousel } from "@/components/banner-carousel";
import { HomeSearchBar } from "@/components/home-search-bar";
import { HomeCategoryChips } from "@/components/home-category-chips";
import { CouponCard } from "@/components/coupon-card";
import { CupomSeloUtilizado } from "@/components/cupom-selo-utilizado";
import { RankingBlock } from "@/components/ranking-block";
import { PointsSummary } from "@/components/points-summary";

// Dados agora vêm do Supabase: nada de prerender estático no build
// (o banco não precisa estar de pé para `next build` passar).
export const dynamic = "force-dynamic";

export default async function MobileHome({
  searchParams,
}: {
  searchParams?: { cat?: string };
}) {
  // Fase 6/H5: o chip selecionado vive na URL, não em estado de cliente.
  // A categoria é saneada contra a tabela ANTES de virar predicado — um
  // `?cat=xpto` vira "sem filtro" e a home segue cheia, nunca vazia.
  const categorias = await buscarCategorias();
  const cat = categoriaValida(searchParams?.cat, categorias);

  const [grid, novidades] = await Promise.all([
    buscarCuponsHome(6, cat),
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

      <div className="px-4">
        <HomeCategoryChips categorias={categorias} ativa={cat} />
      </div>

      {/* Grid de cupons */}
      <section className="px-4">
        {grid.length === 0 && (
          <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum cupom nesta categoria por enquanto.{" "}
            <Link href="/m" className="font-bold text-primary hover:underline">
              Ver todos
            </Link>
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          {grid.map((c, i) => (
            <CouponCard
              key={c.id}
              cupom={c}
              href={`/m/cupom/${c.id}`}
              economiaTone="blue"
              compact
              ctaLabel={i % 3 === 2 ? "Regras de uso" : "Usar agora"}
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

      {/* Ranking */}
      <div className="px-4">
        <RankingBlock />
      </div>
    </div>
  );
}
