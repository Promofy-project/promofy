"use client";

import * as React from "react";

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

const FavoritesContext = React.createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set());

  const isFavorite = React.useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  const toggleFavorite = React.useCallback((id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

const NOOP_CONTEXT: FavoritesContextValue = {
  favoriteIds: new Set(),
  isFavorite: () => false,
  toggleFavorite: () => undefined,
};

export function useFavorites(): FavoritesContextValue {
  return React.useContext(FavoritesContext) ?? NOOP_CONTEXT;
}
