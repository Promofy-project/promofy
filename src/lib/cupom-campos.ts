/**
 * Vocabulário dos campos multivalorados do cupom (Fase 6): taxas
 * aplicáveis e formas de consumo.
 *
 * FONTE ÚNICA. As colunas são `jsonb` sem CHECK de domínio — decisão
 * deliberada da migration 16, pelo mesmo motivo que `horarios` não tem
 * CHECK desde a Fase 5: restringir jsonb no banco transforma dado sujo
 * em EXCEÇÃO, e exceção dentro de uma `security definer` sem bloco
 * `exception` vira 500 e deixa o cupom inativável. Quem garante o
 * vocabulário é este módulo, chamado NO SERVIDOR antes de gravar.
 *
 * Consequência que precisa ficar dita: valor fora da whitelist é
 * DESCARTADO na escrita e IGNORADO na leitura — nunca quebra a tela.
 * Se um dia alguém gravar `["entrega","xpto"]` direto via PostgREST (o
 * lojista tem grant de UPDATE nestas colunas), a folha do cupom mostra
 * "entrega" e esquece "xpto".
 *
 * Módulo puro: sem "server-only", sem DOM, sem Intl, sem
 * `toLocaleString`. Import relativo em quem depender dele, pelo mesmo
 * motivo de ./janela — esta camada é copiada tal e qual para o app
 * nativo e não pode depender do alias de path do tsconfig do Next.
 */

// ---------------------------------------------------------------
// TAXAS — as que NÃO estão cobertas pelo benefício.
// O consumidor lê "Não inclui: entrega e serviço". A leitura oposta
// ("o que o cupom cobre") foi descartada com o usuário: o que evita
// discussão no balcão é o consumidor saber o que ele ainda vai pagar.
// ---------------------------------------------------------------
export const TAXAS = [
  { id: "entrega", label: "Taxa de entrega" },
  { id: "embalagem", label: "Taxa de embalagem" },
  { id: "servico", label: "Taxa de serviço" },
] as const;

export type TaxaId = (typeof TAXAS)[number]["id"];

// ---------------------------------------------------------------
// FORMAS DE CONSUMO — onde o cupom vale.
// Vazio = não informado (a UI omite a linha em vez de inventar
// "todas"; prometer delivery num cupom que só vale no local seria pior
// do que não dizer nada).
// ---------------------------------------------------------------
export const FORMAS_CONSUMO = [
  { id: "local", label: "No local" },
  { id: "delivery", label: "Delivery" },
  { id: "retirada", label: "Retirada" },
] as const;

export type FormaConsumoId = (typeof FORMAS_CONSUMO)[number]["id"];

/** Prazo mínimo de ativação, em horas (espelha o CHECK da migration 16). */
export const PRAZO_ATIVACAO_MIN_HORAS = 5;

function sanear<T extends string>(
  valor: unknown,
  validos: readonly { id: T }[],
): T[] {
  if (!Array.isArray(valor)) return [];
  const conhecidos = new Set<string>(validos.map((v) => v.id));
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const item of valor) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!conhecidos.has(id) || vistos.has(id)) continue;
    vistos.add(id);
    saida.push(id as T);
  }
  // ordem canônica (a do vocabulário), não a de digitação — duas telas
  // que mostram o mesmo cupom não podem listar em ordens diferentes
  return validos.map((v) => v.id).filter((id) => saida.includes(id)) as T[];
}

/** jsonb/entrada do form → ids de taxa válidos, sem repetição, na ordem canônica. */
export function sanearTaxas(valor: unknown): TaxaId[] {
  return sanear<TaxaId>(valor, TAXAS);
}

/** jsonb/entrada do form → ids de forma de consumo válidos. */
export function sanearFormasConsumo(valor: unknown): FormaConsumoId[] {
  return sanear<FormaConsumoId>(valor, FORMAS_CONSUMO);
}

/** Rótulos legíveis, na ordem canônica. */
export function rotulosTaxas(ids: readonly string[]): string[] {
  return TAXAS.filter((t) => ids.includes(t.id)).map((t) => t.label);
}

export function rotulosFormasConsumo(ids: readonly string[]): string[] {
  return FORMAS_CONSUMO.filter((f) => ids.includes(f.id)).map((f) => f.label);
}

/**
 * "Taxa de entrega e taxa de serviço" — junção em português, com "e"
 * antes do último. Sem `Intl.ListFormat`: o Hermes do React Native pode
 * não trazer, e a Fase 5 já registrou o `Intl` como a dependência mais
 * frágil desta camada. Duas palavras não justificam o risco.
 */
export function listarPtBr(itens: readonly string[]): string {
  if (itens.length === 0) return "";
  if (itens.length === 1) return itens[0];
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * Rótulo da economia: "R$ 45,00" ou "a partir de R$ 45,00" (Fase 6/C3).
 *
 * Recebe o valor JÁ FORMATADO de propósito — a formatação de moeda vive
 * em src/lib/utils e usa `Intl`, que a Fase 5 registrou como a
 * dependência mais frágil no Hermes. O que este módulo decide é a COPY,
 * que é o mesmo texto em quatro telas (card, lista, detalhe e folha) e
 * não pode divergir entre elas.
 */
export function rotuloEconomia(valorFormatado: string, variavel?: boolean): string {
  return variavel ? `a partir de ${valorFormatado}` : valorFormatado;
}

/**
 * Regras a EXIBIR, sem repetir o benefício (Fase 6.5/EXTRA).
 *
 * Desde a Fase 2 a `criarCupomAction` copiava o benefício para `regras`
 * (`regras: [beneficio]`), e a tela de detalhe concatenava os dois — o
 * texto aparecia duas vezes. A action parou de copiar, mas os cupons já
 * gravados continuam com a duplicata no banco, e não vale uma migration de
 * dados para isso: a deduplicação acontece na EXIBIÇÃO.
 *
 * Compara normalizado (trim + minúsculas) porque a cópia antiga passava
 * pelo `.trim()` da action e pode divergir do benefício por espaços.
 */
export function regrasParaExibir(
  regras: readonly string[] | undefined,
  beneficio: string | undefined,
): string[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const alvo = norm(beneficio ?? "");
  return (regras ?? [])
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && (alvo === "" || norm(r) !== alvo));
}

/**
 * Prazo de ativação saneado: inteiro, nunca abaixo do mínimo.
 *
 * O mínimo de 5h é regra de negócio (o consumidor precisa de tempo para
 * chegar ao balcão) e vive em TRÊS lugares de propósito: aqui (para o
 * form avisar antes de enviar), na Server Action (barreira real do
 * caminho da aplicação) e no CHECK da coluna (barreira do PostgREST
 * direto, já que `prazo_ativacao_horas` está no grant do lojista).
 */
export function sanearPrazoAtivacao(valor: unknown): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n)) return PRAZO_ATIVACAO_MIN_HORAS;
  return Math.max(PRAZO_ATIVACAO_MIN_HORAS, n);
}

/**
 * Limite (por usuário ou total) saneado: inteiro ≥ 1, ou `null` para
 * ilimitado. `null` é o vocabulário do banco nas DUAS colunas desde a
 * migration 16 — nada de sentinela (-1, 0, 999999), que obrigaria cada
 * leitor a conhecer o número mágico.
 */
export function sanearLimite(valor: unknown, ilimitado: boolean): number | null {
  if (ilimitado) return null;
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}
