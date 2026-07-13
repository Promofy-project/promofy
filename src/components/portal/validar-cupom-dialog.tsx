"use client";

import * as React from "react";
import { X, QrCode, BadgeCheck, AlertCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validarCupomAction, type ValidarDadosDTO } from "@/lib/actions/cupons";

// Mensagem amigável por motivo retornado pelo servidor.
const MENSAGEM: Record<string, string> = {
  nao_encontrado: "Código não encontrado. Confira e tente de novo.",
  ja_validado: "Este cupom já foi validado.",
  expirado: "Este cupom expirou e não pode mais ser validado.",
  outro_estabelecimento: "Este cupom não é do seu estabelecimento.",
  cupom_proprio: "Você não pode validar o seu próprio cupom.",
  sem_permissao: "Sua conta não tem um estabelecimento vinculado.",
  erro: "Não foi possível validar agora. Tente novamente.",
};

export function ValidarCupomDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [codigo, setCodigo] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [validando, setValidando] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<ValidarDadosDTO | null>(null);

  React.useEffect(() => {
    if (open) {
      setCodigo("");
      setErro(null);
      setValidando(false);
      setSucesso(null);
    }
  }, [open]);

  if (!open) return null;

  async function validar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setValidando(true);
    const r = await validarCupomAction(codigo.trim().toUpperCase());
    setValidando(false);
    if (r.ok) {
      setSucesso(r.dados);
    } else {
      setErro(MENSAGEM[r.motivo] ?? MENSAGEM.erro);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="animate-fade-up relative w-full max-w-[420px] rounded-[20px] bg-surface p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {!sucesso ? (
          <>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <QrCode className="h-6 w-6" />
            </div>
            <h2 className="text-center text-lg font-extrabold">Validar cupom</h2>
            <p className="mt-1.5 text-center text-sm text-muted-foreground">
              Informe o código apresentado pelo cliente.
            </p>

            <form onSubmit={validar}>
              <div className="mt-5 flex flex-col gap-1.5">
                <label
                  htmlFor="codigo-cupom"
                  className="text-sm font-semibold text-foreground"
                >
                  Código do cupom
                </label>
                <Input
                  id="codigo-cupom"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value.toUpperCase());
                    if (erro) setErro(null);
                  }}
                  placeholder="PRMF-XXXX-XXXX"
                  className="font-mono uppercase tracking-wider"
                  aria-invalid={!!erro}
                  autoFocus
                />
                {erro && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
                    <AlertCircle className="h-4 w-4" />
                    {erro}
                  </p>
                )}
              </div>

              <Button type="submit" className="mt-5 w-full" disabled={validando || !codigo.trim()}>
                {validando ? "Validando…" : "Validar cupom"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-success-soft">
              <BadgeCheck className="h-7 w-7 text-success" />
            </div>
            <h2 className="text-center text-lg font-extrabold">
              Validação concluída
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Cupom{" "}
              <span className="font-mono font-bold">{sucesso.codigo}</span>{" "}
              validado com sucesso.
            </p>

            <div className="mt-5 rounded-card border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Dados do cliente
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Nome</dt>
                  <dd className="font-bold">{sucesso.cliente_nome || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">CPF</dt>
                  <dd className="font-mono font-bold">{sucesso.cliente_cpf}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Cupom</dt>
                  <dd className="text-right font-medium">{sucesso.titulo}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Benefício</dt>
                  <dd className="text-right font-medium">{sucesso.beneficio}</dd>
                </div>
              </dl>
            </div>

            <Button className="mt-5 w-full" onClick={onClose}>
              Concluir
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
