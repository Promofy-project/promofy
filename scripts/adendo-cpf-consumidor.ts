/**
 * Adendo 05/08 — CPF DE TESTE no perfil que o cliente usa na demo.
 *
 * O PEDIDO. O cliente quer testar a validação por identidade (Fase 8/V3) sem
 * inventar uma conta: um CPF sintético, com DV válido, no perfil de
 * `consumidor@promofy.test` — a conta que ele mostra.
 *
 * O QUE A MEDIÇÃO ACHOU (29/08, produção). O campo NÃO estava vazio:
 *
 *     nome: Lucas Orlandi
 *     cpf : "123.456.789-09"
 *
 * É um CPF sintético, com DV válido, guardado FORMATADO. E formatado funciona:
 * `buscar_ativacoes_por_cpf` compara
 * `regexp_replace(p.cpf,'\D','','g') = v_digitos` (migration 26:229) e
 * `mascarar_cpf` normaliza igual antes de mascarar (migration 6:33). Ou seja,
 * a premissa do pedido — "não há CPF para testar" — não se sustentou, e
 * gravar um número novo por cima trocaria um CPF de teste que já funciona por
 * outro, mexendo em dado do cliente sem ganho nenhum.
 *
 * POR ISSO ESTE SCRIPT NÃO ESCREVE NADA POR PADRÃO. Ele CONFERE — e só oferece
 * escrita quando o perfil está sem CPF ou com um CPF que o DV recusa, que é a
 * única situação em que o pedido original ainda faz sentido. É a regra do
 * CLAUDE.md §1: verifique a premissa antes de qualquer operação destrutiva.
 *
 * Uso:
 *   npx tsx scripts/adendo-cpf-consumidor.ts --hosted              (confere)
 *   npx tsx scripts/adendo-cpf-consumidor.ts --hosted --aplicar    (grava, se preciso)
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("adendo-cpf");

import { createClient } from "@supabase/supabase-js";
import {
  completarCpfComDv,
  cpfValido,
  formatarCpf,
  mascararCpf,
  somenteDigitos,
} from "../src/lib/cpf";

const EMAIL = "consumidor@promofy.test";

/**
 * O CPF que o perfil já carrega, escrito aqui por extenso para o script ser
 * legível sozinho. Se um dia o campo estiver vazio, é ESTE número que volta —
 * `123.456.789-09` é o CPF de exemplo mais conhecido do país, fácil de ditar
 * numa demo e impossível de confundir com o documento de uma pessoa. Os dois
 * dígitos saem de `completarCpfComDv`, a MESMA função do app: se a regra do
 * DV mudar, este número muda junto.
 */
const BASE9 = "123456789";

async function main(): Promise<number> {
  const aplicar = process.argv.includes("--aplicar");
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cpf = completarCpfComDv(BASE9);
  if (!cpfValido(cpf)) {
    console.error(`CPF sintético não passa na própria validação: ${cpf}`);
    return 1;
  }
  console.log(`CPF de referência: ${formatarCpf(cpf)}`);
  console.log(`Máscara esperada : ${mascararCpf(cpf)}\n`);

  // `auth.users` mora fora do PostgREST público — o e-mail vem da Admin API.
  const { data: lista, error: erroLista } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (erroLista) {
    console.error(`falha ao listar usuários: ${erroLista.message}`);
    return 1;
  }
  const user = lista.users.find((u) => u.email === EMAIL);
  if (!user) {
    console.error(`conta ${EMAIL} não existe neste alvo.`);
    return 1;
  }

  const { data: antes, error: erroAntes } = await svc
    .from("profiles").select("id, nome, cpf").eq("id", user.id).maybeSingle();
  if (erroAntes || !antes) {
    console.error(`falha ao ler o perfil: ${erroAntes?.message}`);
    return 1;
  }

  const guardado = (antes.cpf ?? null) as string | null;
  const digitos = somenteDigitos(guardado ?? "");
  console.log(`ANTES  ${EMAIL}`);
  console.log(`       nome: ${antes.nome}`);
  console.log(`       cpf : ${guardado === null ? "NULL" : JSON.stringify(guardado)}`);
  console.log(`       DV  : ${guardado === null ? "—" : cpfValido(guardado) ? "válido" : "INVÁLIDO"}`);
  console.log(`       busca do balcão compara por dígitos: ${digitos || "—"}\n`);

  // Ambiguidade: dois perfis com os mesmos dígitos tornariam a busca do balcão
  // indeterminada, e a resposta única da V3 esconderia exatamente isso.
  if (digitos.length === 11) {
    const { data: todos } = await svc.from("profiles").select("id, nome, cpf");
    const gemeos = (todos ?? []).filter(
      (p) => p.id !== user.id && somenteDigitos(String(p.cpf ?? "")) === digitos,
    );
    if (gemeos.length > 0) {
      console.error(`ATENÇÃO: outro(s) perfil(is) com os mesmos dígitos — ${gemeos.map((g) => g.nome).join(", ")}`);
      return 1;
    }
    console.log("Nenhum outro perfil usa estes dígitos — a busca é inequívoca.");
  }

  if (guardado !== null && cpfValido(guardado)) {
    console.log(
      "\nNADA A FAZER: o perfil já tem um CPF sintético com DV válido, e o formato\n" +
        "guardado não atrapalha — busca e máscara normalizam os dígitos no banco.\n" +
        "Escrever por cima seria mexer em dado do cliente sem ganho.",
    );
    return 0;
  }

  console.log("\nO perfil está sem CPF utilizável — é o caso previsto pelo pedido.");
  if (!aplicar) {
    console.log(`DRY-RUN — nada escrito. Com --aplicar, gravaria: ${cpf}`);
    return 0;
  }

  // Escrita mínima: uma coluna, uma linha, filtrada por id.
  const { error: erroUpdate } = await svc
    .from("profiles").update({ cpf }).eq("id", user.id);
  if (erroUpdate) {
    console.error(`falha ao gravar: ${erroUpdate.message}`);
    return 1;
  }

  const { data: depois } = await svc
    .from("profiles").select("id, nome, cpf").eq("id", user.id).maybeSingle();
  console.log(`DEPOIS nome: ${depois?.nome}`);
  console.log(`       cpf : ${depois?.cpf}`);
  const ok = depois?.cpf === cpf && depois?.nome === antes.nome;
  console.log(ok ? "\nOK — só o cpf mudou." : "\nATENÇÃO: o resultado não bate com o esperado.");
  return ok ? 0 : 1;
}

// `process.exit()` no meio do fluxo puliria blocos finally (CLAUDE.md §4):
// quem chama decide o código de saída.
main().then((c) => { process.exitCode = c; });
