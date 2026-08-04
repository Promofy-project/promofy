/**
 * Suíte da Fase 8 — lado do estabelecimento.
 *
 * Asserções por PostgREST DIRETO, com sessão real de cada papel. O motivo é o
 * mesmo da migration 20: uma regra que só existe na Server Action é
 * contornável por quem fala HTTP, e o lojista fala.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase8");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const SENHA = "promofy123";
let passed = 0, failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main(): Promise<number> {
  const admin = await logar("admin@promofy.test");
  const dono = await logar("lojista@promofy.test");   // e1
  const outro = await logar("lojista2@promofy.test"); // e2

  const criados: string[] = [];

  try {
    // ============================================================
    console.log("\n[M1] Mural — publicação e alcance");
    // ============================================================
    const pubTodos = await admin
      .from("avisos")
      .insert({ titulo: "Aviso geral f8", corpo: "Vale para todos.", para_todos: true })
      .select("id")
      .single();
    check("admin publica aviso para TODOS", !pubTodos.error, pubTodos.error?.message);
    const idTodos = pubTodos.data?.id as string | undefined;
    if (idTodos) criados.push(idTodos);

    const pubE1 = await admin
      .from("avisos")
      .insert({ titulo: "Aviso só do e1 f8", corpo: "Direcionado.", para_todos: false })
      .select("id")
      .single();
    const idE1 = pubE1.data?.id as string | undefined;
    if (idE1) criados.push(idE1);
    if (idE1) {
      const d = await admin
        .from("avisos_destinatarios")
        .insert({ aviso_id: idE1, estabelecimento_id: "e1" });
      check("admin direciona o aviso ao e1", !d.error, d.error?.message);
    }

    const lojistaPublica = await dono
      .from("avisos")
      .insert({ titulo: "forjado", corpo: "x", para_todos: true })
      .select("id");
    check(
      "lojista NÃO publica aviso",
      Boolean(lojistaPublica.error) || (lojistaPublica.data ?? []).length === 0,
      "conseguiu publicar!",
    );

    const vistosDono = (await dono.from("avisos").select("id, titulo")).data ?? [];
    const vistosOutro = (await outro.from("avisos").select("id, titulo")).data ?? [];
    check("lojista do e1 vê o aviso GERAL", vistosDono.some((a) => a.id === idTodos));
    check("lojista do e1 vê o aviso DIRECIONADO a ele", vistosDono.some((a) => a.id === idE1));
    check("lojista2 vê o aviso geral", vistosOutro.some((a) => a.id === idTodos));
    check(
      "lojista2 NÃO vê o aviso direcionado só ao e1",
      !vistosOutro.some((a) => a.id === idE1),
      "vazou aviso de outro estabelecimento",
    );

    // A junção não pode virar um diretório de quem recebe o quê.
    const juncaoOutro = (await outro.from("avisos_destinatarios").select("*")).data ?? [];
    check(
      "lojista2 não enxerga a junção de destinatários do e1",
      !juncaoOutro.some((d: any) => d.estabelecimento_id === "e1"),
      `${juncaoOutro.length} linhas`,
    );

    // ============================================================
    console.log("\n[M1] Marcação de lido — só por RPC, só o próprio");
    // ============================================================
    const naoLidosAntes = (await dono.rpc("avisos_nao_lidos")).data as number;
    check("contagem de não-lidos vem > 0 antes de ler", (naoLidosAntes ?? 0) >= 2, String(naoLidosAntes));

    const escritaDireta = await dono
      .from("avisos_lidos")
      .insert({ aviso_id: idTodos, estabelecimento_id: "e1", lido_em: "2020-01-01T00:00:00Z" })
      .select("aviso_id");
    check(
      "lojista NÃO escreve direto em avisos_lidos (não forja lido_em)",
      Boolean(escritaDireta.error),
      escritaDireta.error?.message ?? "escreveu!",
    );

    const marcou = (await dono.rpc("marcar_aviso_lido", { p_aviso_id: idTodos })).data as any;
    check("RPC marca como lido", marcou?.ok === true, JSON.stringify(marcou));
    const remarcou = (await dono.rpc("marcar_aviso_lido", { p_aviso_id: idTodos })).data as any;
    check("marcar de novo é idempotente", remarcou?.ok === true, JSON.stringify(remarcou));

    const naoLidosDepois = (await dono.rpc("avisos_nao_lidos")).data as number;
    check(
      "contagem cai depois de ler",
      naoLidosDepois === naoLidosAntes - 1,
      `${naoLidosAntes} → ${naoLidosDepois}`,
    );

    const marcouAlheio = (await outro.rpc("marcar_aviso_lido", { p_aviso_id: idE1 })).data as any;
    check(
      "lojista2 NÃO marca como lido aviso que não é dele",
      marcouAlheio?.ok === false && marcouAlheio?.motivo === "nao_encontrado",
      JSON.stringify(marcouAlheio),
    );

    const lidosDoOutro = (await outro.from("avisos_lidos").select("*")).data ?? [];
    check(
      "lojista2 não lê as marcações do e1",
      !lidosDoOutro.some((l: any) => l.estabelecimento_id === "e1"),
      `${lidosDoOutro.length} linhas`,
    );

    const contagemAdmin = (await admin.from("avisos_lidos").select("*")).data ?? [];
    check("admin enxerga as leituras (para contar quem leu)", contagemAdmin.length >= 1, String(contagemAdmin.length));
  } finally {
    if (criados.length) {
      await svc.from("avisos").delete().in("id", criados);
      console.log(`\n[limpeza] ${criados.length} aviso(s) removido(s)`);
    }
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
