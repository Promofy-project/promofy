"use client";

/**
 * Gestão da galeria do PERFIL do estabelecimento (CLIENT-RETURNS-03).
 *
 * UM COMPONENTE, DUAS SUPERFÍCIES. O `/portal/estabelecimento` (web do
 * lojista) e o `/e/perfil` (app do balcão) montam ESTE arquivo. Paridade por
 * compartilhamento e não por cópia: dois componentes iguais divergem na
 * primeira correção que alguém faz num só.
 *
 * PONTO DE TROCA NATIVO↔WEB — mesmo papel de `campo-imagem.tsx`. O que é
 * só-web mora aqui: `<input type="file">`, o recorte, `URL.createObjectURL`,
 * `FormData`. No app nativo este arquivo é reescrito com picker/câmera; as
 * Server Actions (`src/lib/actions/galeria-estab.ts`) e a regra pura
 * (`src/lib/galeria-estabelecimento.ts`) são reaproveitadas sem mudança.
 *
 * REORDENAR POR BOTÃO, NÃO POR ARRASTE. O projeto não tem dependência de
 * drag-and-drop, e a alternativa acessível de um DnD (teclado, leitor de tela)
 * é exatamente este par de botões — que já é a versão acessível por
 * construção. Um clique = uma troca = uma chamada, e a ordem inteira vai numa
 * RPC transacional.
 *
 * `type="button"` EM TODO BOTÃO. Dentro de um `<form>` o default do HTML é
 * `submit`, e o Portal monta esta galeria na mesma página do formulário de
 * cadastro. O `<Button>` da casa já nasce `type="button"`, mas isso está
 * declarado aqui porque foi um bug real da Fase 8.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";

import {
  adicionarImagemGaleriaAction,
  removerImagemGaleriaAction,
  reordenarGaleriaAction,
} from "@/lib/actions/galeria-estab";
import {
  ASPECTO_IMAGEM_GALERIA,
  LARGURA_EXPORT_GALERIA,
  MAX_IMAGENS_GALERIA,
  altImagemGaleria,
  galeriaCheia,
  moverNaGaleria,
} from "@/lib/galeria-estabelecimento";
import { TAMANHO_MAX_IMAGEM } from "@/lib/imagem-cupom";
import { Button } from "@/components/ui/button";
import { CropImagem } from "@/components/crop-imagem";

export interface ImagemGaleriaUI {
  id: string;
  url: string | null;
}

export function GaleriaEstabelecimento({
  nomeEstabelecimento,
  imagens,
  onMudou,
  compacto = false,
}: {
  nomeEstabelecimento: string;
  imagens: ImagemGaleriaUI[];
  /** Extra, além do `router.refresh()` que já acontece sempre. */
  onMudou?: () => void;
  /** `/e` é uma tela de celular: grid de 2 colunas e textos mais curtos. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pendente, setPendente] = React.useState<File | null>(null);
  const [ocupado, setOcupado] = React.useState<null | "enviando" | "removendo" | "ordem">(
    null,
  );
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  // Ordem local para o clique responder na hora; o servidor é a autoridade e
  // `atualizar()` traz a verdade de volta. Um erro devolve a ordem anterior.
  const [ordem, setOrdem] = React.useState<string[]>(() => imagens.map((i) => i.id));
  React.useEffect(() => {
    setOrdem(imagens.map((i) => i.id));
  }, [imagens]);

  const porId = new Map(imagens.map((i) => [i.id, i]));
  const visiveis = ordem.flatMap((id) => {
    const i = porId.get(id);
    return i ? [i] : [];
  });
  const total = visiveis.length;
  const cheia = galeriaCheia(total);

  /**
   * A Action já chamou `revalidatePath` nas três superfícies; o `refresh()`
   * é o que faz ESTA aba buscar de novo o server component (sem ele o Router
   * Cache do cliente seguiria mostrando a galeria antiga até a navegação).
   */
  function atualizar() {
    router.refresh();
    onMudou?.();
  }

  function selecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite reescolher o mesmo arquivo depois de um erro
    if (!arquivo) return;
    setErro(null);
    setAviso(null);
    // Conveniência, nunca barreira: quem decide é a Action, pelos magic bytes.
    if (arquivo.size > TAMANHO_MAX_IMAGEM) {
      setErro("A imagem passa de 2 MB. Reduza e tente de novo.");
      return;
    }
    setPendente(arquivo);
  }

  async function enviar(arquivo: File) {
    setPendente(null);
    setOcupado("enviando");
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await adicionarImagemGaleriaAction(fd);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      atualizar();
    } catch {
      setErro("Não foi possível enviar a imagem.");
    } finally {
      setOcupado(null);
    }
  }

  async function remover(id: string) {
    setOcupado("removendo");
    setErro(null);
    setAviso(null);
    try {
      const r = await removerImagemGaleriaAction(id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // A foto SAIU do perfil (a linha morreu). O ARQUIVO pode ter ficado, e
      // dizer isso é melhor do que um sucesso que esconde metade do que houve.
      //
      // O texto NÃO afirma a causa: pode ser a policy da migration 23 (um
      // cupom moderado aponta para o arquivo) ou o Storage simplesmente fora
      // do ar. Nomear uma das duas seria adivinhar a errada metade das vezes.
      if (!r.arquivoRemovido) {
        setAviso(
          "Imagem removida da galeria — ela já não aparece no seu perfil. O arquivo em si continuou no armazenamento.",
        );
      }
      atualizar();
    } catch {
      setErro("Não foi possível remover a imagem.");
    } finally {
      setOcupado(null);
    }
  }

  async function mover(id: string, direcao: "esquerda" | "direita") {
    const nova = moverNaGaleria(ordem, id, direcao);
    if (!nova) return; // já é a primeira/última: sem viagem
    const anterior = ordem;
    setOrdem(nova);
    setOcupado("ordem");
    setErro(null);
    try {
      const r = await reordenarGaleriaAction(nova);
      if (!r.ok) {
        setOrdem(anterior);
        setErro(r.erro);
        return;
      }
      atualizar();
    } catch {
      setOrdem(anterior);
      setErro("Não foi possível salvar a nova ordem.");
    } finally {
      setOcupado(null);
    }
  }

  const trabalhando = ocupado !== null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Galeria do estabelecimento
        </h3>
        <span className="text-xs text-muted-foreground">
          {total} de {MAX_IMAGENS_GALERIA}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Mostre seu espaço, produtos e outras opções para seus clientes.
      </p>

      {total === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
          <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-sm font-semibold">Nenhuma imagem ainda</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Fotos do ambiente, dos produtos e do cardápio aparecem no seu perfil
            para o consumidor.
          </p>
        </div>
      ) : (
        <ul
          className={
            compacto
              ? "grid grid-cols-2 gap-2.5"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3"
          }
        >
          {visiveis.map((img, i) => (
            <li
              key={img.id}
              className="overflow-hidden rounded-xl border border-border bg-muted/50"
            >
              <div
                className="relative w-full bg-muted"
                style={{ aspectRatio: `${ASPECTO_IMAGEM_GALERIA} / 1` }}
              >
                {img.url ? (
                  // next/image não é usado em lugar nenhum do repo e exigiria
                  // `remotePatterns` para o host do Storage — fora do escopo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={altImagemGaleria(nomeEstabelecimento, i, total)}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                    Imagem indisponível
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={trabalhando || i === 0}
                    aria-label={`Mover a imagem ${i + 1} para a esquerda`}
                    onClick={() => void mover(img.id, "esquerda")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={trabalhando || i === total - 1}
                    aria-label={`Mover a imagem ${i + 1} para a direita`}
                    onClick={() => void mover(img.id, "direita")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-danger"
                  disabled={trabalhando}
                  aria-label={`Remover a imagem ${i + 1} da galeria`}
                  onClick={() => void remover(img.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={selecionar}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={trabalhando || cheia}
          onClick={() => inputRef.current?.click()}
        >
          {ocupado === "enviando" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" /> Adicionar imagem
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou WebP · até 2 MB
        </p>
      </div>

      {cheia && (
        <p className="text-xs text-muted-foreground">
          Limite de {MAX_IMAGENS_GALERIA} imagens atingido. Remova uma para
          adicionar outra.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {erro}
        </p>
      )}

      {aviso && (
        <p className="flex items-start gap-1.5 rounded-md border border-yellow/40 bg-yellow-soft px-2.5 py-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {aviso}
        </p>
      )}

      {pendente && (
        <CropImagem
          arquivo={pendente}
          aspecto={ASPECTO_IMAGEM_GALERIA}
          larguraExport={LARGURA_EXPORT_GALERIA}
          titulo="Enquadre a foto do seu estabelecimento"
          onCancelar={() => setPendente(null)}
          onConfirmar={(f) => void enviar(f)}
        />
      )}
    </section>
  );
}
