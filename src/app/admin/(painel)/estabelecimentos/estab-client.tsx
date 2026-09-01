"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";

import type { AdminEstabelecimento } from "@/lib/data/admin";
import type { CategoriaVisual } from "@/lib/categoria-visual";
import { resolverCategoriaVisual } from "@/lib/categoria-visual";
import { agruparPorSegmento } from "@/lib/taxonomia-url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/icon";
import { DataTable, type Column } from "@/components/admin/data-table";
import {
  definirCategoriasEstabelecimentoAction,
  moderarEstabelecimentoAction,
} from "@/lib/actions/admin";

const STATUS: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  ativo: { variant: "success", label: "Ativo" },
  pendente: { variant: "yellow-soft", label: "Pendente" },
  suspenso: { variant: "danger", label: "Suspenso" },
};

const FILTROS = ["todos", "pendente", "ativo", "suspenso"] as const;
const FILTRO_LABEL: Record<string, string> = {
  todos: "Todos",
  pendente: "Pendentes",
  ativo: "Ativos",
  suspenso: "Suspensos",
};

export function EstabAdminClient({
  estabelecimentos,
  catalogo,
  atribuiveis,
}: {
  estabelecimentos: AdminEstabelecimento[];
  /** RESOLUÇÃO: todas as folhas, para nomear vínculo que já existe. */
  catalogo: CategoriaVisual[];
  /** OFERTA: só as folhas ativas — as únicas vinculáveis (Marco 2A). */
  atribuiveis: CategoriaVisual[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = React.useState<string>("todos");
  const [processando, setProcessando] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [editando, setEditando] = React.useState<AdminEstabelecimento | null>(null);

  const filtrados =
    filtro === "todos"
      ? estabelecimentos
      : estabelecimentos.filter((e) => e.status === filtro);

  async function moderar(id: string, status: "ativo" | "suspenso") {
    setProcessando(id);
    setErro(null);
    const r = await moderarEstabelecimentoAction(id, status);
    setProcessando(null);
    if (r.ok) {
      router.refresh();
    } else {
      setErro(
        r.motivo === "sem_permissao"
          ? "Sua conta não tem permissão de moderação."
          : "Não foi possível concluir. Tente novamente.",
      );
    }
  }

  const columns: Column<AdminEstabelecimento>[] = [
    {
      key: "nome",
      header: "Estabelecimento",
      render: (e) => {
        const cat = resolverCategoriaVisual(e.categoriaId, catalogo);
        return (
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ background: cat.gradiente }}
            >
              <Icon name={cat.icon} className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{e.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {e.cidade}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "categoria",
      header: "Categorias",
      render: (e) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {e.categorias.map((c) => {
            const vis = resolverCategoriaVisual(c, catalogo);
            const principal = c === e.categoriaId;
            return (
              <Badge
                key={c}
                variant={principal ? "success" : vis.ativo === false ? "outline" : "muted"}
              >
                {principal ? "Principal: " : ""}
                {vis.label}
                {vis.ativo === false ? " (inativa)" : ""}
              </Badge>
            );
          })}
          <button
            type="button"
            aria-label={`Editar categorias de ${e.nome}`}
            onClick={() => setEditando(e)}
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
    {
      key: "cupons",
      header: "Cupons ativos",
      align: "right",
      render: (e) => <span className="tabular-nums">{e.cuponsAtivos}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => {
        const s = STATUS[e.status] ?? STATUS.ativo;
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      render: (e) => {
        const busy = processando === e.id;
        if (e.status === "ativo") {
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => moderar(e.id, "suspenso")}
                disabled={busy}
              >
                Suspender
              </Button>
            </div>
          );
        }
        // pendente ou suspenso → aprovar/reativar
        return (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => moderar(e.id, "ativo")}
              disabled={busy}
            >
              <Check className="h-4 w-4" />
              {e.status === "pendente" ? "Aprovar" : "Reativar"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const n =
            f === "todos"
              ? estabelecimentos.length
              : estabelecimentos.filter((e) => e.status === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                filtro === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {FILTRO_LABEL[f]} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {erro && <p className="mb-3 text-sm font-semibold text-danger">{erro}</p>}

      <DataTable
        columns={columns}
        rows={filtrados}
        getRowKey={(e) => e.id}
        empty="Nenhum estabelecimento neste filtro."
      />

      {editando && (
        <CategoriasModal
          estabelecimento={editando}
          catalogo={catalogo}
          atribuiveis={atribuiveis}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * Editor simples do conjunto de categorias (Fase 4). A principal fica
 * travada (o servidor também garante); categoria com cupons existentes
 * não pode ser removida — a action devolve 'categoria_em_uso'.
 */
function CategoriasModal({
  estabelecimento,
  catalogo,
  atribuiveis,
  onClose,
  onSalvo,
}: {
  estabelecimento: AdminEstabelecimento;
  catalogo: CategoriaVisual[];
  atribuiveis: CategoriaVisual[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [selecao, setSelecao] = React.useState<Set<string>>(
    new Set(estabelecimento.categorias),
  );

  // MARCO 2A: as opções são as folhas ATRIBUÍVEIS mais as que este
  // estabelecimento JÁ tem — inclusive alguma que tenha saído do catálogo
  // depois. Some-la da lista faria o admin achar que o vínculo não existe;
  // pior, salvar removeria em silêncio um vínculo que ele nunca desmarcou.
  // Ela aparece, marcada, e pode ser REMOVIDA — só não pode ser re-adicionada.
  const atribuiveisIds = React.useMemo(
    () => new Set(atribuiveis.map((c) => c.id)),
    [atribuiveis],
  );
  const opcoes = React.useMemo(() => {
    const vinculadas = new Set(estabelecimento.categorias);
    const foraDeCatalogo = catalogo.filter(
      (c) => vinculadas.has(c.id) && !atribuiveisIds.has(c.id),
    );
    return [...atribuiveis, ...foraDeCatalogo];
  }, [atribuiveis, atribuiveisIds, catalogo, estabelecimento.categorias]);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const toggle = (id: string) => {
    if (id === estabelecimento.categoriaId) return; // principal travada
    // Fora de catálogo: pode desmarcar (remover), nunca remarcar (o banco
    // recusaria o INSERT — checar_categoria_nova_ativa_no_vinculo).
    if (!atribuiveisIds.has(id) && !selecao.has(id)) return;
    setSelecao((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await definirCategoriasEstabelecimentoAction(
      estabelecimento.id,
      Array.from(selecao),
    );
    setSalvando(false);
    if (r.ok) {
      onSalvo();
    } else {
      setErro(
        r.motivo === "categoria_em_uso"
          ? "Há cupons nessa categoria — remova ou recategorize os cupons antes."
          : r.motivo === "categoria_inativa"
            ? "Uma das categorias saiu do catálogo e não pode ser vinculada."
            : "Não foi possível salvar. Tente novamente.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-categorias-titulo"
        className="animate-fade-up relative max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-card bg-surface p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="admin-categorias-titulo" className="text-lg font-bold">
          Categorias
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {estabelecimento.nome} — a categoria principal não pode ser removida.
          Associações inativas continuam visíveis; não é possível reativá-las
          por aqui.
        </p>

        <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
          {agruparPorSegmento(opcoes).map((g) => (
            <div key={g.slug} className="mb-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </p>
              <div className="flex flex-col gap-2">
                {g.itens.map((c) => {
                  const principal = c.id === estabelecimento.categoriaId;
                  const inativa = c.ativo === false;
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5",
                        principal ? "bg-muted/60" : "cursor-pointer hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={selecao.has(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                      />
                      <span className="flex-1 text-sm font-medium">
                        {c.label}
                        {inativa ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (inativa — só auditoria)
                          </span>
                        ) : null}
                      </span>
                      {principal && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          principal
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {erro && <p className="mt-3 text-sm font-semibold text-danger">{erro}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            <Check className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
