"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, AlertTriangle } from "lucide-react";

import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { Button } from "@/components/ui/button";
import { ReenviarCupomButton } from "@/components/estab/reenviar-cupom-button";
import { ExcluirCupomButton } from "@/components/estab/excluir-cupom-button";
import { cn, formatBRLValue, formatShortDate } from "@/lib/utils";
import {
  FORMAS_CONSUMO,
  listarPtBr,
  rotuloEconomia,
  rotulosFormasConsumo,
  rotulosTaxas,
} from "@/lib/cupom-campos";
import { DIAS_SEMANA } from "@/lib/dias";
import {
  FILTROS_ATRIBUTO_VAZIOS,
  filtrarListagemLojista,
  type FiltrosAtributoLojista,
  type ItemFiltroLojista,
} from "@/lib/lojista-filtros";
import { abaEfetiva, contarPorAba } from "@/lib/portal-listagem";

const STATUS: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-success-soft text-success" },
  pendente: { label: "Em análise", cls: "bg-yellow/25 text-foreground" },
  rejeitado: { label: "Rejeitado", cls: "bg-danger-soft text-danger" },
  esgotado: { label: "Esgotado", cls: "bg-muted text-muted-foreground" },
  expirado: { label: "Expirado", cls: "bg-muted text-muted-foreground" },
  excluido: { label: "Excluído", cls: "bg-muted text-muted-foreground" },
};

const FILTROS_STATUS = [
  { id: "ativo", label: "Ativos" },
  { id: "pendente", label: "Em análise" },
  { id: "rejeitado", label: "Rejeitados" },
  { id: "esgotado", label: "Esgotados" },
  { id: "expirado", label: "Expirados" },
  { id: "excluido", label: "Excluídos" },
] as const;

type ItemComFiltro = ItemCupomPortal & ItemFiltroLojista;

function comFiltro(it: ItemCupomPortal): ItemComFiltro {
  return {
    ...it,
    categoriaId: it.cupom.categoriaVisual?.id ?? null,
    dias: it.cupom.dias,
    formasConsumo: it.cupom.formasConsumo,
  };
}

export function CuponsEstabClient({ itens }: { itens: ItemCupomPortal[] }) {
  const lista = React.useMemo(() => itens.map(comFiltro), [itens]);
  const [aba, setAba] = React.useState("todos");
  const [filtros, setFiltros] = React.useState<FiltrosAtributoLojista>(FILTROS_ATRIBUTO_VAZIOS);

  const contagem = React.useMemo(() => contarPorAba(lista), [lista]);
  const abas = React.useMemo(
    () => [
      { id: "todos", label: "Todos" },
      ...FILTROS_STATUS.filter((f) => (contagem[f.id] ?? 0) > 0),
    ],
    [contagem],
  );
  const abaAtual = abaEfetiva(
    abas.map((a) => a.id),
    aba,
  );
  const filtrados = React.useMemo(
    () => filtrarListagemLojista(lista, abaAtual, filtros),
    [lista, abaAtual, filtros],
  );

  const categorias = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const it of lista) {
      const id = it.cupom.categoriaVisual?.id;
      const label = it.cupom.categoriaVisual?.label;
      if (id && label) map.set(id, label);
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [lista]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-5">
      <header className="flex items-center gap-2">
        <Link
          href="/e"
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Meus cupons</h1>
      </header>

      <Button asChild size="lg" className="w-full">
        <Link href="/e/cupom/novo">
          <Plus className="h-5 w-5" />
          Novo cupom
        </Link>
      </Button>

      {lista.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
            {abas.map((a) => {
              const ativa = abaAtual === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => setAba(a.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    ativa
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              aria-label="Categoria"
              value={filtros.categoriaId}
              onChange={(e) => setFiltros((f) => ({ ...f, categoriaId: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Dia da semana"
              value={filtros.dia}
              onChange={(e) => setFiltros((f) => ({ ...f, dia: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="">Todos os dias</option>
              {DIAS_SEMANA.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              aria-label="Forma de consumo"
              value={filtros.formaConsumo}
              onChange={(e) => setFiltros((f) => ({ ...f, formaConsumo: e.target.value }))}
              className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="">Todas as formas</option>
              {FORMAS_CONSUMO.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {filtrados.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {lista.length === 0 ? "Você ainda não criou cupons." : "Nenhum cupom com estes filtros."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtrados.map((it) => {
            const s = STATUS[it.statusPortal] ?? STATUS.ativo;
            return (
              <li
                key={it.cupom.id}
                className="rounded-card border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold leading-tight">{it.cupom.titulo}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      s.cls,
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {it.cupom.beneficio && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {it.cupom.beneficio}
                  </p>
                )}
                <p className="mt-2 text-sm font-bold text-foreground">
                  Economia{" "}
                  {rotuloEconomia(
                    `R$ ${formatBRLValue(it.cupom.economia)}`,
                    it.cupom.economiaVariavel,
                  )}
                </p>
                {(it.cupom.formasConsumo?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {listarPtBr(rotulosFormasConsumo(it.cupom.formasConsumo ?? []))}
                  </p>
                )}
                {(it.cupom.taxas?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Não inclui{" "}
                    {listarPtBr(rotulosTaxas(it.cupom.taxas ?? [])).toLowerCase()}.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <b className="text-foreground">{it.metricas.resgates}</b>{" "}
                    resgates
                  </span>
                  <span>Validade {formatShortDate(it.cupom.validade)}</span>
                  {it.limiteUsuario == null && <span>Ilimitado por cliente</span>}
                </div>

                {it.statusPortal === "rejeitado" && it.motivoRejeicao && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    <span>
                      <b className="font-semibold">Motivo da recusa:</b>{" "}
                      {it.motivoRejeicao}
                    </span>
                  </p>
                )}

                {it.statusPortal === "esgotado" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Campanha encerrada. Para oferecer de novo, crie um cupom novo.
                  </p>
                )}

                {it.statusPortal !== "excluido" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {it.statusPortal !== "esgotado" && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/e/cupom/${it.cupom.id}/editar`}>
                          <Pencil className="h-4 w-4" />{" "}
                          {it.statusPortal === "expirado" ? "Prorrogar" : "Editar"}
                        </Link>
                      </Button>
                    )}
                    {it.statusPortal === "rejeitado" && (
                      <ReenviarCupomButton
                        cupomId={it.cupom.id}
                        titulo={it.cupom.titulo}
                      />
                    )}
                    <ExcluirCupomButton
                      cupomId={it.cupom.id}
                      titulo={it.cupom.titulo}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
