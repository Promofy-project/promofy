"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validarCupomAction } from "@/lib/actions/cupons";
import { normalizarCodigoCupom } from "@/lib/codigo-cupom";
import {
  ResultadoValidacao,
  type ResultadoValidar,
} from "@/components/estab/resultado-validacao";
import { QrScanner } from "@/components/estab/qr-scanner";

export function ValidarClient() {
  const [codigo, setCodigo] = React.useState("");
  const [validando, setValidando] = React.useState(false);
  const [resultado, setResultado] = React.useState<ResultadoValidar | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function validar(e: React.FormEvent) {
    e.preventDefault();
    // No balcão ninguém quer caçar hífen no teclado: aceita "KK8P8U6Q",
    // "prmf kk8p 8u6q" ou o código colado inteiro. A reconstituição do
    // formato canônico é função pura (src/lib), e a RPC + o formato
    // gravado no banco continuam exatamente como eram.
    const codigoLimpo = normalizarCodigoCupom(codigo);
    if (!codigoLimpo) return;
    setValidando(true);
    const r = await validarCupomAction(codigoLimpo);
    setValidando(false);
    setResultado(r);
  }

  function reset() {
    setResultado(null);
    setCodigo("");
    // refoca (Android/desktop; no iOS o teclado só sobe com um toque)
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (resultado) {
    return <ResultadoValidacao resultado={resultado} onOutro={reset} />;
  }

  return (
    <div className="flex flex-1 flex-col p-5">
      <header className="flex items-center gap-2 pb-6">
        <Link
          href="/e"
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Validar cupom</h1>
      </header>

      <form onSubmit={validar} className="flex flex-1 flex-col">
        <label htmlFor="codigo-cupom" className="text-sm font-semibold text-foreground">
          Código apresentado pelo cliente
        </label>
        <Input
          id="codigo-cupom"
          ref={inputRef}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="PRMF-XXXX-XXXX"
          // Código é ALFANUMÉRICO — nada de inputMode="numeric" (bloquearia as
          // letras no teclado do celular). uppercase automático + autofocus.
          // Sem maxLength: com ou sem hífens muda o comprimento, e cortar
          // atrapalharia a colagem.
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="mt-2 h-16 text-center font-mono text-2xl uppercase tracking-widest"
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Pode digitar só os 8 caracteres, sem os hífens.
        </p>

        <QrScanner className="mt-4" />

        {/* ação ancorada embaixo (alcance do polegar) */}
        <div className="mt-auto pt-6">
          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={validando || !codigo.trim()}
          >
            {validando ? "Validando…" : "Validar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
