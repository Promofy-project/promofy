"use client";

import { agruparPorSegmento } from "@/lib/taxonomia-url";
import { cn } from "@/lib/utils";

export interface OpcaoCategoriaEstab {
  id: string;
  label: string;
  ativo: boolean;
  segmentoSlug?: string;
  segmentoLabel?: string;
}

/**
 * Seletor de categoria do estabelecimento — agrupado por segmento.
 *
 * Autoridade: a lista que chega AQUI já é `estabelecimento_categorias_novas`
 * (criação = só ativas; edição = ativas + a atual, mesmo inativa). O
 * submit continua mandando o UUID em `categoria_nova_id` via Action.
 */
export function SeletorCategoriaEstab({
  categorias,
  value,
  onChange,
  categoriaInicial,
  statusCupom,
}: {
  categorias: OpcaoCategoriaEstab[];
  value: string | null;
  onChange: (id: string) => void;
  /** UUID da categoria já gravada — edição nunca a esconde. */
  categoriaInicial?: string | null;
  /** Se `ativo`, avisar que trocar categoria reenvia à moderação. */
  statusCupom?: string;
}) {
  const atual = categorias.find((c) => c.id === value);
  const atualInativa = atual?.ativo === false;
  const grupos = agruparPorSegmento(categorias);
  const mostrarGrupos = grupos.length > 1;
  const unica = categorias.length <= 1;
  const recategoriza =
    Boolean(categoriaInicial) &&
    Boolean(value) &&
    value !== categoriaInicial &&
    statusCupom === "ativo";

  if (categorias.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu estabelecimento ainda não tem categoria definida.
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-foreground">Categoria</legend>

      {unica ? (
        <div className="flex min-h-12 flex-col justify-center rounded-xl bg-muted/70 px-3.5 py-2 text-sm text-foreground">
          <span className="font-medium">
            {mostrarGrupos && atual?.segmentoLabel
              ? `${atual.segmentoLabel} · ${atual.label}`
              : (atual?.label ?? categorias[0]?.label ?? "—")}
          </span>
          <span className="text-xs text-muted-foreground">
            Definida pelo seu estabelecimento.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.map((g) => (
            <div key={g.slug} className="flex flex-col gap-1.5">
              {mostrarGrupos && (
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {g.itens.map((c) => {
                  const selected = value === c.id;
                  const inativa = c.ativo === false;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onChange(c.id)}
                      aria-pressed={selected}
                      className={cn(
                        "h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                        inativa && !selected && "opacity-70",
                      )}
                    >
                      {c.label}
                      {inativa ? " (indisponível)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {atualInativa && (
        <p className="text-xs font-semibold text-amber-700">
          Categoria atual — indisponível para novas seleções
        </p>
      )}

      {recategoriza && (
        <p className="text-xs text-muted-foreground">
          Trocar a categoria reenvia o cupom para análise. Os demais campos
          podem ser editados normalmente.
        </p>
      )}

      {!unica && (
        <span className="text-xs text-muted-foreground">
          Escolha entre as categorias do seu estabelecimento.
        </span>
      )}
    </fieldset>
  );
}
