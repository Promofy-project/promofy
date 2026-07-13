"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { cuponsVisiveis } from "@/lib/mock-data";
import { useFavorites } from "@/components/favorites-provider";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { CouponListItem } from "@/components/coupon-list-item";
import { Button } from "@/components/ui/button";

export default function FavoritosPage() {
  const { favoriteIds } = useFavorites();
  const favoritos = cuponsVisiveis.filter((c) => favoriteIds.has(c.id));

  return (
    <div className="flex flex-col">
      <MobilePageHeader title="Favoritos" back="/m" />

      <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
        {favoritos.length === 0 ? (
          <div className="grid place-items-center rounded-card border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <div className="max-w-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Heart className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold">Nenhum favorito ainda</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Favorite cupons no catálogo e eles aparecerão aqui.
              </p>
              <Button asChild className="mt-6">
                <Link href="/m">Explorar ofertas</Link>
              </Button>
            </div>
          </div>
        ) : (
          favoritos.map((c) => (
            <CouponListItem key={c.id} cupom={c} href={`/m/cupom/${c.id}`} />
          ))
        )}
      </div>
    </div>
  );
}
