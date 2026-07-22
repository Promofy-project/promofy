/**
 * Testes de fluxo da Fase 4 (multi-categoria + favoritos + novidades + dias).
 * Roda contra o stack seedado (`npm run db:reset` antes). Prova:
 *  - multi-categoria: cupom com categoria fora do conjunto do estabelecimento
 *    é rejeitado pelo TRIGGER também no PostgREST direto (não só na action);
 *    junção legível pelo público (estab ativo) e escrita SÓ admin;
 *  - favoritos: RPC é o único caminho de escrita (INSERT direto → 42501),
 *    isolamento entre usuários, persistência entre logins;
 *  - dia da semana: funções puras de src/lib/dias.ts, incluindo a fronteira
 *    UTC×BRT e o acento de "Sáb";
 *  - novidades: A favorita → estab publica (aprovação) → A conta, B não;
 *    marcar visto zera; publicado ANTES do favorito não conta; anon nada.
 *
 * try/finally restaura: cupons f4-*, favoritos e novidades_visto dos
 * usuários envolvidos.
 */
import { config } from "dotenv";
const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { DIAS_SEMANA, cupomDisponivelNoDia, diaSemanaBrt } from "../src/lib/dias";
import { cupons as mockCupons } from "../src/lib/mock-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  console.error(`Faltam variáveis em ${envFile}.`);
  process.exit(1);
}
console.log(`\n[test-fase4] alvo: ${hosted ? "HOSPEDADO (muta dados!)" : "local"} (${new URL(url).host})\n`);

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

