"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ValidarDadosDTO } from "@/lib/actions/cupons";

export type ResultadoValidar =
  | { ok: true; dados: ValidarDadosDTO }
  | { ok: false; motivo: string };

// Texto humano por motivo — cobre TODOS os motivos que validar_cupom pode
// retornar (incl. `esgotado`, ausente no mapa do dialog do portal) + default
// seguro. Cada erro tem título + descrição para leitura à distância no balcão.
const ERRO: Record<string, { titulo: string; descricao: string }> = {
  nao_encontrado: {
    titulo: "Código não encontrado",
    descricao: "Confira os caracteres e tente de novo.",
  },
  ja_validado: {
    titulo: "Cupom já utilizado",
    descricao: "Este código já foi validado antes.",
  },
  expirado: {
    titulo: "Cupom expirado",
    descricao: "O prazo de uso deste cupom terminou.",
  },
  outro_estabelecimento: {
    titulo: "Não é do seu estabelecimento",
    descricao: "Este cupom pertence a outra loja.",
  },
  cupom_proprio: {
    titulo: "Cupom próprio",
    descricao: "Você não pode validar o seu próprio cupom.",
  },
  esgotado: {
    titulo: "Cupom esgotado",
    descricao: "Este cupom atingiu o limite de resgates.",
  },
  sem_permissao: {
    titulo: "Sem estabelecimento",
    descricao: "Sua conta não tem um estabelecimento vinculado.",
  },
  erro: {
    titulo: "Não foi possível validar",
    descricao: "Tente novamente em instantes.",
  },
};

/**
 * Resultado da validação em TELA CHEIA (overlay fixo acima do bottom nav):
 * verde no sucesso (com título, cliente e CPF mascarado bem visíveis) e
 * vermelho no erro (motivo humano + "Validar outro"). Presentacional — a
 * lógica de validação vive na tela /e/validar.
 */
export function ResultadoValidacao({
  resultado,
  onOutro,
}: {
  resultado: ResultadoValidar;
  onOutro: () => void;
}) {
  if (resultado.ok) {
    const d = resultado.dados;
    return (
      <div className="animate-fade-up absolute inset-0 z-50 flex flex-col bg-success px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 text-white">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CheckCircle2 className="h-24 w-24" strokeWidth={2.2} />
          <h1 className="mt-4 text-3xl font-extrabold">Cupom validado!</h1>
          <p className="mt-1 font-mono text-base text-white/85">{d.codigo}</p>

          <div className="mt-8 w-full rounded-card bg-white/15 p-5 text-left">
            <p className="text-xl font-bold leading-tight">{d.titulo}</p>
            {d.beneficio && <p className="mt-1 text-white/85">{d.beneficio}</p>}
            <div className="mt-4 space-y-1 border-t border-white/25 pt-4">
              <p className="text-xs uppercase tracking-wide text-white/70">
                Cliente
              </p>
              <p className="text-2xl font-bold leading-tight">
                {d.cliente_nome || "—"}
              </p>
              <p className="font-mono text-lg text-white/90">{d.cliente_cpf}</p>
            </div>
          </div>
        </div>
        <Button size="xl" variant="secondary" className="w-full" onClick={onOutro}>
          Validar outro
        </Button>
      </div>
    );
  }

  const e = ERRO[resultado.motivo] ?? ERRO.erro;
  return (
    <div className="animate-fade-up absolute inset-0 z-50 flex flex-col bg-danger px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <XCircle className="h-24 w-24" strokeWidth={2.2} />
        <h1 className="mt-4 text-3xl font-extrabold">{e.titulo}</h1>
        <p className="mt-2 max-w-xs text-lg text-white/85">{e.descricao}</p>
      </div>
      <Button size="xl" variant="secondary" className="w-full" onClick={onOutro}>
        Validar outro
      </Button>
    </div>
  );
}
