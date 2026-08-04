/**
 * CPF: dígito verificador, máscara e normalização (Fase 8/V2).
 *
 * Módulo PURO — sem DOM, sem `server-only`, sem `Intl`. O app nativo herda a
 * mesma validação sem uma linha de mudança, e é isso que garante que balcão
 * web e balcão nativo recusem exatamente as mesmas entradas.
 *
 * POR QUE O DV É BARREIRA, E NÃO ENFEITE
 *
 * A busca por CPF é o único caminho do produto em que o lojista digita um
 * identificador de outra pessoa. Validar o dígito ANTES de consultar corta a
 * maior parte de qualquer tentativa de varredura sem que ela chegue ao banco:
 * de 10^11 sequências de 11 dígitos, só ~1% tem DV coerente.
 *
 * Isto NÃO é a defesa principal — é a primeira. A defesa é a resposta única
 * (sem oráculo) somada ao rate limit, ambas no servidor.
 */

/** Só os dígitos. Aceita "123.456.789-09" e "12345678909". */
export function somenteDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

function digitoVerificador(digitos: string, peso: number): number {
  let soma = 0;
  for (let i = 0; i < peso - 1; i++) {
    soma += Number(digitos[i]) * (peso - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/**
 * `true` só para CPF com 11 dígitos e os DOIS dígitos verificadores corretos.
 *
 * Sequências repetidas (`00000000000`, `11111111111`, …) são recusadas
 * explicitamente: elas passam na conta do DV, mas não são CPFs válidos — é a
 * pegadinha clássica de quem implementa só a fórmula.
 */
export function cpfValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return (
    digitoVerificador(d, 10) === Number(d[9]) &&
    digitoVerificador(d, 11) === Number(d[10])
  );
}

/** "123.456.789-09" — para o campo de digitação. Parcial durante a digitação. */
export function formatarCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * "123.***.***-09" — espelha `public.mascarar_cpf` do banco (Fase 2).
 *
 * Existe aqui para o app nativo e para testes; no fluxo real quem mascara é o
 * banco, dentro da RPC. Duas implementações da mesma regra divergem se uma
 * mudar sozinha — por isso a forma é idêntica, e o teste compara as duas.
 */
export function mascararCpf(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return "***";
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

/**
 * Gera um CPF com DV válido a partir de 9 dígitos base — para FIXTURES.
 *
 * Não é "gerador de CPF": é o completador dos dois dígitos, usado pelas
 * suítes. Sem isto, `cpfQa` produziria 11 dígitos que o DV recusa, e o
 * caminho feliz da busca por CPF ficaria intestável.
 */
export function completarCpfComDv(base9: string): string {
  let d = somenteDigitos(base9).padStart(9, "0").slice(0, 9);
  // Sequência repetida não vira CPF válido nem com DV correto — desvia.
  if (/^(\d)\1{8}$/.test(d)) d = d.slice(0, 8) + String((Number(d[8]) + 1) % 10);
  const d1 = digitoVerificador(d, 10);
  const d2 = digitoVerificador(d + String(d1), 11);
  return `${d}${d1}${d2}`;
}
