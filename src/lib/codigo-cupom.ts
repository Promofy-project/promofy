/**
 * Código do cupom — formato canônico e normalização da entrada.
 *
 * O banco gera e ARMAZENA sempre `PRMF-XXXX-XXXX` (alfabeto de 32
 * caracteres sem 0/O/1/I — ver `gerar_codigo_cupom` em
 * 20260713014516_funcoes_triggers.sql), e `validar_cupom` compara o
 * código EXATO. Nada disso muda: o que muda é a tolerância da entrada.
 *
 * No balcão, quem digita não quer caçar hífen no teclado do celular.
 * Esta função aceita `PRMF-KK8P-8U6Q`, `prmf kk8p 8u6q`, `KK8P8U6Q` e
 * `kk8p-8u6q`, e reconstitui o formato canônico antes da RPC.
 *
 * Módulo puro: sem "server-only", sem DOM. Reaproveitável como está no
 * app React Native (é lá que digitar sem hífen mais importa).
 */

/** Formato exato gravado no banco. */
export const CODIGO_PREFIXO = "PRMF";

/** 8 caracteres significativos, em dois blocos de 4. */
const TAMANHO_SIGNIFICATIVO = 8;

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
  const limpo = (entrada ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const semPrefixo = limpo.startsWith(CODIGO_PREFIXO)
    ? limpo.slice(CODIGO_PREFIXO.length)
    : limpo;

  if (semPrefixo.length !== TAMANHO_SIGNIFICATIVO) return limpo;

  return `${CODIGO_PREFIXO}-${semPrefixo.slice(0, 4)}-${semPrefixo.slice(4)}`;
}
