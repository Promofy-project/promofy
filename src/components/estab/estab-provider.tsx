"use client";

import { createContext, useContext } from "react";

export interface EstabInfo {
  id: string;
  nome: string;
  status: string;
}

const EstabContext = createContext<EstabInfo | null>(null);

/** Contexto do estabelecimento do lojista logado (hidratado no /e/layout). */
export function EstabProvider({
  value,
  children,
}: {
  value: EstabInfo | null;
  children: React.ReactNode;
}) {
  return <EstabContext.Provider value={value}>{children}</EstabContext.Provider>;
}

export function useEstab(): EstabInfo | null {
  return useContext(EstabContext);
}
