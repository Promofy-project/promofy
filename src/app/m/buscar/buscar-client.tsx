"use client";

import * as React from "react";
import { Search, ArrowDownUp, SearchX, MapPin } from "lucide-react";

import type { Cupom } from "@/lib/types";
import type { CatalogoUrl, FiltroUrl } from "@/lib/taxonomia-url";
import { nomeDaFolha, nomeDoSegmento } from "@/lib/taxonomia-url";
import { DIAS_SEMANA, cupomDisponivelNoDia } from "@/lib/dias";
import { distanciaKm, TEXTO_GEO_NEGADO } from "@/lib/distancia";
import { extraDeFiltro, type FiltroConsumidor } from "@/lib/filtros-consumidor";
import { ehEscassez, noContextoRegional } from "@/lib/descoberta";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CouponListItem } from "@/components/coupon-list-item";
import { CupomSeloUtilizado } from "@/components/cupom-selo-utilizado";
import { FiltroTaxonomiaChips } from "@/components/filtro-taxonomia-chips";
import { useLocalizacaoDispositivo } from "@/components/localizacao-dispositivo";

const chips = ["Ordenar", "Maior economia", "Perto de mim"] as const;

export function BuscarClient({
  cupons,
  diaHoje,
  catalogo,
  catalogoVazio,
  filtro,
  diaInicial,
  filtroCons,
}: {
  cupons: Cupom[];
  diaHoje: string;
  catalogo: CatalogoUrl;
  catalogoVazio: boolean;
  filtro: FiltroUrl;
  diaInicial?: string;
  filtroCons: FiltroConsumidor;
}) {
  const [query, setQuery] = React.useState("");
  const [chip, setChip] = React.useState<(typeof chips)[number]>(
    filtroCons.perto ? "Perto de mim" : "Ordenar",
  );
  const [dia, setDia] = React.useState<string>(diaInicial ?? "Todos");
  const geo = useLocalizacaoDispositivo();

  React.useEffect(() => {
    if (chip === "Perto de mim" && geo.estado.status === "idle") {
      void geo.pedir();
    }
    // pedir/estado.status: não incluir o objeto inteiro (nova ref a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip, geo.estado.status]);

  const origem = geo.estado.status === "ok" ? { lat: geo.estado.lat, lng: geo.estado.lng } : null;

  const termo = query.trim().toLowerCase();
  let filtrados = cupons
    .filter(
      (c) =>
        !termo ||
        c.titulo.toLowerCase().includes(termo) ||
        c.estabelecimento.toLowerCase().includes(termo),
    )
    .filter((c) => dia === "Todos" || cupomDisponivelNoDia(c.dias, dia));

  if (filtroCons.trilho === "novos") {
    filtrados = filtrados.filter((c) => Boolean(c.publicadoEm));
  }
  if (filtroCons.trilho === "unidades") {
    filtrados = filtrados.filter((c) => ehEscassez(c.limiteTotal, c.restantes));
  }
  if (filtroCons.trilho === "populares") {
    filtrados = filtrados.filter((c) =>
      noContextoRegional(c, filtroCons.cidade, filtroCons.bairro),
    );
  }

  const comDistancia: Cupom[] = filtrados.map((c) => {
    if (!origem || c.latitude == null || c.longitude == null) {
      return { ...c, distanciaKm: undefined };
    }
    const km = distanciaKm(origem.lat, origem.lng, c.latitude, c.longitude);
    return { ...c, distanciaKm: km ?? undefined };
  });

  let resultados = comDistancia;
  if (chip === "Maior economia") {
    resultados = [...comDistancia].sort((a, b) => b.economia - a.economia);
  } else if (chip === "Perto de mim" && origem) {
    resultados = [...comDistancia].sort((a, b) => {
      if (a.distanciaKm == null && b.distanciaKm == null) return 0;
      if (a.distanciaKm == null) return 1;
      if (b.distanciaKm == null) return -1;
      return a.distanciaKm - b.distanciaKm;
    });
  }

  const labelSeg = nomeDoSegmento(filtro.seg, catalogo);
  const labelCat = nomeDaFolha(filtro, catalogo);
  const labelFiltro = labelCat ?? labelSeg;
  const extra = extraDeFiltro(filtroCons, dia === "Todos" ? undefined : dia);
  const geoNegado =
    chip === "Perto de mim" &&
    (geo.estado.status === "negado" || geo.estado.status === "indisponivel");

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-extrabold">Pesquisar</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquise cupom..."
          aria-label="Pesquisar cupom"
          className="h-12 rounded-xl border-2 border-primary pl-10"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {chips.map((c, i) => {
          const selected = chip === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              aria-pressed={selected}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {i === 0 && <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />}
              {c === "Perto de mim" && <MapPin className="h-3.5 w-3.5" aria-hidden />}
              {c}
            </button>
          );
        })}
      </div>

      {geoNegado && (
        <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
          {TEXTO_GEO_NEGADO}
        </p>
      )}

      {catalogoVazio ? (
        <p className="rounded-card border border-dashed border-border bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar os segmentos agora. A busca por texto
          continua disponível.
        </p>
      ) : (
        <FiltroTaxonomiaChips
          catalogo={catalogo}
          filtro={filtro}
          dia={dia === "Todos" ? undefined : dia}
          extra={extra}
        />
      )}

      <div
        role="group"
        aria-label="Dia da semana"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {["Todos", ...DIAS_SEMANA].map((d) => {
          const selected = dia === d;
          const hoje = d === diaHoje;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d)}
              aria-pressed={selected}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
              {hoje && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase",
                    selected ? "text-primary-foreground/80" : "text-primary",
                  )}
                >
                  hoje
                </span>
              )}
            </button>
          );
        })}
      </div>

      {labelFiltro && (
        <p className="text-xs font-semibold text-muted-foreground">{labelFiltro}</p>
      )}

      {resultados.length > 0 ? (
        <div className="flex flex-col gap-3">
          {resultados.map((c) => (
            <CouponListItem
              key={c.id}
              cupom={c}
              href={`/m/cupom/${c.id}`}
              overlay={<CupomSeloUtilizado cupomId={c.id} />}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold">Nenhum cupom encontrado</p>
        </div>
      )}
    </div>
  );
}
