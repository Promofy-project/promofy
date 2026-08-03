/**
 * Conta de consumo DESCARTÁVEL para as suítes — helper compartilhado.
 *
 * POR QUE ISTO EXISTE (dívida crítica registrada no FASE-5 §10.3)
 * As suítes logavam com e-mail LITERAL `consumidor@promofy.test` — uma conta
 * de DEMONSTRAÇÃO DO CLIENTE — e a limpeza do fim apagava por `usuario_id`,
 * não pelas linhas que o teste criou. Medido no hospedado, rodar
 * `test:rls:hosted` apagaria 3 linhas de `cupons_usuario`, 12 de
 * `cupom_eventos` e 4 de `pontos_transacoes` do `consumidor@`, derrubando o
 * saldo de 1.410 → 1.250. Destruição de dado do cliente, irreversível sem
 * restauração manual.
 *
 * A correção não é "limpar melhor": é a suíte NUNCA logar numa conta que o
 * cliente usa. Com uma conta criada e destruída pelo próprio teste, o escopo
 * da limpeza deixa de ser uma promessa e passa a ser uma consequência — não
 * existe dado alheio para apagar por engano.
 *
 * O QUE A CASCATA RESOLVE E O QUE NÃO RESOLVE
 * `auth.users → profiles` é `on delete cascade`, e de `profiles` descem em
 * cascata `cupons_usuario`, `pontos_transacoes`, `favoritos`,
 * `novidades_visto` e `assinaturas`. Mas `cupom_eventos.usuario_id` e
 * `avaliacoes.usuario_id` são **`on delete set null`**: apagar o usuário
 * deixaria um evento órfão inflando `cupom_metricas` do lojista e uma
 * avaliação anônima VISÍVEL no app. Por isso a ordem aqui é: apagar esses
 * dois por `usuario_id` ENQUANTO ele ainda existe, e só então o usuário.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Senha única das contas de teste (a mesma do seed-users). */
export const SENHA_QA = "promofy123";

export interface ContaQa {
  email: string;
  id: string;
  senha: string;
}

/** `qa-rls` → `qa-rls@promofy.test`. O prefixo `qa-` é a marca do descartável. */
export function emailQa(slug: string): string {
  return `qa-${slug}@promofy.test`;
}

/**
 * CPF fictício de 11 dígitos, determinístico por slug.
 *
 * Não é enfeite: `mascarar_cpf` devolve `'***'` para qualquer coisa que não
 * tenha 11 dígitos, e a Fase 2 assere o formato mascarado
 * (`123.***.***-09`) no retorno de `validar_cupom`. Uma conta sem CPF faria
 * essa asserção falhar por motivo errado. O form de cadastro do app coleta
 * CPF, então a conta de teste nasce como um usuário real nasceria.
 *
 * Determinístico por slug para que duas contas da mesma suíte não se
 * confundam no diagnóstico de uma falha.
 */
export function cpfQa(slug: string): string {
  let n = 7;
  for (const ch of slug) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const d = String(n).padStart(11, "0").slice(-11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

async function acharPorEmail(
  svc: SupabaseClient,
  email: string,
): Promise<string | null> {
  // base de teste é pequena; paginação simples basta (mesmo padrão do seed-users)
  const { data, error } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

/**
 * Cria (ou recria) a conta `qa-<slug>@promofy.test`, sempre do zero.
 *
 * Recriar em vez de reaproveitar é de propósito: uma corrida anterior que
 * morreu no meio deixaria estado (cupom ativo, pontos, favoritos) que faria
 * a suíte seguinte passar ou falhar por motivo errado. `app_metadata` vazio
 * — papel consumidor, como qualquer usuário que se cadastra no app.
 *
 * `bonus` semeia o ledger quando a suíte precisa de saldo inicial; por
 * padrão a conta nasce zerada, que é o estado de um usuário real.
 */
export async function criarContaQa(
  svc: SupabaseClient,
  slug: string,
  opts: { nome?: string; cpf?: string; bonus?: number } = {},
): Promise<ContaQa> {
  const email = emailQa(slug);

  const residuo = await acharPorEmail(svc, email);
  if (residuo) await destruirContaQa(svc, residuo);

  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: SENHA_QA,
    email_confirm: true,
    app_metadata: {},
    user_metadata: { nome: opts.nome ?? `QA ${slug}` },
  });
  if (error) throw new Error(`criarContaQa(${slug}): ${error.message}`);
  const id = data.user.id;

  // O GoTrue insere o usuário (disparando handle_new_user) antes de mesclar
  // metadata; o CPF entra depois, via service_role — é o que `mascarar_cpf`
  // precisa ter para mascarar.
  {
    const { error: errCpf } = await svc
      .from("profiles")
      .update({ cpf: opts.cpf ?? cpfQa(slug) })
      .eq("id", id);
    if (errCpf) throw new Error(`criarContaQa(${slug}) cpf: ${errCpf.message}`);
  }

  if (opts.bonus && opts.bonus > 0) {
    const { error: errBonus } = await svc.from("pontos_transacoes").insert({
      usuario_id: id,
      acao: "bonus",
      pontos: opts.bonus,
      referencia_id: `bonus:${id}`,
    });
    if (errBonus) throw new Error(`criarContaQa(${slug}) bonus: ${errBonus.message}`);
  }

  return { email, id, senha: SENHA_QA };
}

/**
 * Destrói a conta e tudo que ela criou.
 *
 * Nunca lança: roda em `finally` e não pode mascarar a falha real da suíte —
 * mas o erro fica VISÍVEL no console, porque uma conta pendurada no
 * hospedado é exatamente o que esta fase existe para evitar.
 */
export async function destruirContaQa(
  svc: SupabaseClient,
  id: string | null | undefined,
): Promise<void> {
  if (!id) return;
  try {
    // ANTES do delete: as duas FKs `set null` deixariam órfãos.
    await svc.from("cupom_eventos").delete().eq("usuario_id", id);
    await svc.from("avaliacoes").delete().eq("usuario_id", id);
    // O resto desce em cascata a partir de profiles.
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.error(`  !! destruirContaQa(${id}): ${error.message}`);
  } catch (err) {
    console.error(`  !! destruirContaQa(${id}):`, err);
  }
}

/**
 * Encerra a suíte devolvendo o código de saída.
 *
 * ARMADILHA QUE ISTO EVITA: `process.exit()` **não executa blocos `finally`**.
 * Todas as suítes chamavam `process.exit(...)` DENTRO de `main()`; pôr a
 * destruição da conta num `finally` que envolve o corpo de `main` não rodaria
 * no caminho de sucesso — a conta `qa-*` ficaria pendurada justamente no
 * ambiente que a fase existe para proteger. Com isto, `main()` devolve o
 * código e quem sai é o chamador, depois de o `finally` ter rodado.
 */
export function encerrar(passed: number, failed: number): number {
  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
  return failed > 0 ? 1 : 0;
}
