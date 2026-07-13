/**
 * Testes de RLS (Fase 1, adaptados na Fase 2) — roda contra o stack
 * local já seedado (`npm run db:reset` antes). Critério de aceite 4.
 *
 * Fase 2: escrita no ciclo do cupom SÓ via RPC security definer — as
 * asserções de escrita direta viraram NEGATIVAS (42501) e as positivas
 * usam as RPCs. Métricas são asseridas ANTES de qualquer mutação
 * (a ativação agora grava evento 'ativacao' e mudaria a contagem).
 *
 * Semântica do PostgREST usada nas asserções:
 * - UPDATE negado por POLICY (linha filtrada pelo USING) => sem erro,
 *   0 linhas — por isso encadeamos .select() e checamos data.length.
 * - Escrita negada por GRANT (tabela/coluna) => erro 42501.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRole) {
  console.error("Faltam variáveis no .env.local (ver .env.local.example).");
  process.exit(1);
}

const SENHA = "promofy123";
let passed = 0;
let failed = 0;

function check(nome: string, ok: boolean, detalhe = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${nome}`);
  } else {
    failed++;
    console.log(`  FAIL  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function novoClient(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function logar(email: string): Promise<SupabaseClient> {
  const c = novoClient();
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main() {
  const svc = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const anon = novoClient();

  console.log("\n[anon]");
  {
    const { data, error } = await anon.from("cupons").select("id,estabelecimento_id");
    check("anon lê cupons visíveis", !error && (data?.length ?? 0) > 0, error?.message);
    const idsEst = new Set((data ?? []).map((c) => c.estabelecimento_id));
    check(
      "anon NÃO vê cupons de estabelecimento pendente/suspenso (e4/e6)",
      !idsEst.has("e4") && !idsEst.has("e6"),
    );
    const portalOnly = (data ?? []).some(
      (c) => c.id === "p-campanha-esgotada" || c.id === "p-campanha-expirada",
    );
    check("anon NÃO vê campanhas esgotada/expirada", !portalOnly);
  }
  {
    const { data } = await anon.from("pontos_transacoes").select("id");
    check("anon NÃO lê pontos_transacoes", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await anon.from("profiles").select("id");
    check("anon NÃO lê profiles", (data?.length ?? 0) === 0);
  }
  {
    const { error } = await anon
      .from("cupons")
      .insert({ id: "hack", estabelecimento_id: "e1", titulo: "x", categoria_id: "pet", economia: 1, validade_fim: "2027-01-01" });
    check("anon NÃO insere cupom", !!error, "insert anônimo passou!");
  }

  // Métricas derivadas ANTES de qualquer mutação (Fase 2: ativar grava evento)
  console.log("\n[lojista — métricas pré-mutação]");
  const lojista = await logar("lojista@promofy.test");
  {
    const { data, error } = await lojista.from("cupom_metricas").select("*").eq("cupom_id", "c01").single();
    check(
      "lojista lê métricas derivadas do c01 (4820/1960/740/482)",
      !error &&
        Number(data?.visualizacoes) === 4820 &&
        Number(data?.cliques) === 1960 &&
        Number(data?.ativacoes) === 740 &&
        Number(data?.resgates) === 482,
      error?.message ?? JSON.stringify(data),
    );
  }
  {
    const { data } = await lojista.from("cupom_metricas").select("cupom_id").eq("cupom_id", "c03");
    check("lojista NÃO lê métricas de cupom alheio", (data?.length ?? 0) === 0);
  }

  console.log("\n[consumidor]");
  const consumidor = await logar("consumidor@promofy.test");
  const meuId = (await consumidor.auth.getUser()).data.user!.id;
  {
    const { data } = await consumidor.from("profiles").select("id,role");
    check("consumidor lê apenas o próprio profile", data?.length === 1 && data[0].id === meuId);
  }
  {
    // Escalação de role: grant de coluna deve negar com 42501.
    const { error } = await consumidor
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", meuId);
    check(
      "consumidor NÃO muda o próprio role (42501)",
      error?.code === "42501",
      `code=${error?.code ?? "sem erro"}`,
    );
    const { data } = await consumidor.from("profiles").select("role").eq("id", meuId).single();
    check("role permanece consumidor", data?.role === "consumidor");
  }
  {
    const { data, error } = await consumidor
      .from("profiles")
      .update({ cidade: "São Paulo, SP" })
      .eq("id", meuId)
      .select();
    check("consumidor atualiza campos permitidos do próprio profile", !error && data?.length === 1, error?.message);
  }
  {
    const { error } = await consumidor
      .from("avaliacoes")
      .insert({ usuario_id: meuId, usuario_nome: "Teste RLS", estabelecimento_id: "e1", rating: 5, comentario: "ok" });
    check("consumidor insere avaliação própria", !error, error?.message);
    const { error: err2 } = await consumidor
      .from("avaliacoes")
      .insert({ usuario_id: "00000000-0000-0000-0000-000000000001", usuario_nome: "Fake", estabelecimento_id: "e1", rating: 5 });
    check("consumidor NÃO insere avaliação como terceiro", !!err2);
  }
  {
    const { error } = await consumidor
      .from("cupom_eventos")
      .insert({ cupom_id: "c01", usuario_id: meuId, tipo: "validacao" });
    check("consumidor NÃO forja evento de validação", !!error, "insert de evento passou!");
  }
  {
    // Fase 2: ciclo SÓ via RPC — escrita direta agora é negada por grant.
    const { error: errIns } = await consumidor
      .from("cupons_usuario")
      .insert({ usuario_id: meuId, cupom_id: "c01" });
    check("consumidor NÃO insere cupons_usuario direto (42501)", errIns?.code === "42501", `code=${errIns?.code ?? "sem erro"}`);

    const { data: rpc, error: errRpc } = await consumidor.rpc("ativar_cupom", { p_cupom_id: "c01" });
    const estado = (rpc as { ok?: boolean; estado?: { codigo?: string } } | null)?.estado;
    check(
      "consumidor ativa cupom via RPC (código PRMF gerado)",
      !errRpc && (rpc as { ok?: boolean } | null)?.ok === true &&
        /^PRMF-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(estado?.codigo ?? ""),
      errRpc?.message ?? JSON.stringify(rpc),
    );

    const { error: errUpd } = await consumidor
      .from("cupons_usuario")
      .update({ status: "validado" })
      .eq("usuario_id", meuId)
      .eq("cupom_id", "c01");
    check("consumidor NÃO se auto-valida direto (42501)", errUpd?.code === "42501", `code=${errUpd?.code ?? "sem erro"}`);

    const { error: errNps } = await consumidor
      .from("cupons_usuario")
      .update({ nps: 9 })
      .eq("usuario_id", meuId)
      .eq("cupom_id", "c01");
    check("consumidor NÃO grava NPS direto (42501)", errNps?.code === "42501", `code=${errNps?.code ?? "sem erro"}`);

    // NPS via RPC exige cupom validado — regra de negócio no servidor.
    const { data: rowAtiva } = await consumidor
      .from("cupons_usuario")
      .select("id")
      .eq("usuario_id", meuId)
      .eq("cupom_id", "c01")
      .eq("status", "ativo")
      .single();
    const { data: npsRpc } = await consumidor.rpc("responder_nps", {
      p_row_id: rowAtiva?.id ?? -1,
      p_nota: 9,
    });
    check(
      "RPC responder_nps recusa cupom não validado (nao_validado)",
      (npsRpc as { ok?: boolean; motivo?: string } | null)?.motivo === "nao_validado",
      JSON.stringify(npsRpc),
    );
  }

  console.log("\n[lojista]");
  {
    const { data, error } = await lojista
      .from("cupons")
      .update({ beneficio: "2 rodízios pelo preço de 1" })
      .eq("id", "c01")
      .select();
    check("lojista edita cupom do próprio estabelecimento", !error && data?.length === 1, error?.message);
  }
  {
    const { data, error } = await lojista
      .from("cupons")
      .update({ beneficio: "hack" })
      .eq("id", "c05") // cupom do e3 (outro dono)
      .select();
    check("lojista NÃO edita cupom alheio (0 linhas)", !error && data?.length === 0, error?.message);
  }
  {
    const { error } = await lojista
      .from("estabelecimentos")
      .update({ status: "ativo" })
      .eq("id", "e1");
    check("lojista NÃO altera o próprio status (42501)", error?.code === "42501", `code=${error?.code ?? "sem erro"}`);
  }

  console.log("\n[admin]");
  const adminUser = await logar("admin@promofy.test");
  {
    const { data, error } = await adminUser.from("profiles").select("id");
    check("admin lê todos os profiles (>=3)", !error && (data?.length ?? 0) >= 3, error?.message);
  }
  {
    const { data, error } = await adminUser.from("estabelecimentos").select("id");
    check("admin lê todos os estabelecimentos (6)", !error && data?.length === 6, error?.message);
  }

  // Limpeza COMPLETA dos artefatos (service_role bypassa RLS) — inclui
  // eventos e pontos criados pelas RPCs, p/ não poluir test-fase2.
  await svc.from("avaliacoes").delete().eq("usuario_nome", "Teste RLS");
  await svc.from("cupons_usuario").delete().eq("usuario_id", meuId);
  await svc.from("cupom_eventos").delete().eq("usuario_id", meuId);
  await svc.from("pontos_transacoes").delete().eq("usuario_id", meuId).neq("acao", "bonus");
  await svc.from("profiles").update({ cidade: null }).eq("id", meuId);

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test-rls falhou:", err);
  process.exit(1);
});
