"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import type { AdminEstabelecimento } from "@/lib/data/admin";
import type { CategoriaId } from "@/lib/types";
import { getCategoria } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { DataTable, type Column } from "@/components/admin/data-table";
import { moderarEstabelecimentoAction } from "@/lib/actions/admin";

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
}: {
  estabelecimentos: AdminEstabelecimento[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = React.useState<string>("todos");
  const [processando, setProcessando] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

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
        const cat = getCategoria(e.categoriaId as CategoriaId);
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
      header: "Categoria",
      render: (e) => (
        <span className="text-muted-foreground">
          {getCategoria(e.categoriaId as CategoriaId).label}
        </span>
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
    </>
  );
}
