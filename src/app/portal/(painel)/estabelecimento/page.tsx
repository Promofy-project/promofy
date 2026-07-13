"use client";

import * as React from "react";
import {
  ShieldCheck,
  AtSign,
  Phone,
  MessageCircle,
  Check,
  Store,
} from "lucide-react";

import { categorias } from "@/lib/mock-data";
import type { CategoriaId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function PortalEstabelecimento() {
  const [nome, setNome] = React.useState("Sabor & Cia");
  const [categoria, setCategoria] = React.useState<CategoriaId>("alimentacao");
  const [cidade, setCidade] = React.useState("São Paulo, SP");
  const [descricao, setDescricao] = React.useState(
    "Rodízios, almoço executivo e ambiente família. Há 12 anos no bairro.",
  );
  const [instagram, setInstagram] = React.useState("@saborecia");
  const [whatsapp, setWhatsapp] = React.useState("(11) 98932-4802");
  const [telefone, setTelefone] = React.useState("(11) 3333-1020");
  const [salvo, setSalvo] = React.useState(false);

  React.useEffect(() => {
    if (!salvo) return;
    const t = window.setTimeout(() => setSalvo(false), 4000);
    return () => window.clearTimeout(t);
  }, [salvo]);

  return (
    <>
      <PageHeader
        title="Estabelecimento"
        description="Mantenha os dados do seu negócio sempre atualizados."
      />

      {salvo && (
        <div className="mb-6 flex items-center gap-2 rounded-card border border-success/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          <Check className="h-5 w-5" /> Alterações salvas com sucesso.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Cartão de identidade */}
        <Card className="flex flex-col items-center p-6 text-center lg:self-start">
          <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-9 w-9" />
          </div>
          <h2 className="mt-4 text-lg font-bold">{nome}</h2>
          <p className="text-sm text-muted-foreground">{cidade}</p>
          <Badge variant="success" className="mt-3 gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Dados verificados
          </Badge>
          <p className="mt-3 text-xs text-muted-foreground">
            Sua verificação dá mais confiança aos clientes no app.
          </p>
        </Card>

        {/* Formulário */}
        <Card className="p-5 lg:p-6">
          <div className="flex flex-col gap-4">
            <Field label="Nome do estabelecimento" htmlFor="e-nome">
              <Input
                id="e-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Field>

            <Field label="Categoria">
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoria(c.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                      categoria === c.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Cidade" htmlFor="e-cidade">
              <Input
                id="e-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </Field>

            <Field label="Descrição" htmlFor="e-desc">
              <textarea
                id="e-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="flex w-full rounded-btn border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
              />
            </Field>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-bold">Contatos</h3>
              <p className="text-xs text-muted-foreground">
                Os clientes falam com você por esses canais.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Field label="Instagram" htmlFor="e-ig">
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="e-ig"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </Field>
                <Field label="WhatsApp" htmlFor="e-wa">
                  <div className="relative">
                    <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="e-wa"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </Field>
                <Field label="Telefone" htmlFor="e-tel">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="e-tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </Field>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={() => setSalvo(true)}>
                <Check className="h-4 w-4" /> Salvar alterações
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
