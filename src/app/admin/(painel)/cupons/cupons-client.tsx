"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, Eye } from "lucide-react";

import type { AdminCupom } from "@/lib/data/admin";
import type { CategoriaId } from "@/lib/types";
import { getCategoria } from "@/lib/mock-data";
import { regrasParaExibir } from "@/lib/cupom-campos";
import { cn, formatBRL, formatShortDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { DataTable, type Column } from "@/components/admin/data-table";
import {
  aprovarCupomAction,
  rejeitarCupomAction,
} from "@/lib/actions/admin";

const STATUS: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  ativo: { variant: "success", label: "Ativo" },
  indisponivel: { variant: "muted", label: "Indisponível" },
  pendente: { variant: "yellow-soft", label: "Pendente" },
  rejeitado: { variant: "danger", label: "Rejeitado" },
  esgotado: { variant: "muted", label: "Esgotado" },
  expirado: { variant: "muted", label: "Expirado" },
};

function mensagemErro(motivo: string): string {
  if (motivo === "sem_permissao") return "Sua conta não tem permissão de moderação.";
  if (motivo === "motivo_obrigatorio") return "Escreva o motivo da recusa.";
  if (motivo === "nao_encontrado") return "Este cupom já foi moderado por outra pessoa.";
  return "Não foi possível concluir. Tente novamente.";
}

const FILTROS = ["todos", "pendente", "ativo", "rejeitado"] as const;
const FILTRO_LABEL: Record<string, string> = {
  todos: "Todos",
  pendente: "Pendentes",
  ativo: "Ativos",
  rejeitado: "Rejeitados",
};

