"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { criarCupomAction } from "@/lib/actions/cupons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";

/**
 * Form reduzido de criação de cupom para o /e. Coleta só o essencial;
 * os campos avançados vão com defaults sensatos (prazo 5h da regra de
 * negócio; horário "todos os dias"). Categoria pré-setada e travada.
 */
export function NovoCupomForm({
  categoriaId,
  categoriaLabel,
}: {
  categoriaId: string | null;
  categoriaLabel: string | null;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = React.useState("");
  const [beneficio, setBeneficio] = React.useState("");
  const [economia, setEconomia] = React.useState("");
  const [validade, setValidade] = React.useState("");
  const [limiteUsuario, setLimiteUsuario] = React.useState("1");
  const [limiteTotal, setLimiteTotal] = React.useState("100");
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
      validade,
      ocultarAteInicio: false,
      prazoAtivacao: 5, // regra de negócio (a action usa MIN=1 se vier 0)
      dias: [],
      horaInicio: "00:00",
      horaFim: "23:59",
      limiteUsuario: Number(limiteUsuario) || 1,
      limiteTotal: Number(limiteTotal) || 1,
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
        label="Economia do cliente (R$)"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0,00"
        required
        value={economia}
        onChange={(e) => setEconomia(e.target.value)}
      />
      <Field
        label="Válido até"
        type="date"
        required
        value={validade}
        onChange={(e) => setValidade(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Por cliente"
          type="number"
          inputMode="numeric"
          min="1"
          value={limiteUsuario}
          onChange={(e) => setLimiteUsuario(e.target.value)}
        />
        <Field
          label="Total"
          type="number"
          inputMode="numeric"
          min="1"
          value={limiteTotal}
          onChange={(e) => setLimiteTotal(e.target.value)}
        />
      </div>

      {/* Categoria pré-setada do estabelecimento (D2-mínimo) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-foreground">Categoria</span>
        <div className="flex h-12 items-center rounded-xl bg-muted/70 px-3.5 text-sm text-foreground">
          {categoriaLabel ?? "—"}
        </div>
        <span className="text-xs text-muted-foreground">
          Definida pelo seu estabelecimento.
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
