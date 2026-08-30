/**
 * MARCO 1 — prova integrada de que o STAGING da taxonomia nova
 * (segmento -> categoria folha, TX-P2A..TX-P2D1E) está pronto para
 * cutover: shadows preenchidos, invariantes de servidor provados nos
 * DOIS sentidos, snapshots históricos imutáveis e capturados
 * automaticamente, transição sem quebrar o fluxo legado, e o legado
 * (categorias/estabelecimento_categorias/views P2A) intocado.
 *
 * Este teste NÃO refaz test-tx-p2a/b/c/d1 — assume que rodaram antes
 * (Part R do prompt do Marco 1) e foca no que É NOVO nesta fase:
 * `cupons.categoria_nova_id`, `estabelecimentos.categoria_principal_id`,
 * `estabelecimento_categorias_novas`, `cupom_eventos.categoria_id`,
 * `cupons_usuario.categoria_id`, e os triggers que os protegem
 * (migrations 20260830160000 e 20260830170000).
 *
 * Regra da casa: verde vazio é pior que vermelho — todo teste negativo
 * confere `error` presente, nunca "0 linhas". Fixtures usam prefixo
 * `m1-` e são removidas no `finally`; testes que mutam dado CANÔNICO
 * (categoria.ativo, cupons.categoria_nova_id de um cupom real) revertem
 * para o valor original antes de terminar — o de-para (item 9/12/14)
 * precisa continuar batendo depois desta suite rodar.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-m1-taxonomia");

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

/** Falhou de verdade? (erro presente, não apenas "0 linhas") */
function negado(r: { error: unknown }): boolean {
  return Boolean(r.error);
}

const PREFIXO = "m1-";

interface DeparaSlugs {
  segmento_slug: string;
  categoria_slug: string;
}
interface DeparaEstabelecimento {
  id: string;
  principal: DeparaSlugs;
  categorias: DeparaSlugs[];
  remover_vinculo_legado_decorativo?: { categoria_legada: string }[];
}
interface DeparaCupom {
  id: string;
  estabelecimento_id: string;
  folha: DeparaSlugs;
}
interface DeparaJson {
  estabelecimentos: DeparaEstabelecimento[];
  cupons: DeparaCupom[];
}

function carregarJson<T>(caminho: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), caminho), "utf8")) as T;
}

function chaveDepara(s: DeparaSlugs): string {
  return `${s.segmento_slug}/${s.categoria_slug}`;
}

