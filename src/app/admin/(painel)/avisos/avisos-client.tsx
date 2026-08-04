"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Check, Eye } from "lucide-react";

import type { AvisoDoAdmin } from "@/lib/data/avisos";
import { publicarAvisoAction } from "@/lib/actions/avisos";
import { cn, formatDateTimeBRT } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EstabOpcao {
  id: string;
  nome: string;
}

export function AvisosClient({
  avisos,
  estabelecimentos,
}: {
  avisos: AvisoDoAdmin[];
  estabelecimentos: EstabOpcao[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = React.useState("");
  const [corpo, setCorpo] = React.useState("");
  const [paraTodos, setParaTodos] = React.useState(true);
  const [selecionados, setSelecionados] = React.useState<string[]>([]);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const podeEnviar =
    titulo.trim().length > 0 &&
    corpo.trim().length > 0 &&
    (paraTodos || selecionados.length > 0);

  async function publicar() {
    if (!podeEnviar || enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await publicarAvisoAction({
      titulo,
      corpo,
      paraTodos,
      estabelecimentos: selecionados,
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setTitulo("");
    setCorpo("");
    setSelecionados([]);
    setParaTodos(true);
    setSucesso("Aviso publicado. Os estabelecimentos veem no mural do app.");
    router.refresh();
  }

  const alternar = (id: string) =>
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <>
      <PageHeader
        title="Avisos"
        description="Publique recados que aparecem no mural dos estabelecimentos."
      />

      {sucesso && (
        <div className="mb-6 flex items-center gap-3 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <Check className="h-5 w-5 shrink-0" />
          {sucesso}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" /> Novo aviso
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="a-titulo" className="text-sm font-semibold">Título</label>
              <Input
                id="a-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Manutenção programada no sábado"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="a-corpo" className="text-sm font-semibold">Recado</label>
              <Textarea
                id="a-corpo"
                rows={5}
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                placeholder="Escreva o recado como o lojista vai lê-lo no app."
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Quem recebe</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setParaTodos(true)}
                  aria-pressed={paraTodos}
                  className={cn(
                    "h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                    paraTodos
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setParaTodos(false)}
                  aria-pressed={!paraTodos}
                  className={cn(
                    "h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                    !paraTodos
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  Escolher
                </button>
              </div>

              {/* "Todos" é broadcast de verdade: não materializa uma linha por
                  estabelecimento, então parceiro novo já nasce recebendo. */}
              {paraTodos ? (
                <p className="text-xs text-muted-foreground">
                  Vale para os estabelecimentos de hoje <b>e</b> para os que entrarem depois.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {estabelecimentos.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => alternar(e.id)}
                      aria-pressed={selecionados.includes(e.id)}
                      className={cn(
                        "h-9 rounded-lg border px-3 text-xs font-semibold transition-colors",
                        selecionados.includes(e.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {e.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}

            <Button onClick={publicar} disabled={!podeEnviar || enviando}>
              {enviando ? "Publicando…" : "Publicar aviso"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publicados</CardTitle>
          </CardHeader>
          <CardContent>
            {avisos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aviso publicado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {avisos.map((a) => (
                  <li key={a.id} className="rounded-card border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold leading-snug">{a.titulo}</p>
                      <Badge variant={a.paraTodos ? "success" : "muted"} className="shrink-0">
                        {a.paraTodos ? "Todos" : `${a.destinatarios.length} estab.`}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.corpo}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTimeBRT(a.publicadoEm)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {a.leituras} {a.leituras === 1 ? "leitura" : "leituras"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
