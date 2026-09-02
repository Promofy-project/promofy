/**
 * Código do cupom — formato canônico, normalização e máscara visual.
 *
 * O banco gera e ARMAZENA sempre `PRMF-XXXX-XXXX` (alfabeto de 32
 * caracteres sem 0/O/1/I — ver `gerar_codigo_cupom` em
 * 20260713014516_funcoes_triggers.sql), e `validar_cupom` compara o
 * código EXATO. Nada disso muda: o que muda é a tolerância da entrada
 * e a APRESENTAÇÃO no balcão/consumidor.
 *
 * No balcão, quem digita não quer caçar hífen nem o prefixo PRMF.
 * `formatarEntradaCodigoCupom` monta `PRMF - XXXX - XXXX` enquanto digita;
 * `normalizarCodigoCupom` reconstitui o canônico antes da RPC.
 *
 * Módulo puro: sem "server-only", sem DOM. Reaproveitável como está no
 * app React Native (é lá que digitar sem hífen mais importa).
 */

/** Formato exato gravado no banco / QR. */
export const CODIGO_PREFIXO = "PRMF";

/** 8 caracteres significativos, em dois blocos de 4. */
const TAMANHO_SIGNIFICATIVO = 8;

/**
 * Só os caracteres significativos (máx. 8), uppercase, sem prefixo PRMF
 * e sem separadores. Não corrige 0↔O / 1↔I.
 *
 * Pode haver mais de um `PRMF` na limpeza (ex.: valor já mascarado
 * reprocessado, ou colagem `PRMF` + dígitos sobre o campo). Strip em
 * loop; `PRMF` sozinho → nenhum significativo (placeholder fala).
 */
export function significativosCodigoCupom(entrada: string): string {
  // toUpperCase (e não toLocaleUpperCase): insensível a locale — no
  // turco, "i".toLocaleUpperCase() vira "İ" e corromperia o código.
  let limpo = (entrada ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  while (limpo.startsWith(CODIGO_PREFIXO) && limpo.length > CODIGO_PREFIXO.length) {
    limpo = limpo.slice(CODIGO_PREFIXO.length);
  }
  if (limpo === CODIGO_PREFIXO) return "";
  return limpo.slice(0, TAMANHO_SIGNIFICATIVO);
}

/**
 * Máscara visual do campo único no balcão / exibição ao consumidor.
 *
 * Entrada livre (digitação, paste canônico, paste grudado) →
 * `PRMF - XXXX - XXXX` progressivo. Vazio → "" (o placeholder fala).
 *
 * NÃO é o formato do banco. Para a Action/RPC use `normalizarCodigoCupom`.
 */
export function formatarEntradaCodigoCupom(entrada: string): string {
  const sig = significativosCodigoCupom(entrada);
  if (!sig) return "";
  if (sig.length <= 4) return `${CODIGO_PREFIXO} - ${sig}`;
  return `${CODIGO_PREFIXO} - ${sig.slice(0, 4)} - ${sig.slice(4)}`;
}

/**
 * Apresentação legível de um código já canônico (ou quase).
 * Mesma máscara da entrada — um único helper, duas intenções de chamada.
 */
export function formatarExibicaoCodigoCupom(codigo: string): string {
  return formatarEntradaCodigoCupom(codigo);
}

/**
 * Entrada livre → `PRMF-XXXX-XXXX` quando dá para reconstituir.
 *
 * Quando não dá (comprimento diferente de 8 depois da limpeza), devolve
 * o texto apenas limpo, SEM inventar formato: a RPC responde
 * `nao_encontrado` e a tela já tem mensagem para isso. Melhor um "não
 * encontrado" honesto do que um código fabricado que casa com o cupom
 * de outra pessoa.
 *
 * Não corrige confusão de caractere (0↔O, 1↔I). O alfabeto exclui os
 * quatro, então um deles digitado é ambíguo por natureza — adivinhar
 * poderia validar o cupom errado.
 */
export function normalizarCodigoCupom(entrada: string): string {
  // toUpperCase (e não toLocaleUpperCase): insensível a locale — no
  // turco, "i".toLocaleUpperCase() vira "İ" e corromperia o código.
  let limpo = (entrada ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  while (limpo.startsWith(CODIGO_PREFIXO) && limpo.length > CODIGO_PREFIXO.length) {
    limpo = limpo.slice(CODIGO_PREFIXO.length);
  }
  if (limpo === CODIGO_PREFIXO) return "";

  if (limpo.length !== TAMANHO_SIGNIFICATIVO) {
    // Mantém o comportamento antigo: incompleto → limpeza crua sem inventar.
    return (entrada ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  return `${CODIGO_PREFIXO}-${limpo.slice(0, 4)}-${limpo.slice(4)}`;
}