const svc = createClient(url!, serviceRole!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = () =>
  createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function logar(email: string): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

type Jsonb = Record<string, unknown> | null;
const motivo = (r: Jsonb) => (r as { motivo?: string })?.motivo;
const okr = (r: Jsonb) => (r as { ok?: boolean })?.ok === true;
const countOf = (r: Jsonb) => Number((r as { count?: number })?.count ?? -1);
const idsOf = (r: Jsonb) => ((r as { cupom_ids?: string[] })?.cupom_ids ?? []);

const CAT_OK = "f4-cat-ok"; // cupom do lojista com a 2ª categoria (fitness ∈ e1)
const NOVO = "f4-novidade"; // cupom aprovado DEPOIS do favorito de A
const ANTIGO = "f4-antigo"; // cupom aprovado ANTES do favorito de B
const BUG1 = "f4-bug1"; // detalhe /m/cupom/[id]: cupom novo aprovado deve abrir por id

async function limparFase4(uids: string[]) {
  await svc.from("cupons").delete().in("id", [CAT_OK, NOVO, ANTIGO, BUG1, `${BUG1}-exp`]);
  await svc.from("favoritos").delete().in("usuario_id", uids);
  await svc.from("novidades_visto").delete().in("usuario_id", uids);
}

async function main() {
  const consumidor = await logar("consumidor@promofy.test"); // A
  const consumidorId = (await consumidor.auth.getUser()).data.user!.id;
  const convidado = await logar("convidado@promofy.test"); // B
  const convidadoId = (await convidado.auth.getUser()).data.user!.id;
  const lojista = await logar("lojista@promofy.test"); // e1
  const lojista2 = await logar("lojista2@promofy.test"); // e2
  const admin = await logar("admin@promofy.test");
  const anonC = anon();

  await limparFase4([consumidorId, convidadoId]);

  try {
    console.log("[multi-categoria — leitura da junção]");
    {
      const { data } = await anonC
        .from("estabelecimento_categorias")
        .select("categoria_id")
        .eq("estabelecimento_id", "e1");
      const cats = (data ?? []).map((c) => c.categoria_id).sort();
      check("anon lê as 2 categorias de e1 (alimentacao+fitness)",
        cats.length === 2 && cats[0] === "alimentacao" && cats[1] === "fitness",
        cats.join(","));
    }
    {
      const { data } = await anonC
        .from("estabelecimento_categorias")
        .select("categoria_id")
        .eq("estabelecimento_id", "e4"); // e4 é 'pendente'
      check("anon NÃO lê categorias de estabelecimento não-ativo (0)",
        (data?.length ?? 0) === 0, String(data?.length));
    }

    console.log("\n[multi-categoria — cupom respeita o conjunto (PostgREST direto)]");
    {
      const ins = await lojista.from("cupons").insert({
        id: CAT_OK, estabelecimento_id: "e1", titulo: "F4 categoria pet (fora)",
        categoria_id: "pet", economia: 10, validade_fim: "2030-12-31", status: "pendente",
      }).select();
      check("lojista INSERT direto com categoria FORA do conjunto → trigger rejeita",
        ins.error?.message?.includes("categoria_fora_do_conjunto") === true,
        ins.error?.message ?? "sem erro");
    }
    {
      const ins = await lojista.from("cupons").insert({
        id: CAT_OK, estabelecimento_id: "e1", titulo: "F4 categoria fitness (dentro)",
        categoria_id: "fitness", economia: 10, validade_fim: "2030-12-31", status: "pendente",
      }).select();
      check("lojista INSERT com a 2ª categoria do conjunto (fitness) → aceito",
        !ins.error && (ins.data?.length ?? 0) === 1, ins.error?.message);
    }
    {
      const up = await lojista.from("cupons")
        .update({ categoria_id: "pet" }).eq("id", CAT_OK).select();
      check("lojista UPDATE direto p/ categoria fora do conjunto → trigger rejeita",
        up.error?.message?.includes("categoria_fora_do_conjunto") === true,
        up.error?.message ?? "sem erro");
    }

    console.log("\n[multi-categoria — escrita na junção é SÓ admin]");
    {
      const ins = await lojista.from("estabelecimento_categorias")
        .insert({ estabelecimento_id: "e1", categoria_id: "beleza" }).select();
      check("lojista NÃO insere na junção do próprio estab → RLS nega",
        ins.error !== null, ins.error ? "" : "inseriu!");
    }
    {
      const del = await lojista.from("estabelecimento_categorias")
        .delete().eq("estabelecimento_id", "e1").eq("categoria_id", "fitness").select();
      check("lojista NÃO deleta da junção (0 linhas)",
        !del.error && (del.data?.length ?? 0) === 0, del.error?.message ?? String(del.data?.length));
    }
    {
      const up = await lojista.from("estabelecimentos")
        .update({ categoria_id: "fitness" }).eq("id", "e1").select();
      check("lojista NÃO muda a categoria principal direto → 42501 (grant retirado)",
        up.error?.code === "42501", up.error?.code ?? "sem erro");
    }
    {
      const ins = await admin.from("estabelecimento_categorias")
        .insert({ estabelecimento_id: "e2", categoria_id: "alimentacao" }).select();
      check("admin insere na junção → ok", !ins.error && (ins.data?.length ?? 0) === 1, ins.error?.message);
      const del = await admin.from("estabelecimento_categorias")
        .delete().eq("estabelecimento_id", "e2").eq("categoria_id", "alimentacao").select();
      check("admin remove da junção → ok", !del.error && (del.data?.length ?? 0) === 1, del.error?.message);
    }

    console.log("\n[favoritos — RPC único caminho + isolamento]");
    {
      const r = (await consumidor.rpc("favoritar_estabelecimento", { p_est_id: "e1" })).data as Jsonb;
      check("A favorita e1 via RPC → ok", okr(r), JSON.stringify(r));
      const r2 = (await consumidor.rpc("favoritar_estabelecimento", { p_est_id: "e1" })).data as Jsonb;
      check("favoritar de novo (idempotente) → ok", okr(r2), JSON.stringify(r2));
    }
    check("favoritar estabelecimento inexistente → nao_encontrado",
      motivo((await consumidor.rpc("favoritar_estabelecimento", { p_est_id: "nao-existe" })).data as Jsonb) === "nao_encontrado");
    check("favoritar estabelecimento suspenso (e6) → nao_encontrado",
      motivo((await consumidor.rpc("favoritar_estabelecimento", { p_est_id: "e6" })).data as Jsonb) === "nao_encontrado");
    {
      const ins = await consumidor.from("favoritos")
        .insert({ usuario_id: consumidorId, estabelecimento_id: "e2" }).select();
      check("INSERT direto em favoritos → 42501 (escrita só via RPC)",
        ins.error?.code === "42501", ins.error?.code ?? "inseriu!");
    }
    {
      const { data } = await consumidor.from("favoritos").select("estabelecimento_id");
      check("A lê o próprio favorito (1 linha, e1)",
        data?.length === 1 && data[0].estabelecimento_id === "e1", JSON.stringify(data));
    }
    {
      const { data } = await convidado.from("favoritos").select("estabelecimento_id");
      check("B NÃO vê favoritos de A (0 linhas)", (data?.length ?? 0) === 0, String(data?.length));
    }
    {
      const anonSel = await anonC.from("favoritos").select("estabelecimento_id");
      check("anon NÃO lê favoritos", (anonSel.data?.length ?? 0) === 0 || anonSel.error !== null);
    }
    {
      // persistência: sessão NOVA do mesmo usuário continua vendo o favorito
      const outraSessao = await logar("consumidor@promofy.test");
      const { data } = await outraSessao.from("favoritos").select("estabelecimento_id");
      check("favorito persiste em novo login (1 linha)", data?.length === 1, String(data?.length));
    }
    {
      const anonRpc = await anonC.rpc("favoritar_estabelecimento", { p_est_id: "e1" });
      check("anon NÃO chama a RPC de favoritar (execute revogado)", anonRpc.error !== null);
    }
    {
      // regressão Fase 4: o detalhe /m/cupom/[id] renderiza <FavoriteButton
      // estabelecimentoId={cupom.estabelecimentoId}>. Um cupom-seed (via mock)
      // precisa apontar p/ um estabelecimento REAL — senão favoritar pelo
      // detalhe fica mudo (id órfão). Guarda a paridade mock↔banco.
      const { data } = await svc.from("estabelecimentos").select("id");
      const dbIds = new Set((data ?? []).map((e) => e.id));
      const orfaos = mockCupons
        .filter((c) => !dbIds.has(c.estabelecimentoId))
        .map((c) => `${c.id}→${c.estabelecimentoId}`);
      check(
        "todo cupom do mock aponta p/ estabelecimento existente (FavoriteButton nunca recebe id órfão)",
        orfaos.length === 0,
        orfaos.join(", "),
      );
    }

    console.log("\n[bug1 — /m/cupom/[id] lê o banco: novo aprovado abre; invisível dá 404]");
    {
      // pendente: buscarCupomPorId filtra por status in (ativo,indisponivel) →
      // anon não lê → notFound() correto (cupom ainda não aprovado no admin).
      await svc.from("cupons").insert({
        id: BUG1, estabelecimento_id: "e1", titulo: "F4 Bug1 detalhe",
        categoria_id: "alimentacao", economia: 20, validade_fim: "2030-12-31",
        status: "pendente",
      });
      const pend = await anonC
        .from("cupons").select("id")
        .eq("id", BUG1).in("status", ["ativo", "indisponivel"]).maybeSingle();
      check("cupom pendente NÃO é lido por id (→ null → 404 correto)",
        pend.data == null, JSON.stringify(pend.data));

      // aprovado: agora anon lê por id (no main, o detalhe só olhava o mock e
      // dava 404 p/ id novo — este é exatamente o caminho do buscarCupomPorId).
      await admin.rpc("aprovar_cupom", { p_cupom_id: BUG1 });
      const apr = await anonC
        .from("cupons").select("id, estabelecimentos(nome)")
        .eq("id", BUG1).in("status", ["ativo", "indisponivel"]).maybeSingle();
      const nome = (apr.data as { estabelecimentos?: { nome?: string } } | null)
        ?.estabelecimentos?.nome;
      check("cupom recém-aprovado É lido por id via anon (fix do 404 no /m/cupom/[id])",
        apr.data?.id === BUG1 && nome === "Sabor & Cia", JSON.stringify(apr.data));

      // aprovado porém expirado: passa no filtro de status, mas a visibilidade
      // (validade_fim >= hoje, BRT) reprova → buscarCupomPorId → null → 404 legítimo.
      await svc.from("cupons").insert({
        id: `${BUG1}-exp`, estabelecimento_id: "e1", titulo: "F4 Bug1 expirado",
        categoria_id: "alimentacao", economia: 20, validade_fim: "2000-01-01",
        status: "ativo",
      });
      const exp = await anonC
        .from("cupons").select("id, validade_fim")
        .eq("id", `${BUG1}-exp`).in("status", ["ativo", "indisponivel"]).maybeSingle();
      const hojeBrt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const visivel = exp.data != null && (exp.data.validade_fim as string) >= hojeBrt;
      check("cupom aprovado porém expirado NÃO passa na visibilidade (→ null → 404)",
        !visivel, JSON.stringify({ validade_fim: exp.data?.validade_fim, hojeBrt }));
    }

    console.log("\n[dia da semana — funções puras (fuso BRT)]");
    check("sem restrição (undefined) vale em qualquer dia", cupomDisponivelNoDia(undefined, "Seg"));
    check("restrição vazia ([]) vale em qualquer dia", cupomDisponivelNoDia([], "Dom"));
    check("['Sáb'] casa com 'Sáb' (acento preservado)", cupomDisponivelNoDia(["Sáb"], "Sáb"));
    check("['Seg','Ter'] NÃO vale no Dom", !cupomDisponivelNoDia(["Seg", "Ter"], "Dom"));
    check("DIAS_SEMANA tem os 7 labels canônicos", DIAS_SEMANA.join(",") === "Seg,Ter,Qua,Qui,Sex,Sáb,Dom");
    // 22/07/2026 é quarta-feira
    check("meio-dia UTC de 22/07/2026 → 'Qua'", diaSemanaBrt(new Date("2026-07-22T12:00:00Z")) === "Qua",
      diaSemanaBrt(new Date("2026-07-22T12:00:00Z")));
    // fronteira: 01:00 UTC de 23/07 ainda é 22/07 22:00 em BRT
    check("01:00 UTC do dia 23 ainda é 'Qua' em BRT (fronteira de fuso)",
      diaSemanaBrt(new Date("2026-07-23T01:00:00Z")) === "Qua",
      diaSemanaBrt(new Date("2026-07-23T01:00:00Z")));
    check("03:00 UTC do dia 23 já é 'Qui' em BRT (00:00 local)",
      diaSemanaBrt(new Date("2026-07-23T03:00:00Z")) === "Qui",
      diaSemanaBrt(new Date("2026-07-23T03:00:00Z")));
    {
      // coerência banco×app: o dia dos cupons c01/c02 do seed
      const { data } = await anonC.from("cupons").select("horarios").eq("id", "c02").single();
      const dias = (data?.horarios as { dias?: string[] } | null)?.dias ?? [];
      check("seed: c02 restringe a Seg–Sex (dias estruturados no jsonb)",
        dias.join(",") === "Seg,Ter,Qua,Qui,Sex", dias.join(","));
    }

    console.log("\n[novidades — favorito publica depois → badge]");
    // A já favoritou e1 acima (t0). Agora e1 publica um cupom novo (t1 > t0).
    await svc.from("cupons").insert({
      id: NOVO, estabelecimento_id: "e1", titulo: "F4 Novidade", categoria_id: "alimentacao",
      economia: 15, validade_fim: "2030-12-31", status: "pendente",
    });
    {
      const r = (await admin.rpc("aprovar_cupom", { p_cupom_id: NOVO })).data as Jsonb;
      check("admin aprova o cupom novo → ok (carimba publicado_em)", okr(r), JSON.stringify(r));
      const { data } = await svc.from("cupons").select("publicado_em").eq("id", NOVO).single();
      check("publicado_em preenchido na aprovação", data?.publicado_em != null);
    }
    {
      const r = (await consumidor.rpc("novidades_favoritos")).data as Jsonb;
      check("A vê a novidade (count ≥ 1, contém o cupom)",
        countOf(r) >= 1 && idsOf(r).includes(NOVO), JSON.stringify(r));
    }
    {
      const r = (await convidado.rpc("novidades_favoritos")).data as Jsonb;
      check("B (não favoritou) NÃO vê novidade (count 0)", countOf(r) === 0, JSON.stringify(r));
    }
    {
      const anonRpc = await anonC.rpc("novidades_favoritos");
      check("anon NÃO chama a RPC de novidades (execute revogado)", anonRpc.error !== null);
    }
    {
      const r = (await consumidor.rpc("marcar_novidades_vistas")).data as Jsonb;
      check("A marca como visto → ok", okr(r), JSON.stringify(r));
      const depois = (await consumidor.rpc("novidades_favoritos")).data as Jsonb;
      check("badge de A zera após marcar visto (count 0)", countOf(depois) === 0, JSON.stringify(depois));
    }
    {
      // cupom publicado ANTES do favorito não conta: aprova, DEPOIS B favorita
      await svc.from("cupons").insert({
        id: ANTIGO, estabelecimento_id: "e1", titulo: "F4 Antigo", categoria_id: "alimentacao",
        economia: 12, validade_fim: "2030-12-31", status: "pendente",
      });
      await admin.rpc("aprovar_cupom", { p_cupom_id: ANTIGO });
      const fav = (await convidado.rpc("favoritar_estabelecimento", { p_est_id: "e1" })).data as Jsonb;
      check("B favorita e1 (depois da publicação) → ok", okr(fav));
      const r = (await convidado.rpc("novidades_favoritos")).data as Jsonb;
      check("cupom publicado ANTES do favorito NÃO conta p/ B (count 0)",
        countOf(r) === 0, JSON.stringify(r));
    }
  } finally {
    // restauração — mesmo em falha no meio
    await limparFase4([consumidorId, convidadoId]);
    await svc.from("estabelecimento_categorias").delete()
      .eq("estabelecimento_id", "e2").eq("categoria_id", "alimentacao");
  }

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test-fase4 falhou:", err);
  process.exit(1);
});