async function main(): Promise<number> {
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // authenticated COMUM, dono de e1 — não é admin, não é service_role.
  const lojista = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await lojista.auth.signInWithPassword({
    email: "lojista@promofy.test",
    password: "promofy123",
  });

  // id do convidado varia a cada seed-users (GoTrue gera o uuid) — nunca
  // hardcodar, resolver por login como os outros scripts da casa fazem.
  // Cliente PRÓPRIO para este login: reusar `anon` deixaria de ser anônimo
  // depois do signInWithPassword, quebrando os testes 34/35 mais abaixo.
  const convidadoClient = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const convidadoLogin = await convidadoClient.auth.signInWithPassword({
    email: "convidado@promofy.test",
    password: "promofy123",
  });
  const CONVIDADO_ID = convidadoLogin.data.user?.id;
  if (!CONVIDADO_ID) {
    throw new Error(`login de convidado@promofy.test falhou: ${convidadoLogin.error?.message}`);
  }

  const depara = carregarJson<DeparaJson>("docs/taxonomia/depara-v1.json");

  const segmentoIdCache = new Map<string, string>();
  async function segmentoId(slug: string): Promise<string> {
    const cached = segmentoIdCache.get(slug);
    if (cached) return cached;
    const { data, error } = await svc.from("segmentos").select("id").eq("slug", slug).single();
    if (error || !data) throw new Error(`segmento não encontrado: ${slug} — ${error?.message}`);
    segmentoIdCache.set(slug, data.id as string);
    return data.id as string;
  }
  async function categoriaId(segmentoSlug: string, categoriaSlug: string): Promise<string> {
    const segId = await segmentoId(segmentoSlug);
    const { data, error } = await svc
      .from("categorias_novas")
      .select("id")
      .eq("segmento_id", segId)
      .eq("slug", categoriaSlug)
      .single();
    if (error || !data)
      throw new Error(`categoria não encontrada: ${segmentoSlug}/${categoriaSlug} — ${error?.message}`);
    return data.id as string;
  }

  const fixturesSegmento: string[] = [];
  let categoriaDesativadaTemporariamente: string | null = null;
  let cupomRecategorizadoOriginal: { id: string; categoriaOriginal: string } | null = null;
  let joinRemovidoTemporariamente: { estabelecimento_id: string; categoria_id: string } | null = null;
  const idsEventosScratch: number[] = [];
  const idsUsoScratch: number[] = [];
  const idsCuponsScratch: string[] = [];

  try {
    // ============================================================
    // CANONICAL — regressão leve pós-M1 (cobertura funda em test-tx-p2b/c)
    // ============================================================
    console.log("\n=== M1/CANONICAL ===\n");

    const segCount = await svc.from("segmentos").select("id", { count: "exact", head: true });
    check("1. segmentos = 14", segCount.count === 14, String(segCount.count));

    const catCount = await svc.from("categorias_novas").select("id", { count: "exact", head: true });
    check("2. categorias_novas = 75", catCount.count === 75, String(catCount.count));

    const segIcone = await svc.from("segmentos").select("icone").limit(1);
    const catIconeTema = await svc.from("categorias_novas").select("icone, tema").limit(1);
    const segIconStale = await svc.from("segmentos").select("icon" as never).limit(1);
    const catOverrideStale = await svc
      .from("categorias_novas")
      .select("icon_override, tema_override" as never)
      .limit(1);
    check(
      "3. schema icone/tema correto (icone/tema presentes, icon/icon_override/tema_override ausentes)",
      !segIcone.error && !catIconeTema.error && negado(segIconStale) && negado(catOverrideStale),
      JSON.stringify({
        segIcone: segIcone.error?.message,
        catIconeTema: catIconeTema.error?.message,
        segIconStaleDeviaFalhar: segIconStale.error?.message,
        catOverrideStaleDeviaFalhar: catOverrideStale.error?.message,
      }),
    );

    const segA = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}seg-a`, nome: "M1 Seg A", icone: "Star", tema: "azul", ordem: 900 })
      .select("id")
      .single();
    const segB = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}seg-b`, nome: "M1 Seg B", icone: "Star", tema: "verde", ordem: 901 })
      .select("id")
      .single();
    if (segA.data) fixturesSegmento.push(segA.data.id as string);
    if (segB.data) fixturesSegmento.push(segB.data.id as string);

    const folhaFutura = await svc
      .from("categorias_novas")
      .insert({
        segmento_id: segA.data?.id,
        slug: `${PREFIXO}folha-futura`,
        nome: "M1 Folha Futura",
        tema: "tema-futuro-m1-teste",
        ordem: 1,
      })
      .select("id, tema")
      .single();
    check(
      "4. tema-futuro permitido (domain valida FORMATO, não whitelist)",
      !folhaFutura.error && folhaFutura.data?.tema === "tema-futuro-m1-teste",
      folhaFutura.error?.message,
    );

    const reparent = await svc
      .from("categorias_novas")
      .update({ segmento_id: segB.data?.id })
      .eq("id", folhaFutura.data?.id as string);
    check("5. reparent negado (segmento_id incondicionalmente imutável)", negado(reparent), "update passou!");

    // ============================================================
    // SHADOW CUPOM
    // ============================================================
    console.log("\n=== M1/SHADOW CUPOM ===\n");

    const cuponsDb = await svc.from("cupons").select("id, categoria_nova_id");
    check("6. cupons = 14", (cuponsDb.data ?? []).length === 14, String(cuponsDb.data?.length));

    const preenchidos = (cuponsDb.data ?? []).filter((c) => c.categoria_nova_id !== null);
    check("7. 14/14 categoria_nova_id preenchidos", preenchidos.length === 14, String(preenchidos.length));

    const nulos = (cuponsDb.data ?? []).filter((c) => c.categoria_nova_id === null);
    check("8. 0 NULL", nulos.length === 0, String(nulos.length));

    let mappingDivergente: string[] = [];
    for (const c of depara.cupons) {
      const esperado = await categoriaId(c.folha.segmento_slug, c.folha.categoria_slug);
      const real = (cuponsDb.data ?? []).find((r) => r.id === c.id)?.categoria_nova_id;
      if (real !== esperado) mappingDivergente.push(`${c.id}: esperado=${esperado} real=${real}`);
    }
    check("9. mapping exatamente depara-v1", mappingDivergente.length === 0, JSON.stringify(mappingDivergente));

    // ============================================================
    // ESTABELECIMENTOS
    // ============================================================
    console.log("\n=== M1/ESTABELECIMENTOS ===\n");

    const estabDb = await svc.from("estabelecimentos").select("id, categoria_principal_id");
    check("10. 6 estabelecimentos", (estabDb.data ?? []).length === 6, String(estabDb.data?.length));

    const principaisPreenchidos = (estabDb.data ?? []).filter((e) => e.categoria_principal_id !== null);
    check("11. 6 categoria_principal_id preenchidos", principaisPreenchidos.length === 6, String(principaisPreenchidos.length));

    let principalDivergente: string[] = [];
    for (const e of depara.estabelecimentos) {
      const esperado = await categoriaId(e.principal.segmento_slug, e.principal.categoria_slug);
      const real = (estabDb.data ?? []).find((r) => r.id === e.id)?.categoria_principal_id;
      if (real !== esperado) principalDivergente.push(`${e.id}: esperado=${esperado} real=${real}`);
    }
    check("12. cada principal exatamente correta", principalDivergente.length === 0, JSON.stringify(principalDivergente));

    const joinDb = await svc.from("estabelecimento_categorias_novas").select("estabelecimento_id, categoria_id");
    check("13. join novo = 10", (joinDb.data ?? []).length === 10, String(joinDb.data?.length));

    const joinEsperado = new Set<string>();
    for (const e of depara.estabelecimentos) {
      for (const c of e.categorias) {
        joinEsperado.add(`${e.id}|${await categoriaId(c.segmento_slug, c.categoria_slug)}`);
      }
    }
    const joinReal = new Set((joinDb.data ?? []).map((r) => `${r.estabelecimento_id}|${r.categoria_id}`));
    const soExiste = (a: Set<string>, b: Set<string>) => Array.from(a).filter((x) => !b.has(x));
    check(
      "14. conjunto das 10 relações exatamente o de-para",
      soExiste(joinEsperado, joinReal).length === 0 && soExiste(joinReal, joinEsperado).length === 0,
      JSON.stringify({ faltando: soExiste(joinEsperado, joinReal), extra: soExiste(joinReal, joinEsperado) }),
    );

    const fitnessId = await segmentoId("fitness");
    const catsFitness = await svc.from("categorias_novas").select("id").eq("segmento_id", fitnessId);
    const idsCatsFitness = new Set((catsFitness.data ?? []).map((c) => c.id as string));
    const e1ComFitness = (joinDb.data ?? []).filter((r) => r.estabelecimento_id === "e1" && idsCatsFitness.has(r.categoria_id as string));
    check("15. e1→fitness não existe no shadow (era vínculo legado decorativo)", e1ComFitness.length === 0, JSON.stringify(e1ComFitness));

    let principalForaDoJoin: string[] = [];
    for (const e of estabDb.data ?? []) {
      if (!e.categoria_principal_id) continue;
      const pertence = joinReal.has(`${e.id}|${e.categoria_principal_id}`);
      if (!pertence) principalForaDoJoin.push(e.id as string);
    }
    check("16. 6/6 principal pertence ao join", principalForaDoJoin.length === 0, JSON.stringify(principalForaDoJoin));

    // ============================================================
    // INVARIANTES
    // ============================================================
    console.log("\n=== M1/INVARIANTES ===\n");

    const salaoId = await categoriaId("beleza", "salao-de-beleza");
    const restauranteId = await categoriaId("alimentacao", "restaurante");
    const pizzariaId = await categoriaId("alimentacao", "pizzaria");

    const e1Antes = await svc.from("estabelecimentos").select("categoria_principal_id").eq("id", "e1").single();
    const principalForaTentativa = await svc
      .from("estabelecimentos")
      .update({ categoria_principal_id: salaoId })
      .eq("id", "e1");
    check("17. principal fora do join é negada", negado(principalForaTentativa), "update passou!");
    const e1Depois = await svc.from("estabelecimentos").select("categoria_principal_id").eq("id", "e1").single();
    check(
      "17b. principal de e1 não mudou",
      e1Depois.data?.categoria_principal_id === e1Antes.data?.categoria_principal_id,
      String(e1Depois.data?.categoria_principal_id),
    );

    const removerPrincipal = await svc
      .from("estabelecimento_categorias_novas")
      .delete()
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", restauranteId);
    check("18. remover do join a principal é negado", negado(removerPrincipal), "delete passou!");
    const restaJoinE1Restaurante = await svc
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", restauranteId);
    check("18b. relação e1/restaurante continua existindo", (restaJoinE1Restaurante.data ?? []).length === 1, String(restaJoinE1Restaurante.data?.length));

    const c03Antes = await svc.from("cupons").select("categoria_nova_id").eq("id", "c03").single();
    const categoriaForaConjunto = await svc.from("cupons").update({ categoria_nova_id: salaoId }).eq("id", "c03");
    check("19. categoria de cupom fora do join é negada", negado(categoriaForaConjunto), "update passou!");
    const c03Depois = await svc.from("cupons").select("categoria_nova_id").eq("id", "c03").single();
    check("19b. categoria_nova_id de c03 não mudou", c03Depois.data?.categoria_nova_id === c03Antes.data?.categoria_nova_id);

    const racaoId = await categoriaId("pet", "racao-acessorios");
    const c11Antes = await svc.from("cupons").select("categoria_nova_id").eq("id", "c11").single();
    const c12Antes = await svc.from("cupons").select("categoria_nova_id").eq("id", "c12").single();
    await svc.from("categorias_novas").update({ ativo: false }).eq("id", racaoId);
    categoriaDesativadaTemporariamente = racaoId;

    const selecaoInativa = await svc.from("cupons").update({ categoria_nova_id: racaoId }).eq("id", "c11");
    check("20. categoria inativa numa nova seleção é negada", negado(selecaoInativa), "update passou!");
    const c11Depois = await svc.from("cupons").select("categoria_nova_id").eq("id", "c11").single();
    check("20b. categoria_nova_id de c11 não mudou", c11Depois.data?.categoria_nova_id === c11Antes.data?.categoria_nova_id);

    const c12Depois = await svc.from("cupons").select("categoria_nova_id").eq("id", "c12").single();
    check(
      "21. desativar categoria já usada NÃO apaga/invalida o cupom histórico (c12 continua com racao-acessorios)",
      c12Depois.data?.categoria_nova_id === c12Antes.data?.categoria_nova_id && c12Depois.data?.categoria_nova_id === racaoId,
      String(c12Depois.data?.categoria_nova_id),
    );

    const reativar = await svc.from("categorias_novas").update({ ativo: true }).eq("id", racaoId).select("ativo").single();
    check("21b. reativação da categoria funcionou (cleanup)", reativar.data?.ativo === true, JSON.stringify(reativar));
    categoriaDesativadaTemporariamente = null;

    // ============================================================
    // SNAPSHOTS
    // ============================================================
    console.log("\n=== M1/SNAPSHOTS ===\n");

    const eventosOrfaos = await svc
      .from("cupom_eventos")
      .select("id, cupom_id, cupons!inner(categoria_nova_id)")
      .not("cupons.categoria_nova_id", "is", null)
      .is("categoria_id", null);
    check("22. eventos existentes ligados a cupom com shadow: categoria_id não NULL", (eventosOrfaos.data ?? []).length === 0, String(eventosOrfaos.data?.length));

    const usosOrfaos = await svc
      .from("cupons_usuario")
      .select("id, cupom_id, cupons!inner(categoria_nova_id)")
      .not("cupons.categoria_nova_id", "is", null)
      .is("categoria_id", null);
    check("23. cupons_usuario existentes ligados a cupom com shadow: categoria_id não NULL", (usosOrfaos.data ?? []).length === 0, String(usosOrfaos.data?.length));

    const eventoNovo = await svc
      .from("cupom_eventos")
      .insert({ cupom_id: "c04", usuario_id: CONVIDADO_ID, tipo: "visualizacao" })
      .select("id, categoria_id")
      .single();
    if (eventoNovo.data) idsEventosScratch.push(eventoNovo.data.id as number);
    const c04 = await svc.from("cupons").select("categoria_nova_id").eq("id", "c04").single();
    check(
      "24. novo evento captura automaticamente categoria",
      !eventoNovo.error && eventoNovo.data?.categoria_id === c04.data?.categoria_nova_id && eventoNovo.data?.categoria_id !== null,
      eventoNovo.error?.message ?? JSON.stringify(eventoNovo.data),
    );

    const usoNovo = await svc
      .from("cupons_usuario")
      .insert({ usuario_id: CONVIDADO_ID, cupom_id: "c04", status: "validado" })
      .select("id, categoria_id")
      .single();
    if (usoNovo.data) idsUsoScratch.push(usoNovo.data.id as number);
    check(
      "25. novo cupons_usuario captura automaticamente categoria",
      !usoNovo.error && usoNovo.data?.categoria_id === c04.data?.categoria_nova_id && usoNovo.data?.categoria_id !== null,
      usoNovo.error?.message ?? JSON.stringify(usoNovo.data),
    );

    // Parte K — prova histórica completa, sobre c01 (revertido no finally).
    const c01Antes = await svc.from("cupons").select("categoria_nova_id").eq("id", "c01").single();
    const categoriaA = c01Antes.data?.categoria_nova_id as string;
    cupomRecategorizadoOriginal = { id: "c01", categoriaOriginal: categoriaA };

    const eventoA = await svc
      .from("cupom_eventos")
      .insert({ cupom_id: "c01", usuario_id: CONVIDADO_ID, tipo: "visualizacao" })
      .select("id, categoria_id")
      .single();
    if (eventoA.data) idsEventosScratch.push(eventoA.data.id as number);

    const categoriaB = restauranteId; // e1, diferente de pizzaria (A), pertence ao join de e1
    const recategorizar = await svc.from("cupons").update({ categoria_nova_id: categoriaB }).eq("id", "c01");
    check("26-prep. recategorização de c01 (A→B válida) aceita", !recategorizar.error, recategorizar.error?.message);

    const eventoADepois = await svc.from("cupom_eventos").select("categoria_id").eq("id", eventoA.data?.id as number).single();
    check(
      "26. snapshot A permanece A após recategorizar cupom para B",
      eventoADepois.data?.categoria_id === categoriaA,
      `esperado=${categoriaA} real=${eventoADepois.data?.categoria_id}`,
    );

    const eventoB = await svc
      .from("cupom_eventos")
      .insert({ cupom_id: "c01", usuario_id: CONVIDADO_ID, tipo: "clique" })
      .select("id, categoria_id")
      .single();
    if (eventoB.data) idsEventosScratch.push(eventoB.data.id as number);
    check(
      "27. novo fato depois da recategorização captura B",
      eventoB.data?.categoria_id === categoriaB,
      `esperado=${categoriaB} real=${eventoB.data?.categoria_id}`,
    );

    const alterarSnapshotDireto = await svc
      .from("cupom_eventos")
      .update({ categoria_id: categoriaB })
      .eq("id", eventoA.data?.id as number);
    check("28. alterar snapshot A→B diretamente é negado", negado(alterarSnapshotDireto), "update passou!");

    // reverte c01 para o de-para ANTES de continuar (item 9 depende disso)
    const reverterC01 = await svc.from("cupons").update({ categoria_nova_id: categoriaA }).eq("id", "c01");
    check("28b. c01 revertido para categoria original (cleanup)", !reverterC01.error, reverterC01.error?.message);
    cupomRecategorizadoOriginal = null;

    // ============================================================
    // TRANSIÇÃO
    // ============================================================
    console.log("\n=== M1/TRANSIÇÃO ===\n");

    const idScratchLegado = `${PREFIXO}teste-legado-sem-shadow`;
    const insertLegado = await svc
      .from("cupons")
      .insert({
        id: idScratchLegado,
        estabelecimento_id: "e1",
        titulo: "M1 teste — fluxo legado sem shadow",
        categoria_id: "alimentacao",
        economia: 10,
        validade_fim: "2030-01-01",
      })
      .select("id, categoria_nova_id")
      .single();
    if (!insertLegado.error) idsCuponsScratch.push(idScratchLegado);
    check(
      "29. fluxo legado ainda consegue operar sem erro (INSERT só com categoria_id legado, sem categoria_nova_id)",
      !insertLegado.error && insertLegado.data?.categoria_nova_id === null,
      insertLegado.error?.message,
    );

    const shadowNulo = await svc.from("cupons").select("id", { count: "exact", head: true }).is("categoria_nova_id", null);
    check(
      "30. shadow NULL de uma nova escrita é detectável por query (exatamente o cupom-teste, os 14 canônicos continuam preenchidos)",
      shadowNulo.count === 1,
      String(shadowNulo.count),
    );

    // ============================================================
    // LEGADO
    // ============================================================
    console.log("\n=== M1/LEGADO ===\n");

    const catLegado = await svc.from("categorias").select("id", { count: "exact", head: true });
    check("31. categorias legado = 6", catLegado.count === 6, String(catLegado.count));

    const estabCatLegado = await svc.from("estabelecimento_categorias").select("estabelecimento_id", { count: "exact", head: true });
    check("32. estabelecimento_categorias legado = 7", estabCatLegado.count === 7, String(estabCatLegado.count));

    const filtros = await svc.from("catalogo_filtros").select("slug", { count: "exact", head: true });
    const categoriasView = await svc.from("catalogo_categorias").select("categoria_id", { count: "exact", head: true });
    const mapaView = await svc.from("categoria_para_filtro").select("categoria_id", { count: "exact", head: true });
    check(
      "33. P2A views = 6/6/6",
      filtros.count === 6 && categoriasView.count === 6 && mapaView.count === 6,
      `filtros=${filtros.count} categorias=${categoriasView.count} mapa=${mapaView.count}`,
    );

    // ============================================================
    // EXTRA — Part N: grants da nova join (só leitura pública)
    // ============================================================
    console.log("\n=== M1/EXTRA — grants e RLS ===\n");

    const anonSelectJoin = await anon.from("estabelecimento_categorias_novas").select("estabelecimento_id, categoria_id");
    check(
      "34. anon LÊ estabelecimento_categorias_novas (leitura pública)",
      !anonSelectJoin.error && (anonSelectJoin.data ?? []).length === 10,
      anonSelectJoin.error?.message ?? String(anonSelectJoin.data?.length),
    );

    const anonInsertJoin = await anon
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: pizzariaId });
    check("35. anon NÃO escreve em estabelecimento_categorias_novas", negado(anonInsertJoin), "insert passou!");

    const lojistaInsertJoin = await lojista
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: pizzariaId });
    check("36. authenticated comum NÃO escreve em estabelecimento_categorias_novas", negado(lojistaInsertJoin), "insert passou!");

    const lojistaUpdateShadow = await lojista
      .from("cupons")
      .update({ categoria_nova_id: pizzariaId })
      .eq("id", "c01");
    check(
      "37. authenticated comum NÃO faz UPDATE de categoria_nova_id (sem grant de coluna pós-criação)",
      negado(lojistaUpdateShadow),
      "update passou!",
    );

    // ============================================================
    // HARDENING FINAL — 1: invariante reversa cupom → join
    // ============================================================
    console.log("\n=== M1/HARDENING — join reverso (cupom trava remoção) ===\n");

    const deleteJoinEmUso = await svc
      .from("estabelecimento_categorias_novas")
      .delete()
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaId);
    check(
      "38. DELETE de e1/pizzaria enquanto c01 usa pizzaria é negado",
      negado(deleteJoinEmUso),
      "delete passou!",
    );
    const pizzariaAindaNoJoin = await svc
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaId);
    check(
      "38b. relação e1/pizzaria continua existindo",
      (pizzariaAindaNoJoin.data ?? []).length === 1,
      String(pizzariaAindaNoJoin.data?.length),
    );

    const c01AntesHardening = await svc.from("cupons").select("categoria_nova_id").eq("id", "c01").single();
    cupomRecategorizadoOriginal = { id: "c01", categoriaOriginal: c01AntesHardening.data?.categoria_nova_id as string };
    const moverC01ParaLiberarPizzaria = await svc
      .from("cupons")
      .update({ categoria_nova_id: restauranteId })
      .eq("id", "c01");
    check("39-prep. move c01 para restaurante (libera pizzaria)", !moverC01ParaLiberarPizzaria.error, moverC01ParaLiberarPizzaria.error?.message);

    const deleteJoinLivre = await svc
      .from("estabelecimento_categorias_novas")
      .delete()
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaId);
    check(
      "39. DELETE de e1/pizzaria após liberar (nenhum cupom usa, não é principal) é permitido",
      !deleteJoinLivre.error,
      deleteJoinLivre.error?.message,
    );
    joinRemovidoTemporariamente = deleteJoinLivre.error ? null : { estabelecimento_id: "e1", categoria_id: pizzariaId };

    const pizzariaSumiuDoJoin = await svc
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaId);
    check("39b. relação e1/pizzaria realmente saiu do join", (pizzariaSumiuDoJoin.data ?? []).length === 0, String(pizzariaSumiuDoJoin.data?.length));

    const removerPrincipalHardening = await svc
      .from("estabelecimento_categorias_novas")
      .delete()
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", restauranteId);
    check(
      "39c. proteção de principal continua funcionando (remover restaurante-principal de e1 é negado)",
      negado(removerPrincipalHardening),
      "delete passou!",
    );

    // cleanup imediato (não esperar o finally): os testes 9/14/16 já
    // rodaram antes deste bloco, mas o estado final da suíte precisa
    // convergir de volta ao de-para de qualquer forma.
    const reinserirJoinPizzaria = await svc
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: pizzariaId });
    check("39d. cleanup: relação e1/pizzaria reinserida", !reinserirJoinPizzaria.error, reinserirJoinPizzaria.error?.message);
    joinRemovidoTemporariamente = null;

    const reverterC01Hardening = await svc
      .from("cupons")
      .update({ categoria_nova_id: c01AntesHardening.data?.categoria_nova_id })
      .eq("id", "c01");
    check("39e. cleanup: c01 revertido para pizzaria", !reverterC01Hardening.error, reverterC01Hardening.error?.message);
    cupomRecategorizadoOriginal = null;

    const updateChaveEmUso = await svc
      .from("estabelecimento_categorias_novas")
      .update({ categoria_id: restauranteId })
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaId);
    check(
      "40. UPDATE que muda a chave de uma relação em uso por cupom é negado (equivalente a remoção)",
      negado(updateChaveEmUso),
      "update passou!",
    );

    const updateChaveMesmoValor = await svc
      .from("estabelecimento_categorias_novas")
      .update({ categoria_id: pizzariaId })
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaId);
    check(
      "40b. UPDATE que reafirma a MESMA chave (sem mudar valor) não é bloqueado",
      !updateChaveMesmoValor.error,
      updateChaveMesmoValor.error?.message,
    );

    // ============================================================
    // HARDENING FINAL — 2: mudança de estabelecimento_id do cupom
    // ============================================================
    console.log("\n=== M1/HARDENING — estabelecimento_id quebra categoria ===\n");

    // Isolado do check LEGADO de propósito: c03 é e2/fitness(legado)/academia(nova).
    // e1 TAMBÉM tem "fitness" no legado (vínculo decorativo, item 15) mas NÃO tem
    // academia no join novo — se só o check legado estivesse ativo, esta troca
    // passaria. Provar que é o check NOVO (categoria_nova_id) que bloqueia.
    const c03AntesMove = await svc.from("cupons").select("estabelecimento_id, categoria_id").eq("id", "c03").single();
    const moverC03 = await svc.from("cupons").update({ estabelecimento_id: "e1" }).eq("id", "c03");
    check(
      "41. mudar estabelecimento_id do cupom para um que não tem a categoria_nova_id é negado (isolado do check legado)",
      negado(moverC03),
      "update passou!",
    );
    const c03DepoisMove = await svc.from("cupons").select("estabelecimento_id").eq("id", "c03").single();
    check(
      "41b. estabelecimento_id de c03 não mudou",
      c03DepoisMove.data?.estabelecimento_id === c03AntesMove.data?.estabelecimento_id,
      String(c03DepoisMove.data?.estabelecimento_id),
    );

    // ============================================================
    // HARDENING FINAL — 3/4/5: snapshot 100% server-owned
    // ============================================================
    console.log("\n=== M1/HARDENING — snapshot server-owned (injeção maliciosa) ===\n");

    const c01CategoriaReal = await svc.from("cupons").select("categoria_nova_id").eq("id", "c01").single();
    const eventoMalicioso = await svc
      .from("cupom_eventos")
      .insert({ cupom_id: "c01", usuario_id: CONVIDADO_ID, tipo: "validacao", categoria_id: restauranteId })
      .select("id, categoria_id")
      .single();
    if (eventoMalicioso.data) idsEventosScratch.push(eventoMalicioso.data.id as number);
    check(
      "42. caller não consegue falsificar snapshot de EVENTO (INSERT manda categoria errada, servidor grava a categoria real do cupom)",
      !eventoMalicioso.error &&
        eventoMalicioso.data?.categoria_id === c01CategoriaReal.data?.categoria_nova_id &&
        eventoMalicioso.data?.categoria_id !== restauranteId,
      JSON.stringify({ enviado: restauranteId, gravado: eventoMalicioso.data?.categoria_id, erro: eventoMalicioso.error?.message }),
    );

    const c05Categoria = await svc.from("cupons").select("categoria_nova_id").eq("id", "c05").single();
    const usoMalicioso = await svc
      .from("cupons_usuario")
      .insert({ usuario_id: CONVIDADO_ID, cupom_id: "c05", status: "ativo", categoria_id: pizzariaId })
      .select("id, categoria_id")
      .single();
    if (usoMalicioso.data) idsUsoScratch.push(usoMalicioso.data.id as number);
    check(
      "43. caller não consegue falsificar snapshot de USO (INSERT manda categoria errada, servidor grava a categoria real do cupom)",
      !usoMalicioso.error &&
        usoMalicioso.data?.categoria_id === c05Categoria.data?.categoria_nova_id &&
        usoMalicioso.data?.categoria_id !== pizzariaId,
      JSON.stringify({ enviado: pizzariaId, gravado: usoMalicioso.data?.categoria_id, erro: usoMalicioso.error?.message }),
    );

    // eventoMalicioso já nasceu com pizzaria (a categoria REAL, derivada pelo
    // servidor) — setar de volta pra pizzaria seria reafirmar o MESMO valor,
    // não uma mudança (IS DISTINCT FROM = false, passa por design). O teste de
    // imutabilidade precisa de um valor REALMENTE diferente do gravado.
    const alterarSnapshotMalicioso = await svc
      .from("cupom_eventos")
      .update({ categoria_id: salaoId })
      .eq("id", eventoMalicioso.data?.id as number);
    check(
      "44. imutabilidade continua negando UPDATE mesmo depois do hardening do server-owned",
      negado(alterarSnapshotMalicioso),
      "update passou!",
    );

    // ============================================================
    // HARDENING FINAL — 6/7: backfill privado, RPC inacessível
    // ============================================================
    console.log("\n=== M1/HARDENING — backfill privado (RPC inacessível) ===\n");

    const anonRpcTaxonomia = await anon.rpc("aplicar_backfill_m1_taxonomia" as never);
    check(
      "45. anon não consegue chamar aplicar_backfill_m1_taxonomia via RPC (função não está em schema exposto)",
      negado(anonRpcTaxonomia),
      "rpc passou!",
    );

    const lojistaRpcTaxonomia = await lojista.rpc("aplicar_backfill_m1_taxonomia" as never);
    check(
      "46. authenticated comum não consegue chamar aplicar_backfill_m1_taxonomia via RPC",
      negado(lojistaRpcTaxonomia),
      "rpc passou!",
    );

    const anonRpcSnapshots = await anon.rpc("aplicar_backfill_m1_snapshots" as never);
    check(
      "47. anon não consegue chamar aplicar_backfill_m1_snapshots via RPC",
      negado(anonRpcSnapshots),
      "rpc passou!",
    );

    const lojistaRpcSnapshots = await lojista.rpc("aplicar_backfill_m1_snapshots" as never);
    check(
      "48. authenticated comum não consegue chamar aplicar_backfill_m1_snapshots via RPC",
      negado(lojistaRpcSnapshots),
      "rpc passou!",
    );

    const svcRpcTaxonomia = await svc.rpc("aplicar_backfill_m1_taxonomia" as never);
    check(
      "49. nem service_role via API REST alcança a função (schema private não é exposto pelo PostgREST para nenhum papel)",
      negado(svcRpcTaxonomia),
      "rpc passou!",
    );

    console.log(`\nResultado: ${passed} PASS, ${failed} FAIL\n`);
    return failed > 0 ? 1 : 0;
  } finally {
    // Cleanup — ordem inversa das dependências (RESTRICT nas FKs de categoria
    // é justamente o que impede apagar fora de ordem). joinRemovidoTemporariamente
    // vem ANTES de cupomRecategorizadoOriginal de propósito: para reverter c01
    // de volta a uma categoria, ela precisa estar no join primeiro (checar_categoria_nova_cupom).
    if (categoriaDesativadaTemporariamente) {
      await svc.from("categorias_novas").update({ ativo: true }).eq("id", categoriaDesativadaTemporariamente);
    }
    if (joinRemovidoTemporariamente) {
      await svc.from("estabelecimento_categorias_novas").insert(joinRemovidoTemporariamente);
    }
    if (cupomRecategorizadoOriginal) {
      await svc
        .from("cupons")
        .update({ categoria_nova_id: cupomRecategorizadoOriginal.categoriaOriginal })
        .eq("id", cupomRecategorizadoOriginal.id);
    }
    if (idsEventosScratch.length > 0) {
      await svc.from("cupom_eventos").delete().in("id", idsEventosScratch);
    }
    if (idsUsoScratch.length > 0) {
      await svc.from("cupons_usuario").delete().in("id", idsUsoScratch);
    }
    if (idsCuponsScratch.length > 0) {
      await svc.from("cupons").delete().in("id", idsCuponsScratch);
    }
    if (fixturesSegmento.length > 0) {
      await svc.from("categorias_novas").delete().in("segmento_id", fixturesSegmento);
      await svc.from("segmentos").delete().in("id", fixturesSegmento);
    }

    const restaEventos = idsEventosScratch.length
      ? await svc.from("cupom_eventos").select("id").in("id", idsEventosScratch)
      : { data: [] as { id: number }[] };
    const restaUso = idsUsoScratch.length
      ? await svc.from("cupons_usuario").select("id").in("id", idsUsoScratch)
      : { data: [] as { id: number }[] };
    const restaCupons = idsCuponsScratch.length
      ? await svc.from("cupons").select("id").in("id", idsCuponsScratch)
      : { data: [] as { id: string }[] };
    const restaCat = fixturesSegmento.length
      ? await svc.from("categorias_novas").select("id").in("segmento_id", fixturesSegmento)
      : { data: [] as { id: string }[] };
    const restaSeg = fixturesSegmento.length
      ? await svc.from("segmentos").select("id").in("id", fixturesSegmento)
      : { data: [] as { id: string }[] };

    check("50. cleanup: zero eventos-fixture residuais", (restaEventos.data ?? []).length === 0, `${restaEventos.data?.length}`);
    check("51. cleanup: zero usos-fixture residuais", (restaUso.data ?? []).length === 0, `${restaUso.data?.length}`);
    check("52. cleanup: zero cupons-fixture residuais", (restaCupons.data ?? []).length === 0, `${restaCupons.data?.length}`);
    check("53. cleanup: zero categorias_novas-fixture residuais", (restaCat.data ?? []).length === 0, `${restaCat.data?.length}`);
    check("54. cleanup: zero segmentos-fixture residuais", (restaSeg.data ?? []).length === 0, `${restaSeg.data?.length}`);

    const c01Final = await svc.from("cupons").select("categoria_nova_id").eq("id", "c01").single();
    const pizzariaIdFinal = await categoriaId("alimentacao", "pizzaria");
    check(
      "55. cleanup: c01 de volta à categoria original (pizzaria) do de-para",
      c01Final.data?.categoria_nova_id === pizzariaIdFinal,
      String(c01Final.data?.categoria_nova_id),
    );

    const joinPizzariaFinal = await svc
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", "e1")
      .eq("categoria_id", pizzariaIdFinal);
    check(
      "56. cleanup: relação e1/pizzaria de volta ao join (o de-para continua com exatamente 10)",
      (joinPizzariaFinal.data ?? []).length === 1,
      String(joinPizzariaFinal.data?.length),
    );
  }
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exitCode = 1;
  });
