"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";

import type { CatalogoUrl, FiltroUrl } from "@/lib/taxonomia-url";
import {
  folhasAtivasDoSegmento,
  hrefBusca,
  nomeDaFolha,
  nomeDoSegmento,
} from "@/lib/taxonomia-url";
import { DIAS_SEMANA } from "@/lib/dias";
import { TIPOS_PROMOCAO } from "@/lib/tipo-promocao";
import { FORMAS_CONSUMO } from "@/lib/cupom-campos";
import {
  extraDeFiltro,
  SENTINELA_MIN_SEM_LIMITE,
  type FiltroConsumidor,
} from "@/lib/filtros-consumidor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TODOS = "Todos";

export function FiltrosClient({
  catalogo,
  catalogoVazio,
  filtroInicial,
  diaHoje,
  diaInicial,
  locais,
  filtroConsInicial,
}: {
  catalogo: CatalogoUrl;
  catalogoVazio: boolean;
  filtroInicial: FiltroUrl;
  diaHoje: string;
  diaInicial?: string;
  locais: { cidades: string[]; bairrosPorCidade: Record<string, string[]> };
  filtroConsInicial: FiltroConsumidor;
}) {
  const router = useRouter();
  const [aberta, setAberta] = React.useState<string | null>(null);
  const [filtro, setFiltro] = React.useState<FiltroUrl>(filtroInicial);
  const [dia, setDia] = React.useState<string>(diaInicial ?? TODOS);
  const [cidade, setCidade] = React.useState(filtroConsInicial.cidade ?? TODOS);
  const [bairro, setBairro] = React.useState(filtroConsInicial.bairro ?? TODOS);
  const [promo, setPromo] = React.useState(filtroConsInicial.tipoPromocao ?? TODOS);
  const [consumo, setConsumo] = React.useState(filtroConsInicial.consumo ?? TODOS);
  const [minSlider, setMinSlider] = React.useState(
    filtroConsInicial.minCompra === SENTINELA_MIN_SEM_LIMITE ||
      filtroConsInicial.minCompra == null
      ? 200
      : Math.min(200, filtroConsInicial.minCompra),
  );

  const folhas = folhasAtivasDoSegmento(filtro.seg, catalogo);
  const labelSeg = nomeDoSegmento(filtro.seg, catalogo) ?? TODOS;
  const labelCat = nomeDaFolha(filtro, catalogo) ?? "Todas as categorias";
  const bairros = cidade !== TODOS ? (locais.bairrosPorCidade[cidade] ?? []) : [];

  function escolherSeg(slug: string) {
    if (slug === TODOS) setFiltro({});
    else setFiltro({ seg: slug });
  }

  function escolherCat(slug: string) {
    if (!filtro.seg) return;
    if (slug === TODOS) setFiltro({ seg: filtro.seg });
    else setFiltro({ seg: filtro.seg, cat: slug });
  }

  const aplicar = () => {
    const cons: FiltroConsumidor = {
      cidade: cidade === TODOS ? undefined : cidade,
      bairro: bairro === TODOS ? undefined : bairro,
      tipoPromocao: promo === TODOS ? undefined : (promo as FiltroConsumidor["tipoPromocao"]),
      consumo: consumo === TODOS ? undefined : (consumo as FiltroConsumidor["consumo"]),
      minCompra: minSlider >= 200 ? SENTINELA_MIN_SEM_LIMITE : minSlider,
    };
    router.push(
      hrefBusca(filtro, extraDeFiltro(cons, dia === TODOS ? undefined : dia)),
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-yellow/90 px-3 py-4 backdrop-blur">
        <Link
          href="/m"
          aria-label="Voltar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-black/5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-lg font-extrabold uppercase tracking-wide text-foreground">
          Filtros
        </h1>
        <span className="h-9 w-9 shrink-0" aria-hidden />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-2">
        {catalogoVazio ? (
          <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os segmentos agora.
          </p>
        ) : (
          <>
            <Secao
              id="segmento"
              label="Segmento"
              valorLabel={labelSeg}
              aberta={aberta === "segmento"}
              onToggle={() => setAberta(aberta === "segmento" ? null : "segmento")}
              opcoes={[
                { valor: TODOS, label: TODOS },
                ...catalogo.segmentos.map((s) => ({
                  valor: s.slug,
                  label: s.nome,
                })),
              ]}
              selecionado={filtro.seg ?? TODOS}
              selecionar={escolherSeg}
            />

            <Secao
              id="categoria"
              label="Categoria"
              valorLabel={filtro.seg ? labelCat : "Escolha um segmento"}
              aberta={aberta === "categoria"}
              onToggle={() =>
                setAberta(aberta === "categoria" ? null : "categoria")
              }
              opcoes={
                filtro.seg
                  ? [
                      { valor: TODOS, label: "Todas as categorias" },
                      ...folhas.map((f) => ({ valor: f.slug, label: f.nome })),
                    ]
                  : []
              }
              selecionado={filtro.cat ?? TODOS}
              selecionar={escolherCat}
              vazio="Primeiro escolha um segmento — as categorias aparecem em seguida."
            />
          </>
        )}

        <Secao
          id="diaSemana"
          label="Dia da semana"
          valorLabel={dia}
          aberta={aberta === "diaSemana"}
          onToggle={() => setAberta(aberta === "diaSemana" ? null : "diaSemana")}
          opcoes={[
            { valor: TODOS, label: TODOS },
            ...DIAS_SEMANA.map((d) => ({
              valor: d,
              label: d === diaHoje ? `${d} (hoje)` : d,
            })),
          ]}
          selecionado={dia}
          selecionar={setDia}
        />

        <Secao
          id="cidade"
          label="Cidade"
          valorLabel={cidade}
          aberta={aberta === "cidade"}
          onToggle={() => setAberta(aberta === "cidade" ? null : "cidade")}
          opcoes={[
            { valor: TODOS, label: TODOS },
            ...locais.cidades.map((c) => ({ valor: c, label: c })),
          ]}
          selecionado={cidade}
          selecionar={(v) => {
            setCidade(v);
            setBairro(TODOS);
          }}
        />

        <Secao
          id="bairro"
          label="Bairro"
          valorLabel={cidade === TODOS ? "Escolha uma cidade" : bairro}
          aberta={aberta === "bairro"}
          onToggle={() => setAberta(aberta === "bairro" ? null : "bairro")}
          opcoes={
            cidade === TODOS
              ? []
              : [
                  { valor: TODOS, label: TODOS },
                  ...bairros.map((b) => ({ valor: b, label: b })),
                ]
          }
          selecionado={bairro}
          selecionar={setBairro}
          vazio="Primeiro escolha uma cidade — os bairros vêm do cadastro real."
        />

        <Secao
          id="promo"
          label="Tipo de promoção"
          valorLabel={
            promo === TODOS
              ? TODOS
              : (TIPOS_PROMOCAO.find((t) => t.id === promo)?.label ?? promo)
          }
          aberta={aberta === "promo"}
          onToggle={() => setAberta(aberta === "promo" ? null : "promo")}
          opcoes={[
            { valor: TODOS, label: TODOS },
            ...TIPOS_PROMOCAO.map((t) => ({ valor: t.id, label: t.label })),
          ]}
          selecionado={promo}
          selecionar={setPromo}
        />

        <Secao
          id="consumo"
          label="Tipo de consumo"
          valorLabel={
            consumo === TODOS
              ? TODOS
              : (FORMAS_CONSUMO.find((f) => f.id === consumo)?.label ?? consumo)
          }
          aberta={aberta === "consumo"}
          onToggle={() => setAberta(aberta === "consumo" ? null : "consumo")}
          opcoes={[
            { valor: TODOS, label: TODOS },
            ...FORMAS_CONSUMO.map((f) => ({ valor: f.id, label: f.label })),
          ]}
          selecionado={consumo}
          selecionar={setConsumo}
        />

        <div className="rounded-card border border-border bg-surface px-4 py-3.5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Valor mínimo de compra</span>
            <span className="text-sm font-semibold text-muted-foreground">
              {minSlider >= 200 ? "Sem limite" : `até R$ ${minSlider}`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={10}
            value={minSlider}
            onChange={(e) => setMinSlider(Number(e.target.value))}
            className="mt-3 w-full accent-primary"
            aria-label="Valor mínimo de compra"
          />
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-yellow via-yellow to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <Button variant="onYellow" className="w-full" size="lg" onClick={aplicar}>
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Secao({
  id,
  label,
  valorLabel,
  aberta,
  onToggle,
  opcoes,
  selecionado,
  selecionar,
  vazio,
}: {
  id: string;
  label: string;
  valorLabel: string;
  aberta: boolean;
  onToggle: () => void;
  opcoes: { valor: string; label: string }[];
  selecionado: string;
  selecionar: (v: string) => void;
  vazio?: string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        aria-controls={`filtro-${id}`}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          {valorLabel}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", aberta && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {aberta && (
        <ul id={`filtro-${id}`} className="border-t border-border">
          {opcoes.length === 0 && vazio ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">{vazio}</li>
          ) : (
            opcoes.map((op) => {
              const sel = selecionado === op.valor;
              return (
                <li key={op.valor}>
                  <button
                    type="button"
                    onClick={() => selecionar(op.valor)}
                    aria-pressed={sel}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted",
                      sel ? "font-semibold text-primary" : "text-foreground",
                    )}
                  >
                    {op.label}
                    {sel && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
