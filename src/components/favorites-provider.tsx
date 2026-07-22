"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { favoritarAction, desfavoritarAction } from "@/lib/actions/favoritos";

/**
 * Favoritos de ESTABELECIMENTO persistidos no banco (Fase 4).
 *
 * Mesmo padrão do CouponStateProvider: o layout /m (server) hidrata via
 * `initial` e re-monta com key={userId} em login/logout. O toggle é
 * otimista — aplica local, chama a server action (RPC no banco) e
 * reverte se falhar. Anônimo é convidado a logar.
 */
export interface FavoritosInicial {
  logado: boolean;
  ids: string[];
}

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  logado: boolean;
  isFavorite: (estabelecimentoId: string) => boolean;
  toggleFavorite: (estabelecimentoId: string) => void;
}

const FavoritesContext = React.createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({
  initial,
  children,
}: {
  initial: FavoritosInicial;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(
    () => new Set(initial.ids),
  );

  const isFavorite = React.useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  const toggleFavorite = React.useCallback(
    (id: string) => {
      if (!initial.logado) {
        router.push("/m/login"); // espelha o gate do "Usar cupom"
        return;
      }
      const tinha = favoriteIds.has(id);
      // otimista: aplica já; reverte se o servidor recusar
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (tinha) next.delete(id);
        else next.add(id);
        return next;
      });
      const acao = tinha ? desfavoritarAction : favoritarAction;
      void acao(id).then((r) => {
        if (!r.ok) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (tinha) next.add(id);
            else next.delete(id);
            return next;
          });
        }
      });
    },
    [favoriteIds, initial.logado, router],
  );

  return (
    <FavoritesContext.Provider
      value={{ favoriteIds, logado: initial.logado, isFavorite, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

const NOOP_CONTEXT: FavoritesContextValue = {
  favoriteIds: new Set(),
  logado: false,
  isFavorite: () => false,
  toggleFavorite: () => undefined,
};

export function useFavorites(): FavoritesContextValue {
  return React.useContext(FavoritesContext) ?? NOOP_CONTEXT;
}
