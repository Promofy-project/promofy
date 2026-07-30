"use client";

import * as React from "react";

import {
  ativarCupomAction,
  consultarCupomAction,
  responderNpsAction,
  type EstadoCupomDTO,
  type UsoCupomDTO,
} from "@/lib/actions/cupons";

/** Ciclo de vida de um cupom para o consumidor. */
export type StatusCupom = "disponivel" | "ativo" | "validado";

export interface EstadoCupom {
  status: Exclude<StatusCupom, "disponivel">;
  rowId: number;
  codigo: string;
  ativadoEm: string;
  expiraEm: string | null;
  nps: number | null;
}

/** Config de pontos (fonte única: config_pontos no banco). */
export type ConfigPontos = Record<string, number>;

export interface UsuarioConsumidor {
  nome: string;
  cpfMascarado: string;
}

/** Payload de hidratação vindo do servidor (m/layout). */
export interface EstadoInicial {
  logado: boolean;
  usuario: UsuarioConsumidor | null;
  saldo: number;
  /** Total economizado (soma da economia dos cupons validados). */
  economia: number;
  config: ConfigPontos;
  estados: EstadoCupomDTO[];
  /** Uso por cupom (Fase 5) — insumo do selo "utilizado". */
  usos: UsoCupomDTO[];
}

/** Resultado de uma ativação para a UI reagir. */
export type ResultadoAtivacao =
  | { ok: true }
  | { ok: false; motivo: string };

/** NPS devolve os pontos REAIS creditados pelo banco (0 se já respondido). */
export type ResultadoNps =
  | { ok: true; pontos: number }
  | { ok: false; motivo: string };

/** Comemoração de pontos: `seq` remonta o componente e reinicia a animação. */
export interface PontosPopState {
  valor: number;
  seq: number;
}

interface CouponStateValue {
  logado: boolean;
  usuario: UsuarioConsumidor | null;
  config: ConfigPontos;

  getStatus: (id: string) => StatusCupom;
  getEstado: (id: string) => EstadoCupom | null;
  /**
   * Uso do cupom pelo usuário (Fase 5). `null` = o servidor não reportou
   * uso nenhum. Quem decide se ainda há uso disponível é o servidor:
   * aqui é só leitura de `restantes`.
   */
  getUsos: (id: string) => UsoCupomDTO | null;
  /** Saldo real do consumidor (SUM do ledger, hidratado do servidor). */
  getPontos: () => number;
  /** Total economizado real (soma da economia dos cupons validados). */
  getEconomia: () => number;

  /** Ativa o cupom no servidor e abre o cupom ativo. Devolve o resultado. */
  ativarCupom: (id: string) => Promise<ResultadoAtivacao>;
  /** Reabre o cupom ativo já existente. */
  verCupomAtivo: (id: string) => void;
  fecharCupomAtivo: () => void;
  /** Consulta o estado atual no servidor (polling) e sincroniza. */
  consultarCupom: (id: string) => Promise<void>;
  /** Abre o NPS para um cupom já validado. */
  abrirNps: (id: string) => void;
  /** Registra a nota de NPS (idempotente no servidor). */
  responderNps: (id: string, nota: number) => Promise<ResultadoNps>;
  fecharNps: () => void;

  sheetId: string | null;
  npsId: string | null;

  /** Animação "+N pontos" (Fase 5) — sempre com valor vindo do servidor. */
  pontosPop: PontosPopState | null;
  celebrarPontos: (pontos: number) => void;
  encerrarPontosPop: () => void;
}

const CouponStateContext = React.createContext<CouponStateValue | null>(null);

function dtoParaEstado(d: EstadoCupomDTO): EstadoCupom | null {
  if (d.status === "expirado") return null; // expirado = volta a disponível
  return {
    status: d.status,
    rowId: d.row_id,
    codigo: d.codigo,
    ativadoEm: d.ativado_em,
    expiraEm: d.expira_em,
    nps: d.nps,
  };
}

/** Reduz os DTOs de hidratação a um mapa cupomId → estado (ativo vigente vence validado). */
function estadosDeInicial(estados: EstadoCupomDTO[]): Record<string, EstadoCupom> {
  const ordenado = [...estados].sort((a, b) => {
    const rank = (s: string) => (s === "ativo" ? 0 : 1);
    return rank(a.status) - rank(b.status) || b.ativado_em.localeCompare(a.ativado_em);
  });
  const mapa: Record<string, EstadoCupom> = {};
  for (const d of ordenado) {
    if (mapa[d.cupom_id]) continue; // primeiro (melhor rank) vence
    const e = dtoParaEstado(d);
    if (e) mapa[d.cupom_id] = e;
  }
  return mapa;
}

/**
 * Estado do ciclo do cupom do consumidor, HIDRATADO do servidor
 * (Fase 2). Sobrevive a reload — o estado real vive em cupons_usuario.
 * Ações chamam RPCs via Server Actions; o cliente nunca decide status
 * nem expiração. O provider é remontado por `key={userId}` no layout,
 * então login/logout re-hidratam sem estado obsoleto.
 */
