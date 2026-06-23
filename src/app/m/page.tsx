import Link from "next/link";

import { cupons } from "@/lib/mock-data";
import { HomeHeader } from "@/components/home-header";
import { BannerCarousel } from "@/components/banner-carousel";
import { HomeSearchBar } from "@/components/home-search-bar";
import { HomeCategoryChips } from "@/components/home-category-chips";
import { CouponCard } from "@/components/coupon-card";
import { RankingBlock } from "@/components/ranking-block";

export default function MobileHome() {
  const grid = cupons.slice(0, 6);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <HomeHeader />
      <BannerCarousel />
      <HomeSearchBar />

      <div className="px-4">
        <HomeCategoryChips />
      </div>

      {/* Grid de cupons */}
      <section className="px-4">
        <div className="grid grid-cols-2 gap-3">
          {grid.map((c, i) => (
            <CouponCard
              key={c.id}
              cupom={c}
              href={`/m/cupom/${c.id}`}
              economiaTone="blue"
              compact
              ctaLabel={i % 3 === 2 ? "Regras de uso" : "Usar agora"}
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
