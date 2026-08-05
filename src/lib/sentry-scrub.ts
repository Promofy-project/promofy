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
 *  - **Senha e token de sessão** — ver abaixo; entraram na Fase 8.
 *
 * SENHA: POR QUE ELA PRECISA DE OUTRO MECANISMO
 *
 * CPF, e-mail e código têm FORMATO — dá para achá-los no meio de um texto. Uma
 * senha não tem: `promofy123` é indistinguível de qualquer outra palavra. Então
 * a barreira aqui não é por valor, é por **nome de chave** — `{ senha: ... }`
 * vira `[redigido]` sem olhar o conteúdo — mais o caso de **query string**,
 * que é o formato em que a senha de fato vazava.
 *
 * O gatilho foi a Fase 8: os cinco formulários passaram a submeter por Server
 * Action, então a senha agora **atravessa o servidor Next**, onde antes ia
 * direto do navegador para o GoTrue. Um erro com o `FormData` anexado passaria
 * a poder levá-la junto.
 *
 * E o caso de query string não é hipotético: até este deploy, produção ainda
 * serve os formulários que degradam para `GET /admin/login?email=…&senha=…`.
 * Essa URL chega ao Sentry por breadcrumb de navegação ou por `request.url`.
 *
 * TOKEN DE SESSÃO junto, pelo mesmo argumento do código de cupom: um
 * `access_token` do Supabase é credencial ao portador, e vale mais que um
 * cupom — objetos de sessão são serializados dentro de erros com frequência.
 *
 * Módulo puro: sem DOM, sem `server-only`. Roda nos três runtimes (browser,
 * node, edge) e é testável sem subir nada.
 */

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// O código real é PRMF-XXXX-XXXX, mas a versão sem hífen é aceita em /e/validar
// desde a Fase 5 — se a UI aceita as duas formas, as duas podem vazar.
const CODIGO_CUPOM = /\bPRMF-?[A-Z0-9]{4}-?[A-Z0-9]{4}\b/g;

/** Nomes de campo cujo VALOR é segredo, qualquer que seja o conteúdo. */
const CHAVE_SECRETA =
  /^(senha|nova[-_]?senha|password|passwd|pwd|current[-_]password|new[-_]password|access[-_]?token|refresh[-_]?token|authorization)$/i;

/**
 * Segredo em par chave=valor dentro de uma string (query string ou corpo de
 * formulário urlencoded). `(^|[?&])` cobre tanto `?senha=x` quanto um corpo
 * que começa direto em `senha=x`.
 */
const PAR_SECRETO = new RegExp(
  "(^|[?&])(senha|password|passwd|pwd|access_token|refresh_token)=[^&\\s\"'#]*",
  "gi",
);

export const REDIGIDO = "[redigido]";

/** Substitui ocorrências numa string solta. */
export function limparTexto(texto: string): string {
  return texto
    .replace(CPF, "[cpf]")
    .replace(EMAIL, "[email]")
    .replace(CODIGO_CUPOM, "[codigo-cupom]")
    .replace(PAR_SECRETO, (_todo, antes: string, chave: string) => `${antes}${chave}=${REDIGIDO}`);
}

/** A chave carrega segredo? Exportada para a suíte poder afirmar a lista. */
export function chaveSecreta(chave: string): boolean {
  return CHAVE_SECRETA.test(chave);
}

/**
 * Varredura recursiva. Profundidade limitada de propósito: um evento do Sentry
 * pode conter referência cíclica (window, request), e uma recursão sem teto
 * dentro do `beforeSend` derruba o processo que ela deveria estar observando.
 */
function limparValor(valor: unknown, profundidade: number): unknown {
  // No teto, string ainda passa pelo filtro de padrão: parar de descer não é
  // motivo para devolver um CPF cru. O que fica de fora é objeto além do
  // nível 8 — a redação por chave acontece no laço do PAI, então uma `senha`
  // só escapa se estiver aninhada mais fundo que isso.
  if (profundidade > 8) {
    return typeof valor === "string" ? limparTexto(valor) : valor;
  }
  if (typeof valor === "string") return limparTexto(valor);
  if (Array.isArray(valor)) {
    return valor.map((v) => limparValor(v, profundidade + 1));
  }
  if (valor && typeof valor === "object") {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(entrada)) {
      // Chave secreta é redigida INTEIRA, sem descer: o valor pode ser string,
      // objeto ou array, e nenhum formato dele é seguro de inspecionar.
      saida[chave] = chaveSecreta(chave)
        ? REDIGIDO
        : limparValor(entrada[chave], profundidade + 1);
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
