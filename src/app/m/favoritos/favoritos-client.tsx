"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import type { Cupom } from "@/lib/types";
import { useFavorites } from "@/components/favorites-provider";
import { CouponListItem } from "@/components/coupon-list-item";
import { Button } from "@/components/ui/button";

/**
 * Corpo client dos favoritos (Fase 4): a lista chega do banco (cupons
 * visíveis dos estabelecimentos favoritados) e é filtrada AO VIVO pelo
 * estado do provider — desfavoritar remove o item sem reload.
 */
export function FavoritosClient({
  cupons,
  logado,
}: {
  cupons: Cupom[];
  logado: boolean;
}) {
  const { favoriteIds } = useFavorites();
  const favoritos = cupons.filter((c) => favoriteIds.has(c.estabelecimentoId));

  if (favoritos.length === 0) {
    return (
      <div className="grid place-items-center rounded-card border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Heart className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold">
            {logado ? "Nenhum favorito ainda" : "Entre para ver seus favoritos"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {logado
              ? "Favorite estabelecimentos tocando no coração dos cupons — as ofertas deles aparecerão aqui."
              : "Faça login para favoritar estabelecimentos e acompanhar as ofertas deles por aqui."}
          </p>
          <Button asChild className="mt-6">
            <Link href={logado ? "/m" : "/m/login"}>
              {logado ? "Explorar ofertas" : "Entrar"}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {favoritos.map((c) => (
        <CouponListItem key={c.id} cupom={c} href={`/m/cupom/${c.id}`} />
      ))}
    </>
  );
}
