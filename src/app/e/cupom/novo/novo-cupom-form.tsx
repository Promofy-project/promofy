"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { criarCupomAction } from "@/lib/actions/cupons";
import {
  FORMAS_CONSUMO,
  PRAZO_ATIVACAO_MIN_HORAS,
  TAXAS,
} from "@/lib/cupom-campos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/field";

/** Alterna um id numa lista multivalorada. */
function toggleEm(
  set: React.Dispatch<React.SetStateAction<string[]>>,
  id: string,
) {
  set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
}

/** Grupo de chips de múltipla escolha — alvo grande, padrão do totem. */
function Chips({
  titulo,
  opcoes,
  selecionados,
  onToggle,
  ajuda,
}: {
  titulo: string;
  opcoes: readonly { id: string; label: string }[];
  selecionados: string[];
  onToggle: (id: string) => void;
  ajuda: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-foreground">{titulo}</span>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            aria-pressed={selecionados.includes(o.id)}
            className={cn(
              "h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
              selecionados.includes(o.id)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{ajuda}</span>
    </div>
  );
}

/**
 * Form reduzido de criação de cupom para o /e. Coleta só o essencial;
 * os campos avançados vão com defaults sensatos (prazo 5h da regra de
 * negócio; horário "todos os dias"). Fase 4: o estabelecimento pode ter
 * N categorias — com 1, o campo fica travado como antes; com 2+, vira
 * seleção por chips (a principal pré-selecionada). O servidor valida
 * contra o conjunto de qualquer forma.
 */
export function NovoCupomForm({
  categorias,
  categoriaPrincipal,
}: {
  categorias: { id: string; label: string }[];
  categoriaPrincipal: string | null;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = React.useState("");
  const [beneficio, setBeneficio] = React.useState("");
  const [economia, setEconomia] = React.useState("");
  // Fase 6/C3 e C1 — os mesmos campos do portal, no formato do totem:
  // switches e chips, sem digitação onde der para tocar.
  const [economiaVariavel, setEconomiaVariavel] = React.useState(false);
  const [formasConsumo, setFormasConsumo] = React.useState<string[]>([]);
  const [taxas, setTaxas] = React.useState<string[]>([]);
  const [validade, setValidade] = React.useState("");
  const [limiteUsuario, setLimiteUsuario] = React.useState("1");
  const [limiteTotal, setLimiteTotal] = React.useState("100");
  const [limiteUsuarioIlimitado, setLimiteUsuarioIlimitado] = React.useState(false);
  const [limiteTotalIlimitado, setLimiteTotalIlimitado] = React.useState(false);
  const [categoriaId, setCategoriaId] = React.useState<string | null>(
    categoriaPrincipal ?? categorias[0]?.id ?? null,
  );
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!categoriaId) {
      setErro("Seu estabelecimento ainda não tem categoria definida.");
      return;
    }
    setSalvando(true);
    const r = await criarCupomAction({
      titulo,
      beneficio,
      categoria: categoriaId,
      economia: Number(economia.replace(",", ".")) || 0,
      economiaVariavel,
      validade,
      ocultarAteInicio: false,
      // regra de negócio; a action recusa abaixo disso e o CHECK da
      // coluna cobre o PostgREST direto
      prazoAtivacao: PRAZO_ATIVACAO_MIN_HORAS,
      dias: [],
      horaInicio: "00:00",
      horaFim: "23:59",
      limiteUsuario: Number(limiteUsuario) || 1,
      limiteTotal: Number(limiteTotal) || 1,
      limiteUsuarioIlimitado,
      limiteTotalIlimitado,
      taxas,
      formasConsumo,
    });
    setSalvando(false);
    if (r.ok) {
      router.push("/e/cupons");
      router.refresh();
    } else {
      setErro(r.erro);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-1 flex-col gap-4">
      <Field
        label="Título"
        placeholder="Ex.: Pizza em dobro"
        required
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <Field
        label="Benefício"
        placeholder="Ex.: Na compra de 1 pizza, leve 2"
        value={beneficio}
        onChange={(e) => setBeneficio(e.target.value)}
      />
      <Field
        label={
          economiaVariavel
            ? "Economia mínima garantida (R$)"
            : "Economia do cliente (R$)"
        }
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0,00"
        required
        value={economia}
        onChange={(e) => setEconomia(e.target.value)}
      />

      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            Economia variável
          </span>
          <span className="text-xs text-muted-foreground">
            O cliente economiza pelo menos esse valor — pode ser mais.
          </span>
        </span>
        <Switch checked={economiaVariavel} onCheckedChange={setEconomiaVariavel} />
      </label>

      <Chips
        titulo="Formas de consumo"
        opcoes={FORMAS_CONSUMO}
        selecionados={formasConsumo}
        onToggle={(id) => toggleEm(setFormasConsumo, id)}
        ajuda="Onde o cupom vale."
      />

      <Chips
        titulo="Taxas NÃO cobertas"
        opcoes={TAXAS}
        selecionados={taxas}
        onToggle={(id) => toggleEm(setTaxas, id)}
        ajuda="O cliente vê “não inclui…” na hora de usar."
      />
      <Field
        label="Válido até"
        type="date"
        required
        value={validade}
        onChange={(e) => setValidade(e.target.value)}
      />
      {/* Fase 6/C1: "ilimitado" explícito e separado nos dois limites —
          marcado, o servidor grava NULL (o vocabulário que `limite_total`
          já usava). O input desabilita para não sugerir que o número
          digitado ainda vale. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Field
            label="Por cliente"
            type="number"
            inputMode="numeric"
            min="1"
            value={limiteUsuario}
            onChange={(e) => setLimiteUsuario(e.target.value)}
            disabled={limiteUsuarioIlimitado}
          />
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Switch
              checked={limiteUsuarioIlimitado}
              onCheckedChange={setLimiteUsuarioIlimitado}
            />
            Ilimitado
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <Field
            label="Total"
            type="number"
            inputMode="numeric"
            min="1"
            value={limiteTotal}
            onChange={(e) => setLimiteTotal(e.target.value)}
            disabled={limiteTotalIlimitado}
          />
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Switch
              checked={limiteTotalIlimitado}
              onCheckedChange={setLimiteTotalIlimitado}
            />
            Sem limite
          </label>
        </div>
      </div>

      {/* Categoria: travada com 1; chips com 2+ (padrão do seletor de dias) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-foreground">Categoria</span>
        {categorias.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                  categoriaId === c.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-12 items-center rounded-xl bg-muted/70 px-3.5 text-sm text-foreground">
            {categorias[0]?.label ?? "—"}
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {categorias.length > 1
            ? "Escolha entre as categorias do seu estabelecimento."
            : "Definida pelo seu estabelecimento."}
        </span>
      </div>

      {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}

      <div className="mt-auto pt-4">
        <Button type="submit" size="lg" className="w-full" disabled={salvando}>
          {salvando ? "Salvando…" : "Criar cupom"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          O cupom passa por análise antes de aparecer no app.
        </p>
      </div>
    </form>
  );
}
