/**
 * Suíte da Fase 9 — Onda D2 (estabilização pós-D1).
 *
 * D2 nasceu de um achado em produção durante o smoke da D1: o login do
 * Admin ficava preso em "Entrando…" por 45–100s e, ao responder, às vezes
 * REJEITAVA a própria conta admin ("Esta conta não tem acesso a esta
 * área."), mesmo com `profiles.role = 'admin'` confirmado por leitura direta
 * no instante seguinte. Medido: a MESMA consulta
 * (`profiles.select("role").eq("id", uid)`), batida direto na API do
 * Supabase, respondia sempre abaixo de 200ms e sempre correta.
 *
 * A causa mais provável: o Next 14 App Router intercepta o `fetch` global e,
 * por padrão, um GET com cabeçalho `Authorization` só vira "no cache"
 * automaticamente quando o resto da árvore de render já marcou a rota como
 * dinâmica — uma condição que não é garantida por chamada. Sem isso, o GET
 * do PostgREST é candidato ao Cache de Dados do Next: uma resposta cacheada
 * uma única vez — inclusive uma capturada num instante anômalo — voltaria a
 * ser servida em toda consulta seguinte com a MESMA URL, indefinidamente.
 * `id=eq.<uid-fixo>` É sempre a mesma URL para a mesma conta — e é
 * exatamente o padrão do sintoma: uma conta de teste, testada repetidas
 * vezes, sempre pela mesma URL.
 *
 * IMPORTANTE — LIMITE HONESTO DESTA SUÍTE: o bug vive na interação entre o
 * runtime do Next.js (patch do `fetch` global, Data Cache) e o Vercel. Um
 * script Node batendo direto no Supabase NUNCA passa por esse runtime, então
 * NENHUM teste aqui consegue reproduzir o sintoma original — só provar (a) a
 * propriedade estática do fix (`cache: "no-store"` é sempre aplicado,
 * incondicionalmente) e (b) que os dados/RLS por trás continuam corretos. A
 * prova de que o sintoma sumiu É o smoke da preview (ETAPA 11), não esta
 * suíte.
 *
 * Conta `qa-*` efêmera para o que escreve. `consumidor@`/`convidado@` nunca
 * tocados. `admin@`/`lojista@`/`lojista2@` só em LEITURA (mesmo padrão já
 * usado pelas suítes anteriores desta fase).
 */
import { readFileSync } from "node:fs";

import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase9d2");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import { semCacheDoNext } from "../src/lib/supabase/sem-cache";

let passed = 0, failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string, senha = "promofy123"): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

function fonteSemComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