export function CuponsAdminClient({ cupons }: { cupons: AdminCupom[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = React.useState<string>("todos");
  const [detalhe, setDetalhe] = React.useState<AdminCupom | null>(null);
  const [processando, setProcessando] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  /** Fase 6.5/C5: cupom aguardando o motivo da rejeição. */
  const [rejeitando, setRejeitando] = React.useState<AdminCupom | null>(null);

  const filtrados =
    filtro === "todos" ? cupons : cupons.filter((c) => c.status === filtro);

  async function aprovar(id: string) {
    setProcessando(id);
    setErro(null);
    const r = await aprovarCupomAction(id);
    setProcessando(null);
    if (r.ok) {
      setDetalhe(null);
      router.refresh();
    } else {
      setErro(mensagemErro(r.motivo));
    }
  }

  /** Rejeitar SEMPRE passa pelo modal — o motivo é obrigatório no servidor. */
  async function rejeitarComMotivo(id: string, motivo: string) {
    setProcessando(id);
    setErro(null);
    const r = await rejeitarCupomAction(id, motivo);
    setProcessando(null);
    if (r.ok) {
      setRejeitando(null);
      setDetalhe(null);
      router.refresh();
    } else {
      setErro(mensagemErro(r.motivo));
    }
  }

  const columns: Column<AdminCupom>[] = [
    {
      key: "cupom",
      header: "Cupom",
      render: (c) => {
        const cat = getCategoria(c.categoriaId as CategoriaId);
        return (
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ background: cat.gradiente }}
            >
              <Icon name={cat.icon} className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.estabelecimentoNome}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "economia",
      header: "Economia",
      align: "right",
      render: (c) => (
        <span className="tabular-nums">{formatBRL(c.economia)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => {
        const s = STATUS[c.status] ?? STATUS.ativo;
        return <Badge variant={s.variant}>{s.label}</Badge>;
      },
    },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      render: (c) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetalhe(c)}>
            <Eye className="h-4 w-4" /> Detalhes
          </Button>
          {c.status === "pendente" && (
            <>
              <Button
                size="sm"
                onClick={() => aprovar(c.id)}
                disabled={processando === c.id}
              >
                <Check className="h-4 w-4" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRejeitando(c)}
                disabled={processando === c.id}
              >
                Rejeitar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const n =
            f === "todos"
              ? cupons.length
              : cupons.filter((c) => c.status === f).length;
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
        getRowKey={(c) => c.id}
        empty="Nenhum cupom neste filtro."
      />

      {detalhe && (
        <DetalheModal
          cupom={detalhe}
          processando={processando === detalhe.id}
          onClose={() => setDetalhe(null)}
          onAprovar={aprovar}
          onRejeitar={setRejeitando}
        />
      )}

      {rejeitando && (
        <RejeitarModal
          cupom={rejeitando}
          processando={processando === rejeitando.id}
          onClose={() => setRejeitando(null)}
          onConfirmar={rejeitarComMotivo}
        />
      )}
    </>
  );
}

/**
 * Modal de rejeição (Fase 6.5/C5). O motivo é obrigatório — o botão fica
 * desabilitado enquanto o campo está vazio, e a RPC recusa de qualquer
 * forma (`motivo_obrigatorio`), então a UI não é a barreira: é a cortesia.
 *
 * O texto vai INTEIRO para o lojista, então o placeholder empurra para algo
 * acionável ("o que corrigir") em vez de um "não aprovado" genérico.
 */
function RejeitarModal({
  cupom,
  processando,
  onClose,
  onConfirmar,
}: {
  cupom: AdminCupom;
  processando: boolean;
  onClose: () => void;
  onConfirmar: (id: string, motivo: string) => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  const vazio = motivo.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="animate-fade-up relative w-full max-w-[520px] rounded-card bg-surface p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="pr-8 text-lg font-extrabold leading-tight">
          Rejeitar “{cupom.titulo}”
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {cupom.estabelecimentoNome} — o lojista verá este texto e poderá
          corrigir e reenviar.
        </p>

        <label
          htmlFor="motivo-rejeicao"
          className="mt-5 block text-sm font-semibold text-foreground"
        >
          Motivo da recusa
        </label>
        <Textarea
          id="motivo-rejeicao"
          className="mt-1.5"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: o benefício não deixa claro o que está incluso. Descreva o que o cliente recebe."
          autoFocus
        />

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={vazio || processando}
            onClick={() => onConfirmar(cupom.id, motivo)}
          >
            {processando ? "Rejeitando…" : "Rejeitar cupom"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Linha({
  label,
  valor,
  full,
}: {
  label: string;
  valor: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}

function DetalheModal({
  cupom,
  processando,
  onClose,
  onAprovar,
  onRejeitar,
}: {
  cupom: AdminCupom;
  processando: boolean;
  onClose: () => void;
  onAprovar: (id: string) => void;
  onRejeitar: (cupom: AdminCupom) => void;
}) {
  const cat = getCategoria(cupom.categoriaId as CategoriaId);
  const s = STATUS[cupom.status] ?? STATUS.ativo;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="animate-fade-up relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-card bg-surface p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg"
            style={{ background: cat.gradiente }}
          >
            <Icon name={cat.icon} className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold leading-tight">
              {cupom.titulo}
            </h2>
            <p className="text-sm text-muted-foreground">
              {cupom.estabelecimentoNome} · {cat.label}
            </p>
          </div>
          <Badge variant={s.variant}>{s.label}</Badge>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Linha label="Benefício" valor={cupom.beneficio || "—"} full />
          <Linha label="Economia" valor={formatBRL(cupom.economia)} />
          <Linha label="Categoria" valor={cat.label} />
          <Linha
            label="Início"
            valor={
              cupom.validadeInicio
                ? formatShortDate(cupom.validadeInicio)
                : "Imediato"
            }
          />
          <Linha label="Validade" valor={formatShortDate(cupom.validadeFim)} />
          {/* Fase 6: null = ilimitado nos DOIS limites (antes só no total,
              e o "—" do total era ambíguo entre "sem teto" e "não sei"). */}
          <Linha
            label="Limite por usuário"
            valor={
              cupom.limitePorUsuario != null
                ? String(cupom.limitePorUsuario)
                : "Ilimitado"
            }
          />
          <Linha
            label="Limite total"
            valor={
              cupom.limiteTotal != null ? String(cupom.limiteTotal) : "Ilimitado"
            }
          />
          <Linha label="Prazo de ativação" valor={`${cupom.prazoAtivacaoHoras}h`} />
          <Linha label="Horários" valor={cupom.horarios || "Todos os dias"} full />
          <Linha
            label="Estabelecimento"
            valor={`${cupom.estabelecimentoNome} (${cupom.estabelecimentoStatus})`}
            full
          />
          {regrasParaExibir(cupom.regras, cupom.beneficio).length > 0 && (
            <Linha
              label="Regras"
              valor={regrasParaExibir(cupom.regras, cupom.beneficio).join(" · ")}
              full
            />
          )}
        </dl>

        {cupom.status === "pendente" && (
          <div className="mt-6 flex gap-3">
            <Button
              className="flex-1"
              onClick={() => onAprovar(cupom.id)}
              disabled={processando}
            >
              <Check className="h-4 w-4" /> Aprovar
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onRejeitar(cupom)}
              disabled={processando}
            >
              Rejeitar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
