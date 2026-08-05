"use client";

import * as React from "react";
import { IdCard, ChevronRight, Loader2 } from "lucide-react";

import {
  buscarAtivacoesPorCpfAction,
  validarPorAtivacaoAction,
  type AtivacaoPorCpfDTO,
} from "@/lib/actions/cupons";
import type { ResultadoValidar } from "@/components/estab/resultado-validacao";
import { formatarCpf, cpfValido } from "@/lib/cpf";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Validação por identidade (Fase 8/V3) — o caminho de quem chegou sem o
 * celular.
 *
 * DISCRETA por pedido do cliente: o código continua sendo o caminho
 * principal. Aqui é um link fino que abre um painel, não uma aba nem um botão
 * concorrendo com o "Validar".
 *
 * UM ÚNICO TEXTO PARA TODOS OS "NÃO ACHEI". CPF inexistente, CPF de cliente de
 * outro estabelecimento e CPF sem ativação viva recebem exatamente a mesma
 * frase — o servidor já devolve o mesmo motivo, e diferenciá-los aqui
 * reintroduziria pela tela o oráculo que a RPC fecha.
 */
const MENSAGEM: Record<string, string> = {
  // O mesmo texto, propositalmente, para os três casos que o servidor unifica.
  sem_ativacao_aqui: "Nenhum cupom ativo para este CPF aqui.",
  cpf_invalido: "CPF inválido. Confira os números.",
  muitas_tentativas: "Muitas consultas seguidas. Aguarde um instante e tente de novo.",
  sem_permissao: "Sua conta não está vinculada a um estabelecimento.",
  sem_sessao: "Sessão expirada. Entre novamente.",
  erro: "Não foi possível consultar agora.",
};

export function ValidarPorCpf({
  onResultado,
}: {
  onResultado: (r: ResultadoValidar) => void;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [cpf, setCpf] = React.useState("");
  const [buscando, setBuscando] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState<number | null>(null);
  const [itens, setItens] = React.useState<AtivacaoPorCpfDTO[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  const digitos = cpf.replace(/\D/g, "");
  const podeBuscar = cpfValido(cpf) && !buscando;

  async function buscar() {
    if (!podeBuscar) return;
    setErro(null);
    setItens(null);
    setBuscando(true);
    const r = await buscarAtivacoesPorCpfAction(cpf);
    setBuscando(false);
    if (!r.ok) {
      setErro(MENSAGEM[r.motivo] ?? MENSAGEM.erro);
      return;
    }
    setItens(r.itens);
  }

  async function confirmar(rowId: number) {
    setConfirmando(rowId);
    // O CPF vai junto: é ele, não o row_id, a credencial deste caminho.
    const r = await validarPorAtivacaoAction(rowId, cpf);
    setConfirmando(null);
    // Reusa a MESMA tela verde/vermelha do fluxo por código — o lojista não
    // aprende dois vocabulários de resultado.
    onResultado(r);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <IdCard className="h-4 w-4" aria-hidden />
        Cliente sem o código? Validar por CPF
      </button>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <IdCard className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-bold">Validar por CPF</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Peça o documento do cliente e digite o CPF.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={cpf}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
          // Enter aqui BUSCA — e, sobretudo, não deixa a submissão implícita
          // do formulário externo acontecer. `type="button"` no botão resolve o
          // clique, mas não o Enter: qualquer campo de texto dentro de um
          // <form> dispara o submit padrão, que no /e/validar valida o código
          // digitado no campo ao lado, de forma permanente.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (podeBuscar) void buscar();
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          aria-label="CPF do cliente"
          className="h-12 flex-1 rounded-xl border border-transparent bg-surface px-3 text-center font-mono text-base tracking-wider text-foreground focus-visible:border-primary focus-visible:outline-none"
        />
        {/* type="button" NÃO é decoração: este painel vive DENTRO do <form> do
            /e/validar. Sem ele, clicar em "Buscar" submetia o formulário e
            validava o código digitado no campo ao lado — de forma permanente.
            O default do <Button> da casa hoje já é "button"; aqui fica
            explícito porque o risco é local e específico. */}
        <Button type="button" onClick={buscar} disabled={!podeBuscar} className="h-12 px-4">
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </div>

      {/* Aviso só depois de 11 dígitos: cobrar CPF completo a cada tecla
          digitada seria erro constante durante a digitação normal. */}
      {digitos.length === 11 && !cpfValido(cpf) && (
        <p className="mt-2 text-xs text-danger">{MENSAGEM.cpf_invalido}</p>
      )}

      {erro && <p className="mt-3 text-xs font-semibold text-danger">{erro}</p>}

      {itens && itens.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {itens.map((i) => (
            <li key={i.row_id}>
              <button
                type="button"
                onClick={() => confirmar(i.row_id)}
                disabled={confirmando !== null}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary",
                  confirmando === i.row_id && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{i.cupom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.nome} · {i.cpf_mascarado}
                  </p>
                </div>
                {confirmando === i.row_id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
