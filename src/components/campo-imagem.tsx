"use client";

/**
 * Campo de imagem do cupom (Fase 7/C4).
 *
 * PONTO DE TROCA NATIVO↔WEB — mesmo papel de `password-input.tsx`.
 *
 * O que é só-web mora aqui e em nenhum outro lugar: `<input type="file">`,
 * `URL.createObjectURL` para a pré-visualização e o `FormData` do envio. No app
 * nativo este arquivo é reescrito com picker/câmera; a Server Action e a
 * validação (`src/lib/imagem-cupom.ts`) são reaproveitadas sem uma linha de
 * mudança. O gatilho migra; o arquivo não.
 *
 * CONTRATO PARCIAL (Fase 6.5) — a razão de `onChange` só disparar quando o
 * usuário mexe: um formulário que sempre emitisse `imagem` reintroduziria o
 * quarto canal de perda silenciosa que o `montarPatchCupom` fechou. Aqui,
 * chave ausente = não mexe; `""` = remover de propósito.
 */
import * as React from "react";
import { ImagePlus, Loader2, Trash2, AlertTriangle } from "lucide-react";

import { uploadImagemCupomAction } from "@/lib/actions/cupons";
import { urlPublicaImagem, TAMANHO_MAX_IMAGEM } from "@/lib/imagem-cupom";
import { Button } from "@/components/ui/button";

interface CampoImagemProps {
  /** Caminho já gravado (edição). */
  valorAtual?: string | null;
  estabelecimentoId: string;
  /** `undefined` = intocado · `""` = remover · caminho = nova imagem. */
  onChange: (valor: string | undefined) => void;
  /** Cupom `ativo`: trocar a imagem manda para nova análise. */
  avisarRemoderacao?: boolean;
}

export function CampoImagem({
  valorAtual,
  estabelecimentoId,
  onChange,
  avisarRemoderacao,
}: CampoImagemProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [previa, setPrevia] = React.useState<string | null>(null);
  const [removida, setRemovida] = React.useState(false);

  const urlAtual = urlPublicaImagem(
    valorAtual,
    estabelecimentoId,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const mostrando = previa ?? (removida ? null : urlAtual);
  const mexeu = previa !== null || removida;

  // A prévia é um object URL: sem o revoke, cada troca de arquivo vaza memória.
  React.useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  async function selecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite reescolher o mesmo arquivo depois de um erro
    if (!arquivo) return;

    setErro(null);

    // Checagem de tamanho no cliente é CONVENIÊNCIA (evita subir 40 MB para
    // ouvir "não"), nunca barreira: quem decide é a Action, pelos magic bytes.
    if (arquivo.size > TAMANHO_MAX_IMAGEM) {
      setErro("A imagem passa de 2 MB. Reduza e tente de novo.");
      return;
    }

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await uploadImagemCupomAction(fd);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      if (previa) URL.revokeObjectURL(previa);
      setPrevia(URL.createObjectURL(arquivo));
      setRemovida(false);
      onChange(r.caminho);
    } catch {
      setErro("Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  function remover() {
    if (previa) URL.revokeObjectURL(previa);
    setPrevia(null);
    setRemovida(true);
    setErro(null);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-foreground">Imagem do cupom</span>

      <div className="flex items-start gap-3">
        <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted/70">
          {mostrando ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/image não é
            // usado em lugar nenhum do repo e exigiria remotePatterns; fora do escopo.
            <img src={mostrando} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={selecionar}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
            >
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>{mostrando ? "Trocar" : "Escolher imagem"}</>
              )}
            </Button>
            {mostrando && !enviando && (
              <Button type="button" variant="ghost" size="sm" onClick={remover}>
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · até 2 MB</p>
        </div>
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      {/*
        O rebaixamento é correto (a imagem é o que o consumidor vê primeiro),
        mas não pode ser surpresa: sem este aviso o lojista tira o próprio
        cupom do ar sem entender por quê.
      */}
      {avisarRemoderacao && mexeu && (
        <p className="flex items-start gap-1.5 rounded-md border border-yellow/40 bg-yellow-soft px-2.5 py-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Trocar a imagem manda o cupom para nova análise — ele sai do ar até ser aprovado.
        </p>
      )}
    </div>
  );
}
