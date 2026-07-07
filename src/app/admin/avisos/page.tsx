"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";

import { categorias, getCategoria } from "@/lib/mock-data";
import type { CategoriaId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Destino = "todos" | CategoriaId;

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  destino: Destino;
  /** string já formatada — evita recomputar data fuso-dependente na hidratação */
  quando: string;
}

function destinoLabel(destino: Destino): string {
  return destino === "todos"
    ? "Todos os estabelecimentos"
    : `Categoria: ${getCategoria(destino).label}`;
}

// Avisos de exemplo — timestamps fixos (nada calculado no render → sem hidratação instável).
const AVISOS_INICIAIS: Aviso[] = [
  {
    id: "seed-1",
    titulo: "Campanha de inverno chegando",
    mensagem:
      "Preparem ofertas para a primeira semana de julho. Cupons de aquecimento ganham 30% mais destaque no app.",
    destino: "todos",
    quando: "05/07/2026 09:14",
  },
  {
    id: "seed-2",
    titulo: "Regras novas para cupons de alimentação",
    mensagem:
      "A partir desta semana, cupons de rodízio precisam informar o horário de validade. Revisem suas campanhas ativas.",
    destino: "alimentacao",
    quando: "03/07/2026 16:40",
  },
];

const OPCOES_DESTINO: { id: Destino; label: string }[] = [
  { id: "todos", label: "Todos os estabelecimentos" },
  ...categorias.map((c) => ({ id: c.id as Destino, label: c.label })),
];

let novoSeq = 0;

export default function AdminAvisos() {
  const [titulo, setTitulo] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [destino, setDestino] = React.useState<Destino>("todos");
  const [avisos, setAvisos] = React.useState<Aviso[]>(AVISOS_INICIAIS);
  const [feedback, setFeedback] = React.useState("");

  const podeEnviar = titulo.trim().length > 0 && mensagem.trim().length > 0;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    novoSeq += 1;
    // new Date() só roda neste handler (pós-clique, client-side) — nunca no SSR/hidratação.
    const quando = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    setAvisos((prev) => [
      {
        id: `novo-${novoSeq}`,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        destino,
        quando,
      },
      ...prev,
    ]);
    const alvo =
      destino === "todos"
        ? "todos os estabelecimentos"
        : getCategoria(destino).label;
    setFeedback(`Aviso enviado para ${alvo}.`);
    setTitulo("");
    setMensagem("");
    setDestino("todos");
  };

  return (
    <>
      <PageHeader
        title="Quadro de Avisos"
        description="Comunique os estabelecimentos parceiros — por categoria ou todos de uma vez."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Novo aviso</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={enviar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="a-titulo" className="text-sm font-semibold">
                  Título
                </label>
                <Input
                  id="a-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Campanha de inverno chegando"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="a-mensagem" className="text-sm font-semibold">
                  Mensagem
                </label>
                <textarea
                  id="a-mensagem"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Escreva o comunicado para os estabelecimentos…"
                  rows={5}
                  className="flex w-full resize-y rounded-btn border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span id="destino-label" className="text-sm font-semibold">
                  Destino
                </span>
                <div
                  role="group"
                  aria-labelledby="destino-label"
                  className="flex flex-wrap gap-2"
                >
                  {OPCOES_DESTINO.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setDestino(o.id)}
                      aria-pressed={destino === o.id}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                        destino === o.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" disabled={!podeEnviar}>
                  <Megaphone className="h-4 w-4" /> Enviar aviso
                </Button>
                <span className="text-xs text-muted-foreground">
                  Envia para{" "}
                  <strong className="font-semibold text-foreground">
                    {destino === "todos"
                      ? "todos os estabelecimentos"
                      : getCategoria(destino).label}
                  </strong>
                </span>
              </div>

              {/* Confirmação de envio — anunciada a leitores de tela e visível a todos */}
              <p
                role="status"
                aria-live="polite"
                className="min-h-[1rem] text-xs font-medium text-success"
              >
                {feedback}
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Lista de enviados */}
        <Card>
          <CardHeader>
            <CardTitle>Avisos enviados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {avisos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum aviso enviado ainda.
              </p>
            ) : (
              avisos.map((a) => (
                <article
                  key={a.id}
                  className="rounded-card border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold leading-snug">{a.titulo}</h4>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {a.quando}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {a.mensagem}
                  </p>
                  <div className="mt-3">
                    <Badge variant={a.destino === "todos" ? "success" : "muted"}>
                      {destinoLabel(a.destino)}
                    </Badge>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