async function main(): Promise<number> {
  // ============================================================
  console.log("\n[D2-A] semCacheDoNext — o fix em si (função pura)");
  // ============================================================
  {
    const chamadas: [unknown, RequestInit | undefined][] = [];
    const fetchFalso = ((input: unknown, init?: RequestInit) => {
      chamadas.push([input, init]);
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch;
    const global_ = globalThis as { fetch: typeof fetch };
    const original = global_.fetch;
    global_.fetch = fetchFalso;
    try {
      await semCacheDoNext("https://exemplo.test/rest/v1/profiles");
      await semCacheDoNext("https://exemplo.test/rest/v1/profiles", { method: "GET" });
      await semCacheDoNext("https://exemplo.test/rest/v1/profiles", {
        method: "GET",
        headers: { Authorization: "Bearer x" },
        cache: "force-cache", // um valor pré-existente NÃO deve sobreviver
      });
    } finally {
      global_.fetch = original;
    }
    check("D2: sem init nenhum, ainda assim aplica no-store",
      chamadas[0][1]?.cache === "no-store");
    check("D2: com init parcial, preserva o resto E aplica no-store",
      chamadas[1][1]?.method === "GET" && chamadas[1][1]?.cache === "no-store");
    check("D2: um cache PRÉ-EXISTENTE no init é SOBRESCRITO para no-store",
      chamadas[2][1]?.cache === "no-store", String(chamadas[2][1]?.cache));
    check("D2: …e os demais campos desse init sobrevivem (headers preservados)",
      (chamadas[2][1]?.headers as Record<string, string> | undefined)?.Authorization === "Bearer x");
  }

  // ============================================================
  console.log("\n[D2-B] O fix está de fato ligado nos dois clients server-side");
  // ============================================================
  {
    const fonteServer = fonteSemComentarios("src/lib/supabase/server.ts");
    check("D2: createClient() (Server Actions/Components) usa semCacheDoNext",
      /global:\s*\{\s*fetch:\s*semCacheDoNext\s*\}/.test(fonteServer));

    const fonteMiddleware = fonteSemComentarios("src/lib/supabase/middleware.ts");
    check("D2: updateSession() (middleware) também usa semCacheDoNext",
      /global:\s*\{\s*fetch:\s*semCacheDoNext\s*\}/.test(fonteMiddleware));
    check("D2: …e o getClaims() continua logo após o createServerClient (regra de ouro do @supabase/ssr)",
      /createServerClient[\s\S]*?getClaims\(\)/.test(fonteMiddleware));
  }

  // ============================================================
  console.log("\n[D2-C] Papel do usuário — dado por trás do login continua correto");
  // ============================================================
  // Não reproduz o bug (ele é do runtime do Next, ver cabeçalho) — reconfirma
  // que a AUTORIDADE dos dados (o que a Server Action leria) nunca foi
  // ambígua, então qualquer leitura fresca (com o fix) devolve o certo.
  {
    const admin = await logar("admin@promofy.test");
    const { data: uAdmin } = await admin.auth.getUser();
    const { data: pAdmin } = await admin
      .from("profiles").select("role").eq("id", uAdmin.user!.id).maybeSingle();
    check("D2: profiles.role do admin@ é 'admin'", pAdmin?.role === "admin", String(pAdmin?.role));

    const lojista = await logar("lojista@promofy.test");
    const { data: uLoj } = await lojista.auth.getUser();
    const { data: pLoj } = await lojista
      .from("profiles").select("role").eq("id", uLoj.user!.id).maybeSingle();
    check("D2: profiles.role do lojista@ é 'lojista', não 'admin'",
      pLoj?.role === "lojista", String(pLoj?.role));

    // A MESMA url (profiles?...id=eq.<uid-do-admin>) batida de novo — o
    // padrão exato do sintoma (mesma URL, testada repetidas vezes).
    const { data: pAdmin2 } = await admin
      .from("profiles").select("role").eq("id", uAdmin.user!.id).maybeSingle();
    check("D2: repetir a MESMA consulta do admin continua 'admin' (sem deriva)",
      pAdmin2?.role === "admin", String(pAdmin2?.role));

    check("D2: credencial errada é rejeitada pelo GoTrue",
      await (async () => {
        const c = createClient(alvo.url, alvo.anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error } = await c.auth.signInWithPassword({ email: "admin@promofy.test", password: "senha-errada-de-proposito" });
        return Boolean(error);
      })());
  }

  // ============================================================
  console.log("\n[D2-D] Admin: status 'excluido' não some no fallback visual");
  // ============================================================
  {
    const fonteAdmin = fonteSemComentarios("src/app/admin/(painel)/cupons/cupons-client.tsx");
    check("D2: o mapa STATUS do admin tem entrada própria para 'excluido'",
      /excluido:\s*\{[^}]*label:\s*"Exclu[íi]do"/.test(fonteAdmin));
    check("D2: …e ela não usa a cor de sucesso (não é 'Ativo' disfarçado)",
      !/excluido:\s*\{\s*variant:\s*"success"/.test(fonteAdmin));
  }

  // ============================================================
  console.log("\n[D2-E] Aviso de prorrogação — só no contexto certo");
  // ============================================================
  {
    // JSX quebra o texto em várias linhas — compara por trecho, tolerando
    // espaço/quebra de linha entre palavras (não a string inteira de uma vez).
    const TRECHO_AVISO = /volt(ará|ara)\s+para\s+an[áa]lise\s+e\s+s[óo]\s+ficar[áa]\s+dispon[íi]vel/;

    const fonteForm = fonteSemComentarios("src/components/portal/novo-cupom-form.tsx");
    check("D2: o formulário tem o texto do aviso", TRECHO_AVISO.test(fonteForm));
    check("D2: …condicionado a editando && prorrogandoExpirado (não em Novo/Nova campanha)",
      /editando\s*&&\s*prorrogandoExpirado[\s\S]{0,60}<p\b/.test(fonteForm));

    const fonteClient = fonteSemComentarios("src/app/portal/(painel)/cupons/cupons-client.tsx");
    check("D2: abrirEdicao liga o aviso SÓ quando statusPortal é 'expirado'",
      /setProrrogandoExpirado\(item\.statusPortal === "expirado"\)/.test(fonteClient));
    check("D2: abrirNovaCampanha desliga o aviso (nunca aparece na duplicação)",
      /abrirNovaCampanha[\s\S]{0,400}setProrrogandoExpirado\(false\)/.test(fonteClient));
    check("D2: cancelar reseta o aviso",
      /onCancelar=\{\(\) => \{[\s\S]{0,150}setProrrogandoExpirado\(false\)/.test(fonteClient));
  }

  // ============================================================
  console.log("\n[D2-F] Segurança — nada disto afrouxou controle de papel");
  // ============================================================
  {
    const qa = await criarContaQa(svc, "f9d2", { nome: "Fulana D2" });
    try {
      const consumidor = await logar(qa.email, qa.senha);
      const { data: pCons, error: eCons } = await consumidor
        .from("profiles").select("role").eq("id", qa.id).maybeSingle();
      check("D2: consumidor lê o PRÓPRIO profile (RLS de dono)",
        !eCons && pCons?.role === "consumidor", String(pCons?.role ?? eCons?.message));

      const { data: outro } = await consumidor
        .from("profiles").select("role")
        .neq("id", qa.id).limit(1);
      check("D2: consumidor NÃO lê profile alheio (RLS nega, 0 linhas)",
        (outro ?? []).length === 0, JSON.stringify(outro));
    } finally {
      await destruirContaQa(svc, qa.id);
    }
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c));
