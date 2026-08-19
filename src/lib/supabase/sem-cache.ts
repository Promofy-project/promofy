/**
 * Fetch que NUNCA passa pelo Data Cache do Next.js — Fase 9/D2.
 *
 * O DIAGNÓSTICO POR TRÁS DISTO:
 *
 * `entrarAdminAction` e `entrarPortalAction` fazem a MESMA sequência:
 * `signInWithPassword` (POST, nunca cacheado) seguido de
 * `profiles.select("role").eq("id", uid)` — que o PostgREST resolve como um
 * GET. Medido em produção: essa mesma consulta, batida direto na API do
 * Supabase (sem passar pelo runtime do Next), respondia sempre abaixo de
 * 200ms e sempre com o papel correto. Passando pela Server Action, o login
 * do admin ficava preso em "Entrando…" por 45–100s e, ao finalmente
 * responder, por vezes devolvia "Esta conta não tem acesso a esta área." —
 * para a MESMA conta cujo `profiles.role` é `'admin'`, confirmado por leitura
 * direta no instante seguinte.
 *
 * O Next 14 App Router intercepta o `fetch` global e, por padrão, um GET com
 * cabeçalho `Authorization` só vira automaticamente "no cache" quando o
 * `staticGenerationStore` já está com `revalidate = 0` — uma condição que
 * depende de COMO o restante da árvore de render marcou a rota como dinâmica,
 * não de decisão explícita desta chamada. Sem essa garantia, o GET do
 * PostgREST é candidato ao Cache de Dados do Next: uma resposta cacheada uma
 * única vez — inclusive uma capturada num instante anômalo — voltaria a ser
 * servida em TODA consulta seguinte com a MESMA URL, indefinidamente, porque
 * `id=eq.<uid-fixo>` é sempre a mesma URL para a mesma conta. É exatamente o
 * padrão do sintoma: uma conta de teste, testada repetidas vezes, sempre pela
 * mesma URL.
 *
 * A correção não depende de acertar o mecanismo exato: `cache: "no-store"`
 * tira TODA chamada do Supabase (Auth e PostgREST) da cobertura do Data Cache,
 * sem exceção e sem depender de heurística. Isso é estritamente mais correto
 * — nenhuma tela deste app quer um dado de sessão/RLS potencialmente velho —
 * e todas as páginas que leem por este client já se declaram
 * `dynamic = "force-dynamic"`, então não há cache legítimo sendo perdido.
 */
export function semCacheDoNext(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}
