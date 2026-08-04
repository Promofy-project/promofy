/**
 * Imagem do cupom: validação e caminho (Fase 7/C4).
 *
 * Módulo PURO — sem "server-only", sem DOM, sem `Intl`, sem `Buffer`. Roda no
 * servidor, na suíte e, sem uma linha de mudança, no app nativo: a validação
 * de upload é a mesma regra dos dois lados, e regra duplicada é regra que
 * diverge.
 *
 * O QUE ESTE MÓDULO GARANTE, E POR QUE CADA COISA
 *
 * 1. **Tipo pelos MAGIC BYTES, não pela extensão nem pelo Content-Type.**
 *    Os dois últimos são texto que o cliente escolhe. Um arquivo chamado
 *    `foto.jpg` enviado como `image/jpeg` pode ser um HTML — e o Storage
 *    serviria o Content-Type declarado, virando página executável hospedada
 *    num domínio confiável. Quem decide o tipo aqui é o conteúdo.
 *
 * 2. **SVG jamais entra.** É o vetor clássico de script dentro de "imagem".
 *    Não está na whitelist e não tem magic byte que case — a ausência é
 *    deliberada, não esquecimento.
 *
 * 3. **O caminho é montado no servidor, inteiro.** O cliente não fornece
 *    nenhum pedaço: nem pasta, nem nome, nem extensão. Path traversal deixa de
 *    ser uma validação a acertar e passa a ser impossível por construção.
 *
 * 4. **A renderização valida de novo.** `imagem` está no `grant update` por
 *    coluna do lojista desde a Fase 3, então ele escreve QUALQUER string ali
 *    via PostgREST — inclusive o caminho de outro estabelecimento ou uma URL
 *    externa. `urlPublicaImagem` só devolve URL quando o valor casa com o
 *    formato E pertence ao estabelecimento daquele cupom. Lixo vira fallback.
 */

/** 2 MiB. Espelha o `file_size_limit` do bucket (migration 22) — as duas barreiras. */
export const TAMANHO_MAX_IMAGEM = 2 * 1024 * 1024;

export const BUCKET_IMAGENS = "cupom-imagens";

export type ExtensaoImagem = "jpg" | "png" | "webp";

export interface TipoImagem {
  mime: string;
  ext: ExtensaoImagem;
}

function comeca(bytes: Uint8Array, assinatura: number[], desloc = 0): boolean {
  if (bytes.length < desloc + assinatura.length) return false;
  for (let i = 0; i < assinatura.length; i++) {
    if (bytes[desloc + i] !== assinatura[i]) return false;
  }
  return true;
}

/**
 * Tipo real do arquivo, pelos primeiros bytes. `null` = não é imagem aceita.
 *
 * WebP exige as DUAS marcas: `RIFF` no início E `WEBP` no offset 8. Só `RIFF`
 * também é WAV, AVI e outros contêineres — aceitar pelo prefixo deixaria
 * passar arquivo que o navegador não renderiza como imagem.
 */
export function detectarTipoImagem(bytes: Uint8Array): TipoImagem | null {
  if (comeca(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    comeca(bytes, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * Forma exata do que gravamos em `cupons.imagem`: `<estabelecimento>/<32 hex>.<ext>`.
 *
 * Guardamos o CAMINHO, nunca a URL completa. Uma URL no banco seria um alvo
 * escrevível apontando para fora — e a coluna é escrivível pelo lojista.
 */
export const PATH_IMAGEM_RE = /^[a-z0-9-]+\/[0-9a-f]{32}\.(jpg|png|webp)$/;

/** Monta o caminho. `hex32` vem de um gerador criptográfico no servidor. */
export function caminhoImagem(
  estabelecimentoId: string,
  hex32: string,
  ext: ExtensaoImagem,
): string {
  return `${estabelecimentoId}/${hex32}.${ext}`;
}

/**
 * URL pública da imagem — ou `null`, que a UI traduz no gradiente de sempre.
 *
 * Devolve `null` quando o valor não casa com o formato OU não pertence ao
 * estabelecimento daquele cupom. É a barreira que torna inócua a escrita
 * direta na coluna: no pior caso o lojista apaga a própria imagem, nunca
 * exibe a de outro nem carrega recurso de fora.
 *
 * Efeito colateral bem-vindo: os caminhos mortos do seed (`/img/cupons/c01.jpg`,
 * que nunca existiram em `public/`) também caem no fallback.
 */
export function urlPublicaImagem(
  imagem: string | null | undefined,
  estabelecimentoId: string,
  supabaseUrl: string,
): string | null {
  if (!imagem || !PATH_IMAGEM_RE.test(imagem)) return null;
  if (!imagem.startsWith(`${estabelecimentoId}/`)) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET_IMAGENS}/${imagem}`;
}

/** Motivos de recusa — a Action traduz em mensagem; a suíte assere o código. */
export type MotivoRecusaImagem = "tipo_invalido" | "muito_grande" | "vazio";

export function validarBytesImagem(
  bytes: Uint8Array,
): { ok: true; tipo: TipoImagem } | { ok: false; motivo: MotivoRecusaImagem } {
  if (bytes.length === 0) return { ok: false, motivo: "vazio" };
  // Tamanho ANTES do tipo: rejeitar 50 MB não deve custar leitura de conteúdo.
  if (bytes.length > TAMANHO_MAX_IMAGEM) return { ok: false, motivo: "muito_grande" };
  const tipo = detectarTipoImagem(bytes);
  if (!tipo) return { ok: false, motivo: "tipo_invalido" };
  return { ok: true, tipo };
}
