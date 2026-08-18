"use client";

import * as React from "react";
import { Plus, QrCode, ArrowLeft, CheckCircle2, X, AlertTriangle } from "lucide-react";

import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { CouponPortalCard } from "@/components/portal/coupon-portal-card";
import { NovoCupomForm } from "@/components/portal/novo-cupom-form";
import { ValidarCupomDialog } from "@/components/portal/validar-cupom-dialog";
import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import type { CupomParaEdicao } from "@/lib/data/cupons";
import {
  carregarCupomParaEdicaoAction,
  reenviarCupomAction,
} from "@/lib/actions/cupons";

/**
 * Corpo client da página de cupons do portal. A lista inicial vem do
 * Supabase via server component (page.tsx); criar cupom continua apenas
 * em memória nesta fase (Fase 2 persiste no banco).
 */
export function CuponsClient({
  initialLista,
  estabelecimentoNome,
  estabelecimentoId,
  categorias,
  categoriaPrincipal,
  abrirEmNovo = false,
}: {
  initialLista: ItemCupomPortal[];
  estabelecimentoNome: string;
  /** Fase 7/C4: pasta do bucket de imagens. */
  estabelecimentoId: string | null;
  categorias: { id: string; label: string }[];
  categoriaPrincipal: string | null;
  /**
   * Abre já no formulário de criação. Vem de `?novo=1`, lido no server
   * component — é o destino do botão "Novo cupom" do dashboard (`/portal`),
   * que antes era um <Button> sem href nem onClick, inerte (QA v2 §1.4).
   * O dashboard não tem a view local que esta tela tem, então o caminho é
   * navegar para cá já pedindo o formulário.
   */
  abrirEmNovo?: boolean;
}) {
  const [lista, setLista] = React.useState<ItemCupomPortal[]>(initialLista);
  const [view, setView] = React.useState<"lista" | "novo" | "editar">(
    abrirEmNovo ? "novo" : "lista",
  );
  const [validarOpen, setValidarOpen] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  /** Cupom em edição, carregado do servidor com o DTO fiel à linha. */
  const [emEdicao, setEmEdicao] = React.useState<CupomParaEdicao | null>(null);
  const [carregando, setCarregando] = React.useState<string | null>(null);
  const [reenviando, setReenviando] = React.useState<string | null>(null);

  /**
   * Abrir a edição BUSCA o cupom no servidor em vez de reaproveitar o item
   * da lista: `ItemCupomPortal` não carrega `prazo_ativacao_horas` e o
   * `Cupom` colapsa o status — pré-preencher a partir dele gravaria valores
   * que o lojista não digitou.
   */
  const abrirEdicao = async (item: ItemCupomPortal) => {
    setErro(null);
    setCarregando(item.cupom.id);
    const r = await carregarCupomParaEdicaoAction(item.cupom.id);
    setCarregando(null);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setEmEdicao(r.cupom);
    setView("editar");
  };

  const reenviar = async (item: ItemCupomPortal) => {
    setErro(null);
    setReenviando(item.cupom.id);
    const r = await reenviarCupomAction(item.cupom.id);
    setReenviando(null);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setLista((prev) =>
      prev.map((i) =>
        i.cupom.id === item.cupom.id
          ? { ...i, statusPortal: "pendente", motivoRejeicao: undefined }
          : i,
      ),
    );
    setSucesso(
      `Cupom “${item.cupom.titulo}” reenviado para análise. Ele volta ao app após a aprovação.`,
    );
  };

  React.useEffect(() => {
    if (!sucesso) return;
    const t = window.setTimeout(() => setSucesso(null), 5000);
    return () => window.clearTimeout(t);
  }, [sucesso]);

  const ativos = lista.filter((i) => i.statusPortal === "ativo").length;
  const totalVis = lista.reduce((s, i) => s + i.metricas.visualizacoes, 0);
  const totalResgates = lista.reduce((s, i) => s + i.metricas.resgates, 0);
  const conversao = totalVis ? Math.round((totalResgates / totalVis) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Crie, valide e acompanhe o desempenho dos seus cupons."
      >
        {view === "lista" ? (
          <>
            <Button variant="outline" onClick={() => setValidarOpen(true)}>
              <QrCode className="h-4 w-4" /> Validar cupom
            </Button>
            <Button onClick={() => setView("novo")}>
              <Plus className="h-4 w-4" /> Novo cupom
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setView("lista");
              setEmEdicao(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        )}
      </PageHeader>

      {sucesso && (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="flex-1">{sucesso}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setSucesso(null)}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-success/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Erros de editar/reenviar — inclusive as recusas da matriz vindas
          do trigger, que já chegam com a frase pronta do servidor. */}
      {erro && (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
          <span className="flex-1">{erro}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setErro(null)}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-danger/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {view === "lista" ? (
        <>
          {/* Resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Cupons ativos" value={String(ativos)} icon="Ticket" />
            <MetricCard
              label="Visualizações"
              value={formatNumber(totalVis)}
              icon="Eye"
            />
            <MetricCard
              label="Resgates"
              value={formatNumber(totalResgates)}
              icon="Users"
            />
            <MetricCard
              label="Conversão média"
              value={`${conversao}%`}
              icon="TrendingUp"
            />
          </div>

          {/* Lista */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {lista.map((item) => (
              <CouponPortalCard
                key={item.cupom.id}
                item={item}
                onEditar={carregando ? undefined : abrirEdicao}
                onReenviar={reenviar}
                reenviando={reenviando === item.cupom.id}
              />
            ))}
          </div>
        </>
      ) : (
        <NovoCupomForm
          // `key` remonta o form ao trocar de cupom (ou entre criar/editar):
          // os useState só leem `cupomInicial` na montagem.
          key={emEdicao?.id ?? "novo"}
          estabelecimentoNome={estabelecimentoNome}
          estabelecimentoId={estabelecimentoId}
          categorias={categorias}
          categoriaPrincipal={categoriaPrincipal}
          cupomInicial={emEdicao ?? undefined}
          onCancelar={() => {
            setView("lista");
            setEmEdicao(null);
          }}
          onSalvar={(item) => {
            setLista((prev) =>
              emEdicao
                ? prev.map((i) => (i.cupom.id === item.cupom.id ? item : i))
                : [item, ...prev],
            );
            const editou = Boolean(emEdicao);
            setView("lista");
            setEmEdicao(null);
            setSucesso(
              editou
                ? item.statusPortal === "pendente"
                  ? `Cupom “${item.cupom.titulo}” atualizado. Como a alteração é relevante, ele voltou para análise.`
                  : `Cupom “${item.cupom.titulo}” atualizado.`
                : `Cupom “${item.cupom.titulo}” enviado! Ele passará por análise antes de publicar.`,
            );
          }}
        />
      )}

      <ValidarCupomDialog
        open={validarOpen}
        onClose={() => setValidarOpen(false)}
      />
    </>
  );
}
