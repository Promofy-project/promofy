"use client";

import * as React from "react";
import { Download, CheckCircle2, Circle } from "lucide-react";

import { MobilePageHeader } from "@/components/mobile-page-header";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/utils";
import type { DocumentoLegal } from "@/lib/documentos-legais";
import { solicitarEncerramentoContaAction } from "@/lib/actions/legal";

export function PrivacidadeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Privacidade e dados" back="/m/perfil" />
      <div className="flex flex-col gap-5 px-4 pb-8 pt-4">{children}</div>
    </div>
  );
}

interface DocumentoComAceite extends DocumentoLegal {
  aceito: { versao: string; aceitoEm: string } | null;
}

export function PrivacidadeClient({
  documentos,
  status,
}: {
  documentos: DocumentoComAceite[];
  status: "ativo" | "encerramento_solicitado" | "anonimizado";
}) {
  return (
    <>
      <section>
        <h2 className="text-sm font-bold">Documentos legais</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O que você aceitou e quando. O texto integral de cada documento
          fica em{" "}
          <a href="/legal" className="underline">
            /legal
          </a>
          .
        </p>
        <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-card">
          {documentos.map((doc) => (
            <li key={doc.documento} className="flex items-center gap-3 px-4 py-3">
              {doc.aceito && doc.aceito.versao === doc.versao ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {doc.titulo}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    v{doc.versao}
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {doc.aceito
                    ? doc.aceito.versao === doc.versao
                      ? `Aceito em ${formatShortDate(doc.aceito.aceitoEm)}`
                      : `Versão anterior aceita (v${doc.aceito.versao}) — reaceite pendente`
                    : "Ainda não aceito"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-bold">Seus dados</h2>
        <a
          href="/m/perfil/privacidade/exportar"
          className="mt-3 flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">
              Exportar meus dados
            </span>
            <span className="block text-xs text-muted-foreground">
              Baixa um arquivo JSON com seu perfil, cupons, pontos e favoritos.
            </span>
          </span>
        </a>
      </section>

      <EncerrarConta status={status} />
    </>
  );
}

function EncerrarConta({
  status,
}: {
  status: "ativo" | "encerramento_solicitado" | "anonimizado";
}) {
  const [confirmando, setConfirmando] = React.useState(false);
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  // Fora de "ativo" esta tela normalmente nem renderiza — o layout de /m
  // já bloqueia antes com <EncerramentoBloqueio>, que também é onde fica
  // o botão de cancelar (única fonte, evita duas UIs de cancelamento
  // divergindo). Este fallback é só defensivo.
  if (status !== "ativo") {
    return (
      <section>
        <p className="rounded-card border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Sua conta não está ativa no momento.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-bold text-danger">Excluir minha conta</h2>
      {!confirmando ? (
        <Button
          variant="outline"
          className="mt-3 border-danger/40 text-danger hover:bg-danger/10"
          onClick={() => setConfirmando(true)}
        >
          Excluir minha conta
        </Button>
      ) : (
        <div className="mt-3 rounded-card border border-danger/30 bg-danger-soft p-4">
          <p className="text-sm font-semibold text-foreground">
            Isto vai encerrar o acesso à sua conta imediatamente.
          </p>
          <ul className="mt-2 list-disc pl-4 text-sm text-muted-foreground">
            <li>Você não conseguirá mais entrar ou usar cupons.</li>
            <li>
              Seus dados pessoais (nome, CPF, telefone, nascimento) são
              anonimizados dentro do prazo da nossa Política de Privacidade.
            </li>
            <li>
              Alguns registros podem ser preservados por obrigação legal ou
              para o histórico agregado dos estabelecimentos onde você usou
              cupons.
            </li>
          </ul>
          {erro && <p className="mt-2 text-sm font-semibold text-danger">{erro}</p>}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmando(false)}
              disabled={carregando}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={carregando}
              onClick={async () => {
                setErro(null);
                setCarregando(true);
                const r = await solicitarEncerramentoContaAction();
                setCarregando(false);
                if (!r.ok) {
                  setErro(r.erro);
                  return;
                }
                setConfirmando(false);
              }}
            >
              {carregando ? "Excluindo…" : "Confirmar exclusão"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
