"use client";

import * as React from "react";

/** Ciclo de vida de um cupom na sessão (mockado, em memória). */
export type StatusCupom = "disponivel" | "ativo" | "validado";

export interface EstadoCupom {
  status: Exclude<StatusCupom, "disponivel">; // só guardamos quando ativo/validado
  codigo: string;
  ativadoEm: number;
  nps: number | null;
}

interface CouponStateValue {
  getStatus: (id: string) => StatusCupom;
  getEstado: (id: string) => EstadoCupom | null;
  /** ativa o cupom (gera código + carimbo) e abre o cupom ativo em tela cheia */
  ativarCupom: (id: string) => void;
  /** reabre o cupom ativo já existente */
  verCupomAtivo: (id: string) => void;
  fecharCupomAtivo: () => void;
  /** simula a validação pelo estabelecimento → marca 'validado' e dispara o NPS */
  simularValidacao: (id: string) => void;
  /** registra a nota de NPS (0–10) */
  responderNps: (id: string, nota: number) => void;
  /** fecha o NPS e o cupom ativo, voltando ao detalhe */
  fecharNps: () => void;
  /** id do cupom cujo card full-screen está aberto */
  sheetId: string | null;
  /** id do cupom cujo dialog de NPS está aberto */
  npsId: string | null;
}

const CouponStateContext = React.createContext<CouponStateValue | null>(null);

// Sem caracteres ambíguos (0/O, 1/I) p/ leitura/conferência manual.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function gerarCodigo(): string {
  const grupo = () =>
    Array.from(
      { length: 4 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join("");
  return `PRMF-${grupo()}-${grupo()}`;
}

/**
 * Estado dos cupons do consumidor, mantido EM MEMÓRIA (sem localStorage).
 * Persiste entre navegações dentro de /m (o layout não remonta) e zera num
 * reload — comportamento desejado para a demo. As ações (ativar/validar/NPS)
 * rodam em event handlers no cliente, então Math.random/Date.now são seguros.
 */
export function CouponStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [estados, setEstados] = React.useState<Record<string, EstadoCupom>>({});
  const [sheetId, setSheetId] = React.useState<string | null>(null);
  const [npsId, setNpsId] = React.useState<string | null>(null);

  const value = React.useMemo<CouponStateValue>(
    () => ({
      getStatus: (id) => estados[id]?.status ?? "disponivel",
      getEstado: (id) => estados[id] ?? null,

      ativarCupom: (id) => {
        setEstados((prev) =>
          prev[id]
            ? prev
            : {
                ...prev,
                [id]: {
                  status: "ativo",
                  codigo: gerarCodigo(),
                  ativadoEm: Date.now(),
                  nps: null,
                },
              },
        );
        setSheetId(id);
      },

      verCupomAtivo: (id) => setSheetId(id),
      fecharCupomAtivo: () => setSheetId(null),

      simularValidacao: (id) => {
        setEstados((prev) => {
          const atual =
            prev[id] ??
            {
              status: "ativo" as const,
              codigo: gerarCodigo(),
              ativadoEm: Date.now(),
              nps: null,
            };
          return { ...prev, [id]: { ...atual, status: "validado" } };
        });
        setNpsId(id);
      },

      responderNps: (id, nota) =>
        setEstados((prev) =>
          prev[id] ? { ...prev, [id]: { ...prev[id], nps: nota } } : prev,
        ),

      fecharNps: () => {
        setNpsId(null);
        setSheetId(null);
      },

      sheetId,
      npsId,
    }),
    [estados, sheetId, npsId],
  );

  return (
    <CouponStateContext.Provider value={value}>
      {children}
    </CouponStateContext.Provider>
  );
}

export function useCouponState(): CouponStateValue {
  const ctx = React.useContext(CouponStateContext);
  if (!ctx) {
    // fallback seguro fora do provider
    return {
      getStatus: () => "disponivel",
      getEstado: () => null,
      ativarCupom: () => {},
      verCupomAtivo: () => {},
      fecharCupomAtivo: () => {},
      simularValidacao: () => {},
      responderNps: () => {},
      fecharNps: () => {},
      sheetId: null,
      npsId: null,
    };
  }
  return ctx;
}
