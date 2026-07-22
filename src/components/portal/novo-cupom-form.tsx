"use client";

import * as React from "react";
import { Check } from "lucide-react";

import type { CategoriaId, Cupom } from "@/lib/types";
import { DIAS_SEMANA } from "@/lib/dias";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CouponCard } from "@/components/coupon-card";
import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { criarCupomAction } from "@/lib/actions/cupons";

// formato canônico dos dias vive em src/lib/dias.ts (Fase 4)
const DIAS = DIAS_SEMANA;

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function NovoCupomForm({
  estabelecimentoNome,
  categorias,
  categoriaPrincipal,
  onSalvar,
  onCancelar,
}: {
  estabelecimentoNome: string;
  categorias: { id: string; label: string }[];
  categoriaPrincipal: string | null;
  onSalvar: (item: ItemCupomPortal) => void;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = React.useState("");
  const [beneficio, setBeneficio] = React.useState("");
  // Fase 4: o estabelecimento pode ter N categorias — seleção entre elas,
  // principal pré-setada. O servidor valida contra o conjunto (junção).
  const [categoriaSel, setCategoriaSel] = React.useState<string>(
    categoriaPrincipal ?? categorias[0]?.id ?? "alimentacao",
  );
  const categoria = categoriaSel as CategoriaId;
  const categoriaLabel =
    categorias.find((c) => c.id === categoriaSel)?.label ?? categoriaSel;
  const [economia, setEconomia] = React.useState("");
  const [validade, setValidade] = React.useState("");
  const [dataInicio, setDataInicio] = React.useState("");
  const [ocultarAteInicio, setOcultarAteInicio] = React.useState(false);
  const [prazoAtivacao, setPrazoAtivacao] = React.useState("5");
  const [dias, setDias] = React.useState<string[]>(["Sex", "Sáb", "Dom"]);
  const [horaInicio, setHoraInicio] = React.useState("18:00");
  const [horaFim, setHoraFim] = React.useState("23:00");
  const [limiteUsuario, setLimiteUsuario] = React.useState("1");
  const [limiteTotal, setLimiteTotal] = React.useState("500");
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const toggleDia = (d: string) =>
    setDias((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const previewCupom: Cupom = {
    id: "preview",
    titulo: titulo || "Título do seu cupom",
    estabelecimento: estabelecimentoNome,
    estabelecimentoId: "preview",
    categoria,
    economia: Number(economia) || 0,
    distanciaKm: 1.2,
    rating: 0,
    avaliacoes: 0,
    validade: validade || "2026-12-31",
    status: "ativo",
    imagem: "",
    beneficio: beneficio || "Descreva o benefício da oferta",
    regras: beneficio ? [beneficio] : [],
    horarios: `${horaInicio} às ${horaFim}`,
    destaque: false,
  };

  // validade agora é obrigatória (a coluna é NOT NULL no banco)
  const podeSalvar =
    titulo.trim().length > 0 && Number(economia) > 0 && validade.length > 0;

  const salvar = async () => {
    if (!podeSalvar || salvando) return;
    setErro(null);
    setSalvando(true);
    // estabelecimento_id é derivado no SERVIDOR (owner_id) — nunca do form
    const r = await criarCupomAction({
      titulo,
      beneficio,
      categoria,
      economia: Number(economia),
      validade,
      dataInicio: dataInicio || undefined,
      ocultarAteInicio,
      prazoAtivacao: Number(prazoAtivacao) || 5,
      dias,
      horaInicio,
      horaFim,
      limiteUsuario: Number(limiteUsuario) || 1,
      limiteTotal: Number(limiteTotal) || 1,
    });
    setSalvando(false);
    if (r.ok) {
      onSalvar(r.item);
    } else {
      setErro(r.erro);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Formulário */}
      <Card className="p-5 lg:p-6">
        <h2 className="text-lg font-bold">Dados da oferta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os campos — a pré-visualização atualiza em tempo real.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <Field label="Título" htmlFor="f-titulo">
            <Input
              id="f-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Rodízio de pizza em dobro"
            />
          </Field>

          <Field label="Benefício / descrição" htmlFor="f-beneficio">
            <Input
              id="f-beneficio"
              value={beneficio}
              onChange={(e) => setBeneficio(e.target.value)}
              placeholder="Ex.: 2 rodízios pelo preço de 1"
            />
          </Field>

          <Field label="Categoria">
            {categorias.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoriaSel(c.id)}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                      categoriaSel === c.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-11 items-center justify-between rounded-btn border border-border bg-muted/60 px-3.5 text-sm">
                <span className="font-medium text-foreground">{categoriaLabel}</span>
                <span className="text-xs text-muted-foreground">
                  definida pelo estabelecimento
                </span>
              </div>
            )}
          </Field>

          <Field label="Economia (R$)" htmlFor="f-economia">
            <Input
              id="f-economia"
              type="number"
              min={0}
              value={economia}
              onChange={(e) => setEconomia(e.target.value)}
              placeholder="45"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validade da oferta" htmlFor="f-validade">
              <Input
                id="f-validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </Field>
            <Field label="Data de início" htmlFor="f-inicio">
              <Input
                id="f-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </Field>
          </div>

          <label
            htmlFor="f-ocultar"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Ocultar cupom até a data de início
              </span>
              <span className="text-xs text-muted-foreground">
                O cupom só aparece a partir do início da campanha.
              </span>
            </span>
            <Switch
              id="f-ocultar"
              checked={ocultarAteInicio}
              onCheckedChange={setOcultarAteInicio}
            />
          </label>

          <Field label="Prazo de ativação (horas)" htmlFor="f-prazo">
            <Input
              id="f-prazo"
              type="number"
              min={1}
              value={prazoAtivacao}
              onChange={(e) => setPrazoAtivacao(e.target.value)}
              placeholder="24"
            />
          </Field>

          <Field label="Dias de consumo">
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDia(d)}
                  className={cn(
                    "h-9 w-12 rounded-lg border text-sm font-semibold transition-colors",
                    dias.includes(d)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início do horário" htmlFor="f-hi">
              <Input
                id="f-hi"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </Field>
            <Field label="Fim do horário" htmlFor="f-hf">
              <Input
                id="f-hf"
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Limite por usuário" htmlFor="f-lu">
              <Input
                id="f-lu"
                type="number"
                min={1}
                value={limiteUsuario}
                onChange={(e) => setLimiteUsuario(e.target.value)}
                placeholder="1"
              />
            </Field>
            <Field label="Limite total" htmlFor="f-lt">
              <Input
                id="f-lt"
                type="number"
                min={1}
                value={limiteTotal}
                onChange={(e) => setLimiteTotal(e.target.value)}
                placeholder="500"
              />
            </Field>
          </div>
        </div>

        {erro && (
          <p className="mt-4 text-sm font-medium text-danger">{erro}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={salvar} disabled={!podeSalvar || salvando}>
            <Check className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar cupom"}
          </Button>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </Card>

      {/* Pré-visualização ao vivo */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pré-visualização ao vivo
        </p>
        <CouponCard cupom={previewCupom} ctaLabel="Usar agora" />
        <Card className="mt-4 p-4">
          <h3 className="text-sm font-bold">Resumo da campanha</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Início</dt>
              <dd className="font-medium">{dataInicio || "—"}</dd>
            </div>
            {ocultarAteInicio && dataInicio && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Visibilidade</dt>
                <dd className="font-medium">Oculto até {dataInicio}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Dias</dt>
              <dd className="text-right font-medium">
                {dias.length ? dias.join(", ") : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Horário</dt>
              <dd className="font-medium">
                {horaInicio} às {horaFim}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Ativação em até</dt>
              <dd className="font-medium">{prazoAtivacao || "—"}h</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Limite / usuário</dt>
              <dd className="font-medium">{limiteUsuario || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Limite total</dt>
              <dd className="font-medium">{limiteTotal || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
