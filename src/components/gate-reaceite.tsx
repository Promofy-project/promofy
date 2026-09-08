"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { registrarAceiteAction } from "@/lib/actions/legal";
import type { DocumentoLegal } from "@/lib/documentos-legais";

/**
 * Gate de (re)aceite — Fase 17 LEGAL-PRIVACY-01.
 *
 * Centralizado aqui, montado nos layouts de `/m` e `/portal`, em vez de
 * hardcoded em cada tela. `pendentes` já vem calculado no servidor
 * (comparação versão vigente × `aceites_documento` do usuário) — este
 * componente só apresenta e registra, nunca decide o que é obrigatório.
 */
export function GateReaceite({ pendentes }: { pendentes: DocumentoLegal[] }) {
  const router = useRouter();
  const [marcados, setMarcados] = React.useState<Set<string>>(new Set());
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const todosMarcados = pendentes.every((d) => marcados.has(d.documento));

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    for (const doc of pendentes) {
      const r = await registrarAceiteAction(doc.documento);
      if (!r.ok) {
        setErro(r.erro);
        setEnviando(false);
        return;
      }
    }
    setEnviando(false);
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-5 shadow-card">
        <h1 className="text-lg font-extrabold text-foreground">
          Atualizamos nossos termos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Para continuar usando o Promofy, revise e aceite os documentos
          abaixo.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {pendentes.map((doc) => (
            <li key={doc.documento}>
              <label className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={marcados.has(doc.documento)}
                  onChange={(e) =>
                    setMarcados((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(doc.documento);
                      else next.delete(doc.documento);
                      return next;
                    })
                  }
                />
                <span className="text-sm text-foreground">
                  Li e aceito{" "}
                  <a
                    href={`/legal/${doc.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    {doc.titulo} (v{doc.versao})
                  </a>
                  .
                </span>
              </label>
            </li>
          ))}
        </ul>

        {erro && <p className="mt-3 text-sm font-semibold text-danger">{erro}</p>}

        <Button
          className="mt-4 w-full"
          disabled={!todosMarcados || enviando}
          onClick={() => void confirmar()}
        >
          {enviando ? "Confirmando…" : "Aceitar e continuar"}
        </Button>
      </div>
    </div>
  );
}
