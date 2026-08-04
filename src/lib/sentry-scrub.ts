/**
 * Remoção de dado pessoal ANTES de o evento sair da máquina (Fase 7/P5).
 *
 * O Sentry é um terceiro. Tudo que sai daqui sai do nosso controle — então a
 * regra é a mesma do resto do projeto: a barreira não pode ser "tomar cuidado
 * ao escrever mensagem de erro". Um CPF chega num evento por caminhos que
 * ninguém previu (uma mensagem do Postgres que ecoa o valor rejeitado, um
 * breadcrumb de navegação com querystring, o `message` de um `throw` alheio).
 * Por isso a limpeza é uma varredura recursiva sobre o evento inteiro, não uma
 * lista de campos conhecidos.
 *
 * O QUE É REMOVIDO, E POR QUÊ
 *
 *  - **CPF** — dado pessoal sensível (LGPD). Aparece mascarado na tela do
 *    balcão, mas o valor cheio existe em `profiles.cpf` e transita nas RPCs.
 *  - **E-mail** — identifica o usuário diretamente.
 *  - **Código de cupom** (`PRMF-XXXX-XXXX`) — não é PII, é pior: é uma
 *    **credencial ao portador**. Quem tem o código valida o cupom no balcão.
 *    Um código vazado num relatório de erro é um resgate roubado.
 *
 * Módulo puro: sem DOM, sem `server-only`. Roda nos três runtimes (browser,
 * node, edge) e é testável sem subir nada.
 */

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// O código real é PRMF-XXXX-XXXX, mas a versão sem hífen é aceita em /e/validar
// desde a Fase 5 — se a UI aceita as duas formas, as duas podem vazar.
const CODIGO_CUPOM = /\bPRMF-?[A-Z0-9]{4}-?[A-Z0-9]{4}\b/g;

/** Substitui ocorrências numa string solta. */
export function limparTexto(texto: string): string {
  return texto
    .replace(CPF, "[cpf]")
    .replace(EMAIL, "[email]")
    .replace(CODIGO_CUPOM, "[codigo-cupom]");
}

/**
 * Varredura recursiva. Profundidade limitada de propósito: um evento do Sentry
 * pode conter referência cíclica (window, request), e uma recursão sem teto
 * dentro do `beforeSend` derruba o processo que ela deveria estar observando.
 */
function limparValor(valor: unknown, profundidade: number): unknown {
  if (profundidade > 8) return valor;
  if (typeof valor === "string") return limparTexto(valor);
  if (Array.isArray(valor)) {
    return valor.map((v) => limparValor(v, profundidade + 1));
  }
  if (valor && typeof valor === "object") {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(entrada)) {
      saida[chave] = limparValor(entrada[chave], profundidade + 1);
    }
    return saida;
  }
  return valor;
}

/**
 * `beforeSend` do Sentry. Nunca lança: se a limpeza falhar por qualquer razão,
 * **descarta o evento** em vez de mandá-lo sujo. Perder um relatório de erro é
 * barato; vazar um CPF não é.
 */
export function limparEvento<T>(evento: T): T | null {
  try {
    return limparValor(evento, 0) as T;
  } catch {
    return null;
  }
}