export function CouponStateProvider({
  initial,
  children,
}: {
  initial: EstadoInicial;
  children: React.ReactNode;
}) {
  const [estados, setEstados] = React.useState<Record<string, EstadoCupom>>(
    () => estadosDeInicial(initial.estados),
  );
  const [saldo, setSaldo] = React.useState(initial.saldo);
  const [economia, setEconomia] = React.useState(initial.economia);
  const [usos, setUsos] = React.useState<Record<string, UsoCupomDTO>>(() =>
    Object.fromEntries((initial.usos ?? []).map((u) => [u.cupom_id, u])),
  );
  const [sheetId, setSheetId] = React.useState<string | null>(null);
  const [npsId, setNpsId] = React.useState<string | null>(null);
  const [pontosPop, setPontosPop] = React.useState<PontosPopState | null>(null);
  const seqPop = React.useRef(0);

  /**
   * Dispara a comemoração. `pontos` é SEMPRE o valor que a RPC devolveu —
   * nunca um número fixo no cliente. Zero/ausente não anima (nada de "+0"
   * quando o servidor não creditou nada, ex.: NPS já respondido).
   */
  const celebrarPontos = React.useCallback((pontos: number) => {
    if (!(pontos > 0)) return;
    seqPop.current += 1;
    setPontosPop({ valor: pontos, seq: seqPop.current });
  }, []);
  const encerrarPontosPop = React.useCallback(() => setPontosPop(null), []);

  const aplicarDto = React.useCallback((id: string, dto: EstadoCupomDTO | null) => {
    setEstados((prev) => {
      const e = dto ? dtoParaEstado(dto) : null;
      if (!e) {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: e };
    });
  }, []);

  const value = React.useMemo<CouponStateValue>(
    () => ({
      logado: initial.logado,
      usuario: initial.usuario,
      config: initial.config,

      getStatus: (id) => estados[id]?.status ?? "disponivel",
      getEstado: (id) => estados[id] ?? null,
      getUsos: (id) => usos[id] ?? null,
      getPontos: () => saldo,
      getEconomia: () => economia,

      ativarCupom: async (id) => {
        const r = await ativarCupomAction(id);
        if (!r?.ok) return { ok: false, motivo: r?.motivo ?? "erro" };
        aplicarDto(id, r.estado);
        setSheetId(id);
        return { ok: true };
      },

      verCupomAtivo: (id) => setSheetId(id),
      fecharCupomAtivo: () => setSheetId(null),

      consultarCupom: async (id) => {
        const r = await consultarCupomAction(id);
        if (!r?.ok) return;
        setSaldo(r.saldo);
        setEconomia(r.economia);
        // `usos` recalculado no mesmo poll: é o que faz o selo "utilizado"
        // aparecer na home sem F5 depois que o lojista valida.
        setUsos(Object.fromEntries((r.usos ?? []).map((u) => [u.cupom_id, u])));
        const anterior = estados[id]?.status;
        aplicarDto(id, r.estado);
        // flip ativo → validado detectado no polling
        if (anterior === "ativo" && r.estado?.status === "validado") {
          // pontos do RESGATE, lidos do ledger pela RPC (não é número fixo)
          celebrarPontos(r.estado.pontos_resgate ?? 0);
          if (r.estado.nps === null) setNpsId(id);
        }
      },

      abrirNps: (id) => setNpsId(id),

      responderNps: async (id, nota) => {
        const estado = estados[id];
        if (!estado) return { ok: false, motivo: "sem_estado" };
        const r = await responderNpsAction(estado.rowId, nota);
        if (!r?.ok) return { ok: false, motivo: r?.motivo ?? "erro" };
        setSaldo(r.saldo);
        setEstados((prev) =>
          prev[id] ? { ...prev, [id]: { ...prev[id], nps: nota } } : prev,
        );
        return { ok: true, pontos: r.pontos ?? 0 };
      },

      fecharNps: () => {
        setNpsId(null);
        setSheetId(null);
      },

      sheetId,
      npsId,

      pontosPop,
      celebrarPontos,
      encerrarPontosPop,
    }),
    [
      estados,
      saldo,
      economia,
      usos,
      sheetId,
      npsId,
      pontosPop,
      celebrarPontos,
      encerrarPontosPop,
      initial,
      aplicarDto,
    ],
  );

  return (
    <CouponStateContext.Provider value={value}>
      {children}
    </CouponStateContext.Provider>
  );
}

const CONFIG_FALLBACK: ConfigPontos = {};

export function useCouponState(): CouponStateValue {
  const ctx = React.useContext(CouponStateContext);
  if (!ctx) {
    // fallback seguro fora do provider (anônimo)
    return {
      logado: false,
      usuario: null,
      config: CONFIG_FALLBACK,
      getStatus: () => "disponivel",
      getEstado: () => null,
      getUsos: () => null,
      getPontos: () => 0,
      getEconomia: () => 0,
      ativarCupom: async () => ({ ok: false, motivo: "sem_sessao" }),
      verCupomAtivo: () => {},
      fecharCupomAtivo: () => {},
      consultarCupom: async () => {},
      abrirNps: () => {},
      responderNps: async () => ({ ok: false, motivo: "sem_sessao" }),
      fecharNps: () => {},
      sheetId: null,
      npsId: null,
      pontosPop: null,
      celebrarPontos: () => {},
      encerrarPontosPop: () => {},
    };
  }
  return ctx;
}
