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
  excluirCupomAction,
  reenviarCupomAction,
} from "@/lib/actions/cupons";
import { cn } from "@/lib/utils";
import { abaEfetiva, contarPorAba, filtrarPorAba } from "@/lib/portal-listagem";

/**
 * Os filtros de status do portal (Fase 9/C3).
 *
 * A ordem é a do CICLO DE VIDA do cupom, não alfabética: é assim que o
 * lojista pensa nele — nasce pendente, é aprovado, e um dia acaba ou é
 * retirado. Os ids são exatamente os de `StatusCupomPortal`, mais
 * `excluido` (Fase 9/C4), que não está naquele tipo porque nunca chega às
 * telas do consumidor.
 */
const FILTROS_STATUS = [
  { id: "ativo", label: "Ativos" },
  { id: "pendente", label: "Em análise" },
  { id: "rejeitado", label: "Rejeitados" },
  { id: "esgotado", label: "Esgotados" },
  { id: "expirado", label: "Expirados" },
  { id: "excluido", label: "Excluídos" },
] as const;

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
  /** Fase 9/C3: "todos" ou um `statusPortal`. */
  const [filtroStatus, setFiltroStatus] = React.useState<string>("todos");
  /** Fase 9/D1: o form está preenchido com uma campanha anterior, mas CRIA. */
  const [duplicando, setDuplicando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState<string | null>(null);

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
    setDuplicando(false);
    setEmEdicao(r.cupom);
    setView("editar");
  };

  /**
   * NOVA CAMPANHA a partir de uma esgotada — Fase 9/D1.
   *
   * O clique NÃO cria nada: busca o cupom encerrado e abre o formulário de
   * criação com os valores dele. O registro só nasce no Salvar, pela
   * `criarCupomAction` de sempre — com id próprio, `pendente`, e contadores
   * que começam do zero porque são de outro cupom. A campanha anterior fica
   * intacta, com todo o histórico dela.
   */
  const abrirNovaCampanha = async (item: ItemCupomPortal) => {
    setErro(null);
    setCarregando(item.cupom.id);
    const r = await carregarCupomParaEdicaoAction(item.cupom.id);
    setCarregando(null);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setDuplicando(true);
    setEmEdicao(r.cupom);
    setView("novo");
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

  /**
   * Exclusão lógica (Fase 9/C4). A confirmação é `window.confirm` — só-web,
   * e é o ponto de troca para o app nativo (mesmo padrão declarado em
   * `password-input.tsx` e `campo-imagem.tsx`). O texto diz o que a ação
   * preserva, porque "excluir" costuma soar mais destrutivo do que é: o
   * histórico de quem usou o cupom continua inteiro.
   */
  const excluir = async (item: ItemCupomPortal) => {
    setErro(null);
    const ok = window.confirm(
      `Excluir “${item.cupom.titulo}”?\n\n` +
        "O cupom sai do app e da sua lista de ativos. " +
        "Os resgates, as avaliações e os números que ele já gerou continuam " +
        "no seu histórico.",
    );
    if (!ok) return;

    setExcluindo(item.cupom.id);
    const r = await excluirCupomAction(item.cupom.id);
    setExcluindo(null);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setLista((prev) =>
      prev.map((i) =>
        i.cupom.id === item.cupom.id ? { ...i, statusPortal: "excluido" } : i,
      ),
    );
    // Diz PARA ONDE o cupom foi: a partir da C5 ele sai da visão operacional,
    // e um aviso que só fala em "histórico preservado" deixaria o lojista
    // procurando onde ele foi parar.
    setSucesso(
      `Cupom “${item.cupom.titulo}” excluído. O histórico foi preservado — ele continua em “Excluídos”.`,
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

  /**
   * FILTRO POR STATUS — Fase 9/C3 (relatório v2 §1.8).
   *
   * Só os status que o banco realmente produz: o enum `status_cupom` tem
   * ativo, indisponivel, expirado, esgotado, pendente, rejeitado e (Fase 9/C4)
   * excluido — e `statusPortal` colapsa `indisponivel` em "ativo". Nada de
   * inventar rótulo que o dado não sustenta.
   *
   * Client-side sobre a lista já carregada, de propósito: a listagem do
   * lojista é pequena (dezenas), e ir ao servidor a cada toque acrescentaria
   * latência e um estado de carregamento para resolver um `filter`.
   *
   * Os contadores NÃO vêm da lista filtrada — um filtro que zera o próprio
   * contador não diz ao lojista o que ele deixaria de ver.
   *
   * FASE 9/C5: quem decide o conteúdo de cada aba é `src/lib/portal-listagem`,
   * módulo puro. `lista` continua sendo TODOS os registros do estabelecimento
   * — é ela que alimenta "Excluídos", e tirar o item daqui no ato da exclusão
   * o apagaria da única tela onde o histórico ainda se consulta. O que mudou
   * foi o significado de "Todos": os cupons operacionais.
   */
  const contagem = React.useMemo(() => contarPorAba(lista), [lista]);

  // Só entram as abas que TÊM cupom — um portal novo não precisa ver seis
  // filtros vazios. "Todos" fica sempre.
  const abas = React.useMemo(
    () =>
      [
        { id: "todos", label: "Todos" },
        ...FILTROS_STATUS.filter((f) => (contagem[f.id] ?? 0) > 0),
      ] as { id: string; label: string }[],
    [contagem],
  );

  /** A aba escolhida pode sumir debaixo do dedo do lojista — ver o módulo. */
  const filtroEfetivo = abaEfetiva(
    abas.map((a) => a.id),
    filtroStatus,
  );

  const listaFiltrada = React.useMemo(
    () => filtrarPorAba(lista, filtroEfetivo),
    [lista, filtroEfetivo],
  );

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

          {/* Filtro por status (Fase 9/C3) — `aria-pressed` além da cor,
              para o estado selecionado não depender só de contraste. */}
          {abas.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
              {abas.map((aba) => {
                const ativa = filtroEfetivo === aba.id;
                return (
                  <button
                    key={aba.id}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => setFiltroStatus(aba.id)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                      ativa
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {aba.label}
                    <span className={cn("ml-1.5 tabular-nums", ativa ? "opacity-80" : "opacity-60")}>
                      {contagem[aba.id] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {listaFiltrada.map((item) => (
              <CouponPortalCard
                key={item.cupom.id}
                item={item}
                onEditar={carregando ? undefined : abrirEdicao}
                onReenviar={reenviar}
                onExcluir={excluir}
                onNovaCampanha={carregando ? undefined : abrirNovaCampanha}
                excluindo={excluindo === item.cupom.id}
                reenviando={reenviando === item.cupom.id}
                carregando={carregando === item.cupom.id}
              />
            ))}
          </div>

          {/* Um filtro que não devolve nada precisa dizer isso e oferecer a
              saída — senão parece que os cupons sumiram. */}
          {listaFiltrada.length === 0 && (
            <p className="mt-6 rounded-card border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum cupom com este status.{" "}
              <button
                type="button"
                onClick={() => setFiltroStatus("todos")}
                className="font-bold text-primary hover:underline"
              >
                Ver todos
              </button>
            </p>
          )}
        </>
      ) : (
        <NovoCupomForm
          // `key` remonta o form ao trocar de cupom (ou entre criar/editar):
          // os useState só leem `cupomInicial` na montagem.
          key={`${duplicando ? "dup" : "ed"}-${emEdicao?.id ?? "novo"}`}
          estabelecimentoNome={estabelecimentoNome}
          estabelecimentoId={estabelecimentoId}
          categorias={categorias}
          categoriaPrincipal={categoriaPrincipal}
          cupomInicial={emEdicao ?? undefined}
          duplicar={duplicando}
          onCancelar={() => {
            setView("lista");
            setEmEdicao(null);
            setDuplicando(false);
          }}
          onSalvar={(item) => {
            // Fase 9/D1: duplicando, o item que volta é OUTRO cupom (id novo)
            // — entra na lista, e o esgotado de origem fica onde estava.
            const editou = Boolean(emEdicao) && !duplicando;
            setLista((prev) =>
              editou
                ? prev.map((i) => (i.cupom.id === item.cupom.id ? item : i))
                : [item, ...prev],
            );
            setView("lista");
            setEmEdicao(null);
            setDuplicando(false);
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
