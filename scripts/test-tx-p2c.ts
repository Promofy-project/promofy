/**
 * TX-P2C — o catálogo 14x75 carregado pela migration NOVA
 * (20260830130000_tx_p2c_taxonomia_catalogo.sql) tem de ser IDÊNTICO à
 * fonte versionada (docs/taxonomia/catalogo-v1.json), e o de-para do
 * futuro cutover (docs/taxonomia/depara-v1.json) tem de ser
 * internamente consistente ANTES de qualquer código passar a lê-lo.
 *
 * Este arquivo é a ÚNICA fonte de verdade sobre o catálogo além dos
 * próprios JSONs — ele não duplica a lista de 75 categorias, apenas
 * lê os dois arquivos e cruza com o banco. Se o JSON e a migration
 * divergirem, os testes de banco (22-37) ficam vermelhos; se o de-para
 * apontar para algo que não existe no catálogo, os testes 38-51 ficam
 * vermelhos.
 *
 * P2B já prova as CONSTRAINTS do schema (unique, check, FK, RLS
 * granular) — este arquivo não repete aquilo. Aqui a pergunta é outra:
 * "o dado carregado é exatamente o dado versionado?"
 *
 * Suíte é somente-leitura sobre o catálogo real: os únicos INSERTs
 * tentados (anon/authenticated) são negados por ausência de grant
 * antes mesmo de qualquer validação de conteúdo, então nunca criam
 * linha — não há fixture para limpar no finally.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-tx-p2c");

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

function negado(r: { error: unknown }): boolean {
  return Boolean(r.error);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Mesmo vocabulário fechado de public.tema_visual (TX-P2B). */
const TEMAS = [
  "laranja", "verde", "grafite", "rosa", "roxo", "ciano", "violeta", "azul",
  "indigo", "ambar", "cinza", "vermelho", "terra", "amarelo",
] as const;

/** Os 14 slugs de segmento congelados pelo WP — não deriváveis do JSON, são o contrato. */
const SLUGS_SEGMENTO_CONGELADOS = [
  "alimentacao", "fitness", "automotivo", "beleza", "entretenimento", "turismo-hotelaria",
  "moda", "eletronicos", "educacao", "pet", "servicos", "saude", "casa-decoracao",
  "infantil-maternidade",
] as const;

/** Total de categorias por segmento — a contraprova de que a fonte não foi arredondada. */
const TOTAL_POR_SEGMENTO: Record<string, number> = {
  alimentacao: 10,
  fitness: 6,
  automotivo: 4,
  beleza: 5,
  entretenimento: 4,
  "turismo-hotelaria": 5,
  moda: 5,
  eletronicos: 6,
  educacao: 8,
  pet: 6,
  servicos: 4,
  saude: 5,
  "casa-decoracao": 4,
  "infantil-maternidade": 3,
};

/**
 * Contratos CONGELADOS do de-para — pequenos o bastante (6/6/14) para não violar a proibição de
 * duplicar as 75 categorias, e existem justamente para pegar um de-para que aponte para o
 * segmento/estabelecimento errado sem que o próprio de-para saiba disso. Comparar o banco e o
 * de-para SÓ entre si nunca pegaria os dois errados e concordando um com o outro — por isso os
 * dois são comparados de forma independente contra esta lista fixa.
 */
const LEGADO_PARA_SEGMENTO_ESPERADO: Record<string, string> = {
  alimentacao: "alimentacao",
  fitness: "fitness",
  beleza: "beleza",
  eletronicos: "eletronicos",
  educacao: "educacao",
  pet: "pet",
};

const IDS_ESTABELECIMENTOS_ESPERADOS = ["e1", "e2", "e3", "e4", "e5", "e6"] as const;

/** estabelecimentos.categoria_id (legado) esperado por estabelecimento — família, não a folha. */
const ESTABELECIMENTO_SEGMENTO_LEGADO_ESPERADO: Record<string, string> = {
  e1: "alimentacao",
  e2: "fitness",
  e3: "beleza",
  e4: "eletronicos",
  e5: "educacao",
  e6: "pet",
};

const NOMES_ESTABELECIMENTOS_ESPERADOS: Record<string, string> = {
  e1: "Sabor & Cia",
  e2: "PowerFit Academia",
  e3: "Studio Bella",
  e4: "TechMais Eletrônicos",
  e5: "Saber+ Cursos",
  e6: "Mundo Pet",
};

const IDS_CUPONS_ESPERADOS = [
  "c01", "c02", "c03", "c04", "c05", "c06", "c07", "c08", "c09", "c10", "c11", "c12",
  "p-campanha-esgotada", "p-campanha-expirada",
] as const;

/** titulo/estabelecimento_id/categoria_id(legado) esperados por cupom — de supabase/seed.sql. */
const CUPOM_SEED_ESPERADO: Record<string, { titulo: string; estabelecimento_id: string; categoria_legada: string }> = {
  "c01": { titulo: "Rodízio de pizza em dobro", estabelecimento_id: "e1", categoria_legada: "alimentacao" },
  "c02": { titulo: "20% off no almoço executivo", estabelecimento_id: "e1", categoria_legada: "alimentacao" },
  "c03": { titulo: "1 mês grátis na matrícula", estabelecimento_id: "e2", categoria_legada: "fitness" },
  "c04": { titulo: "Aula de spinning 2x1", estabelecimento_id: "e2", categoria_legada: "fitness" },
  "c05": { titulo: "Corte + escova com 40% off", estabelecimento_id: "e3", categoria_legada: "beleza" },
  "c06": { titulo: "Dia de noiva com brinde", estabelecimento_id: "e3", categoria_legada: "beleza" },
  "c07": { titulo: "Fone bluetooth com 35% off", estabelecimento_id: "e4", categoria_legada: "eletronicos" },
  "c08": { titulo: "Película + capa grátis na compra", estabelecimento_id: "e4", categoria_legada: "eletronicos" },
  "c09": { titulo: "Curso de inglês — 3 meses grátis", estabelecimento_id: "e5", categoria_legada: "educacao" },
  "c10": { titulo: "Mentoria de carreira 50% off", estabelecimento_id: "e5", categoria_legada: "educacao" },
  "c11": { titulo: "Banho & tosa leve 2x1", estabelecimento_id: "e6", categoria_legada: "pet" },
  "c12": { titulo: "Ração premium 25% off", estabelecimento_id: "e6", categoria_legada: "pet" },
  "p-campanha-esgotada": { titulo: "Combo casal + 2 sobremesas", estabelecimento_id: "e1", categoria_legada: "alimentacao" },
  "p-campanha-expirada": { titulo: "Rodízio com 30% off (almoço)", estabelecimento_id: "e1", categoria_legada: "alimentacao" },
};

interface CategoriaJson {
  id: string;
  slug: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  icon_override: string | null;
  tema_override: string | null;
}
interface SegmentoJson {
  id: string;
  slug: string;
  nome: string;
  icon: string;
  tema: string;
  ordem: number;
  ativo: boolean;
  categorias: CategoriaJson[];
}
interface CatalogoJson {
  versao: number;
  fonte: string;
  segmentos: SegmentoJson[];
}

interface EstabelecimentoDepara {
  id: string;
  nome: string;
  principal: { segmento_slug: string; categoria_slug: string };
  categorias: { segmento_slug: string; categoria_slug: string }[];
  remover_vinculo_legado_decorativo?: { categoria_legada: string }[];
}
interface CupomDepara {
  id: string;
  titulo: string;
  estabelecimento_id: string;
  folha: { segmento_slug: string; categoria_slug: string };
}
interface DeparaJson {
  versao: number;
  legado_para_segmento: { categoria_legada: string; segmento_slug: string }[];
  estabelecimentos: EstabelecimentoDepara[];
  cupons: CupomDepara[];
}

function carregarJson<T>(caminho: string): T {
  const abs = path.join(process.cwd(), caminho);
  return JSON.parse(fs.readFileSync(abs, "utf8")) as T;
}

async function main(): Promise<number> {
  const catalogo = carregarJson<CatalogoJson>("docs/taxonomia/catalogo-v1.json");
  const depara = carregarJson<DeparaJson>("docs/taxonomia/depara-v1.json");

  // Achatamento único do catálogo — todo o resto lê daqui, nunca relê o arquivo.
  const flatCategorias = catalogo.segmentos.flatMap((s) =>
    s.categorias.map((c) => ({ ...c, segmento_id: s.id, segmento_slug: s.slug })),
  );

  function resolverFolha(segmentoSlug: string, categoriaSlug: string) {
    const seg = catalogo.segmentos.find((s) => s.slug === segmentoSlug);
    if (!seg) return undefined;
    return seg.categorias.find((c) => c.slug === categoriaSlug);
  }

  console.log("\n=== TX-P2C/N — CATÁLOGO-V1.JSON: forma e conteúdo ===\n");

  check("1. versão = 1", catalogo.versao === 1, String(catalogo.versao));
  check("2. exatamente 14 segmentos", catalogo.segmentos.length === 14, String(catalogo.segmentos.length));
  check("3. exatamente 75 categorias", flatCategorias.length === 75, String(flatCategorias.length));

  const todosUuids = [
    ...catalogo.segmentos.map((s) => s.id),
    ...flatCategorias.map((c) => c.id),
  ];
  check("4. exatamente 89 UUIDs", todosUuids.length === 89, String(todosUuids.length));
  check("5. UUIDs todos válidos", todosUuids.every((u) => UUID_RE.test(u)));
  check("6. UUIDs todos únicos globalmente", new Set(todosUuids).size === todosUuids.length, `${new Set(todosUuids).size}/${todosUuids.length}`);

  const slugsSegmento = catalogo.segmentos.map((s) => s.slug);
  check("7. slugs de segmento válidos", slugsSegmento.every((s) => SLUG_RE.test(s)));
  check("8. slugs de segmento únicos", new Set(slugsSegmento).size === slugsSegmento.length);
  check(
    "9. exatamente os 14 slugs congelados",
    JSON.stringify([...slugsSegmento].sort()) === JSON.stringify([...SLUGS_SEGMENTO_CONGELADOS].sort()),
    slugsSegmento.join(","),
  );

  check("10. cada segmento possui nome não vazio", catalogo.segmentos.every((s) => s.nome.trim().length > 0));
  check("11. icon não vazio", catalogo.segmentos.every((s) => s.icon.trim().length > 0));
  check("12. tema pertence aos 14 tokens do domain", catalogo.segmentos.every((s) => (TEMAS as readonly string[]).includes(s.tema)));

  const ordensSegmento = catalogo.segmentos.map((s) => s.ordem).sort((a, b) => a - b);
  check(
    "13. ordem de segmento 1..14 sem empate",
    JSON.stringify(ordensSegmento) === JSON.stringify(Array.from({ length: 14 }, (_, i) => i + 1)),
    ordensSegmento.join(","),
  );

  // Cada categoria pertence a exatamente um segmento: nenhum id de categoria repete entre pais.
  const idsCategoriaVistos = new Map<string, number>();
  for (const c of flatCategorias) idsCategoriaVistos.set(c.id, (idsCategoriaVistos.get(c.id) ?? 0) + 1);
  check("14. cada categoria possui exatamente um pai", Array.from(idsCategoriaVistos.values()).every((n) => n === 1));

  check("15. categoria slug válido", flatCategorias.every((c) => SLUG_RE.test(c.slug)));
  check(
    "15b. cada uma das 75 categorias possui nome não vazio (JSON é válido por si só)",
    flatCategorias.every((c) => c.nome.trim().length > 0),
    JSON.stringify(flatCategorias.filter((c) => c.nome.trim().length === 0).map((c) => c.slug)),
  );

  const paresSegmentoSlug = flatCategorias.map((c) => `${c.segmento_id}::${c.slug}`);
  check("16. zero duplicata (segmento_id, slug)", new Set(paresSegmentoSlug).size === paresSegmentoSlug.length);

  const esportes = flatCategorias.filter((c) => c.slug === "esportes");
  check(
    "17. 'esportes' aparece exatamente duas vezes: fitness, educacao",
    esportes.length === 2 && JSON.stringify(esportes.map((c) => c.segmento_slug).sort()) === JSON.stringify(["educacao", "fitness"]),
    esportes.map((c) => c.segmento_slug).join(","),
  );

  const totalPorSegmentoReal: Record<string, number> = {};
  for (const s of catalogo.segmentos) totalPorSegmentoReal[s.slug] = s.categorias.length;
  check(
    "18. total por segmento exatamente conforme fonte",
    JSON.stringify(totalPorSegmentoReal) === JSON.stringify(TOTAL_POR_SEGMENTO),
    JSON.stringify(totalPorSegmentoReal),
  );

  // Ordem das categorias é 1..N POR SEGMENTO — sem 0, sem lacuna, sem duplicata, sem empate.
  // Separado do total por segmento: dois segmentos podem ter a contagem certa e ainda assim ter
  // ordens erradas (ex.: 1,2,2,4 tem length 4 e soma bate, mas está furado).
  const segmentosComOrdemRuim: string[] = [];
  for (const s of catalogo.segmentos) {
    const ordens = s.categorias.map((c) => c.ordem).sort((a, b) => a - b);
    const esperado = Array.from({ length: s.categorias.length }, (_, i) => i + 1);
    if (JSON.stringify(ordens) !== JSON.stringify(esperado)) {
      segmentosComOrdemRuim.push(`${s.slug}: [${ordens.join(",")}] != [${esperado.join(",")}]`);
    }
  }
  check("18b. ordem das categorias é 1..N sem lacuna/duplicata, em CADA segmento", segmentosComOrdemRuim.length === 0, segmentosComOrdemRuim.join("; "));

  check("19. todos ativos", catalogo.segmentos.every((s) => s.ativo) && flatCategorias.every((c) => c.ativo));
  check(
    "20. todas as 75 folhas com icon_override/tema_override null",
    flatCategorias.every((c) => c.icon_override === null && c.tema_override === null),
  );

  const outros = flatCategorias.filter((c) =>
    c.slug === "outros" || /^(outros|diversos|outras op(c|ç)(o|õ)es)$/i.test(c.nome.trim()),
  );
  check("21. zero 'Outros' no catálogo", outros.length === 0, JSON.stringify(outros));

  console.log("\n=== TX-P2C/O — BANCO: carregado é exatamente o versionado ===\n");

  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const usuario = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const login = await usuario.auth.signInWithPassword({
    email: "convidado@promofy.test",
    password: "promofy123",
  });
  const temSessao = !login.error && Boolean(login.data.session);

  const dbSeg = await svc.from("segmentos").select("id, slug, nome, icon, tema, ordem, ativo");
  const dbCat = await svc
    .from("categorias_novas")
    .select("id, segmento_id, slug, nome, ordem, ativo, icon_override, tema_override");

  check("22. segmentos no banco = 14", (dbSeg.data ?? []).length === 14, dbSeg.error?.message ?? String(dbSeg.data?.length));
  check("23. categorias_novas = 75", (dbCat.data ?? []).length === 75, dbCat.error?.message ?? String(dbCat.data?.length));

  const dbSegPorId = new Map((dbSeg.data ?? []).map((r) => [r.id as string, r]));
  const dbCatPorId = new Map((dbCat.data ?? []).map((r) => [r.id as string, r]));

  // Paridade EXATA de segmentos: todo campo persistido, não só um subconjunto. Cada divergência
  // vira uma entrada própria em vez de um booleano — "24" é o gate bloqueante (zero divergências
  // em QUALQUER campo), 25-29 são a mesma lista filtrada por campo, só para leitura rápida do log.
  const segmentosDivergentes: string[] = [];
  for (const s of catalogo.segmentos) {
    const r = dbSegPorId.get(s.id);
    if (!r) {
      segmentosDivergentes.push(`${s.slug}: ausente no banco`);
      continue;
    }
    if (r.nome !== s.nome) segmentosDivergentes.push(`${s.slug}: nome '${r.nome}' != '${s.nome}'`);
    if (r.slug !== s.slug) segmentosDivergentes.push(`${s.slug}: slug diverge`);
    if (r.icon !== s.icon) segmentosDivergentes.push(`${s.slug}: icon '${r.icon}' != '${s.icon}'`);
    if (r.tema !== s.tema) segmentosDivergentes.push(`${s.slug}: tema '${r.tema}' != '${s.tema}'`);
    if (r.ordem !== s.ordem) segmentosDivergentes.push(`${s.slug}: ordem ${r.ordem} != ${s.ordem}`);
    if (r.ativo !== s.ativo) segmentosDivergentes.push(`${s.slug}: ativo ${r.ativo} != ${s.ativo}`);
  }
  check(
    "24. PARIDADE EXATA — 14 segmentos no banco correspondem byte-semanticamente ao JSON (id, slug, nome, icon, tema, ordem, ativo)",
    segmentosDivergentes.length === 0,
    segmentosDivergentes.join("; "),
  );
  check("25. nome corresponde (segmentos)", !segmentosDivergentes.some((d) => d.includes("nome")));
  check("26. slug corresponde (segmentos)", !segmentosDivergentes.some((d) => d.includes("slug diverge")));
  check("27. ordem corresponde (segmentos)", !segmentosDivergentes.some((d) => d.includes("ordem")));
  check("28. tema corresponde (segmentos)", !segmentosDivergentes.some((d) => d.includes("tema")));
  check("29. icon corresponde (segmentos)", !segmentosDivergentes.some((d) => d.includes("icon")));
  check("29b. ativo corresponde (segmentos)", !segmentosDivergentes.some((d) => d.includes("ativo")));

  // Paridade EXATA das 75 folhas: todo campo persistido, incluindo os que o gate anterior
  // (só parent UUID) deixava passar batido — ativo, icon_override, tema_override.
  const categoriasDivergentes: string[] = [];
  for (const c of flatCategorias) {
    const r = dbCatPorId.get(c.id);
    if (!r) {
      categoriasDivergentes.push(`${c.segmento_slug}/${c.slug}: ausente no banco`);
      continue;
    }
    if (r.segmento_id !== c.segmento_id) categoriasDivergentes.push(`${c.slug}: parent UUID '${r.segmento_id}' != '${c.segmento_id}'`);
    if (r.slug !== c.slug) categoriasDivergentes.push(`${c.slug}: slug diverge`);
    if (r.nome !== c.nome) categoriasDivergentes.push(`${c.slug}: nome '${r.nome}' != '${c.nome}'`);
    if (r.ordem !== c.ordem) categoriasDivergentes.push(`${c.slug}: ordem ${r.ordem} != ${c.ordem}`);
    if (r.ativo !== c.ativo) categoriasDivergentes.push(`${c.slug}: ativo ${r.ativo} != ${c.ativo}`);
    if (r.icon_override !== c.icon_override) categoriasDivergentes.push(`${c.slug}: icon_override '${r.icon_override}' != '${c.icon_override}'`);
    if (r.tema_override !== c.tema_override) categoriasDivergentes.push(`${c.slug}: tema_override '${r.tema_override}' != '${c.tema_override}'`);
  }
  check(
    "30. PARIDADE EXATA — 75 categorias no banco correspondem EXATAMENTE ao JSON por UUID (segmento_id, slug, nome, ordem, ativo, icon_override, tema_override)",
    categoriasDivergentes.length === 0,
    categoriasDivergentes.join("; "),
  );
  check("30a. parent UUID corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("parent")));
  check("30b. slug corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("slug diverge")));
  check("30c. nome corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("nome")));
  check("30d. ordem corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("ordem")));
  check("30e. ativo corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("ativo")));
  check("30f. icon_override corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("icon_override")));
  check("30g. tema_override corresponde (categorias_novas)", !categoriasDivergentes.some((d) => d.includes("tema_override")));

  const idsJson = new Set(todosUuids);
  const idsDb = new Set(Array.from(dbSegPorId.keys()).concat(Array.from(dbCatPorId.keys())));
  const extraNoBanco = Array.from(idsDb).filter((id) => !idsJson.has(id));
  const faltandoNoBanco = Array.from(idsJson).filter((id) => !idsDb.has(id));
  check("31. zero linha extra no banco", extraNoBanco.length === 0, JSON.stringify(extraNoBanco));
  check("32. zero linha faltando no banco", faltandoNoBanco.length === 0, JSON.stringify(faltandoNoBanco));

  console.log("\n=== TX-P2C/O — BANCO: RLS (catálogo somente leitura) ===\n");

  const anonSeg = await anon.from("segmentos").select("id").limit(1);
  check("33. RLS anon consegue SELECT", !anonSeg.error, anonSeg.error?.message);
  check("33b. sessão authenticated comum obtida (convidado@)", temSessao, login.error?.message);
  if (temSessao) {
    const authSeg = await usuario.from("segmentos").select("id").limit(1);
    check("34. RLS authenticated consegue SELECT", !authSeg.error, authSeg.error?.message);
  }

  const anonIns = await anon
    .from("segmentos")
    .insert({ slug: "p2c-anon-hack", nome: "H", icon: "Star", tema: "azul", ordem: 999 });
  check("35. anon não ganhou INSERT", negado(anonIns), "insert passou!");
  if (temSessao) {
    const authIns = await usuario
      .from("segmentos")
      .insert({ slug: "p2c-auth-hack", nome: "H", icon: "Star", tema: "azul", ordem: 999 });
    check("36. authenticated comum não ganhou INSERT", negado(authIns), "insert passou!");
  }

  const primeiroSegId = catalogo.segmentos[0].id;
  const anonUpd = await anon.from("segmentos").update({ nome: "hack" }).eq("id", primeiroSegId);
  const anonDel = await anon.from("segmentos").delete().eq("id", primeiroSegId);
  check("37. UPDATE/DELETE continuam negados (anon)", negado(anonUpd) && negado(anonDel), `upd=${anonUpd.error?.message} del=${anonDel.error?.message}`);

  console.log("\n=== TX-P2C/P — DEPARA-V1.JSON: consistência interna ===\n");

  check("38. contém exatamente os 6 legados", depara.legado_para_segmento.length === 6, String(depara.legado_para_segmento.length));
  check(
    "39. todos os legados apontam para segmento existente",
    depara.legado_para_segmento.every((l) => catalogo.segmentos.some((s) => s.slug === l.segmento_slug)),
  );

  // 38 e 39 provam FORMA. Isto prova CONTEÚDO: o mapa é EXATAMENTE o congelado (nem a mais, nem a
  // menos, nem trocado) — comparado contra uma constante independente do de-para, não contra si
  // mesmo, senão um de-para autoconsistente e errado passaria.
  const legadoMapaReal: Record<string, string> = {};
  for (const l of depara.legado_para_segmento) legadoMapaReal[l.categoria_legada] = l.segmento_slug;
  check(
    "38b. mapa legado→segmento é EXATAMENTE o congelado (alimentacao,fitness,beleza,eletronicos,educacao,pet)",
    JSON.stringify(legadoMapaReal) === JSON.stringify(LEGADO_PARA_SEGMENTO_ESPERADO),
    JSON.stringify(legadoMapaReal),
  );

  // O de-para pode estar "certo" e ainda assim não bater com o banco real — por isso cruza com
  // public.categorias legado, não só com a constante acima.
  const dbCategoriasLegado = await svc.from("categorias").select("id");
  const idsLegadoDb = (dbCategoriasLegado.data ?? []).map((c) => c.id as string).sort();
  const idsLegadoEsperados = Object.keys(LEGADO_PARA_SEGMENTO_ESPERADO).sort();
  check(
    "38c. public.categorias legado no banco é EXATAMENTE o conjunto dos 6 (sem extra, sem faltando)",
    JSON.stringify(idsLegadoDb) === JSON.stringify(idsLegadoEsperados),
    dbCategoriasLegado.error?.message ?? `banco=[${idsLegadoDb.join(",")}]`,
  );

  check("40. contém exatamente os 6 estabelecimentos demo", depara.estabelecimentos.length === 6, String(depara.estabelecimentos.length));

  const idsEstabDepara = depara.estabelecimentos.map((e) => e.id).sort();
  check(
    "40b. IDs dos estabelecimentos são EXATAMENTE e1..e6 (sem duplicata, sem extra, sem faltando)",
    new Set(idsEstabDepara).size === 6 && JSON.stringify(idsEstabDepara) === JSON.stringify([...IDS_ESTABELECIMENTOS_ESPERADOS].sort()),
    idsEstabDepara.join(","),
  );

  const principaisInvalidas = depara.estabelecimentos.filter(
    (e) => !resolverFolha(e.principal.segmento_slug, e.principal.categoria_slug),
  );
  check("41. toda categoria PRINCIPAL existe no catálogo", principaisInvalidas.length === 0, JSON.stringify(principaisInvalidas.map((e) => e.id)));

  const secundariasInvalidas = depara.estabelecimentos.flatMap((e) =>
    e.categorias.filter((c) => !resolverFolha(c.segmento_slug, c.categoria_slug)).map((c) => `${e.id}:${c.segmento_slug}/${c.categoria_slug}`),
  );
  check("42. toda categoria SECUNDÁRIA existe no catálogo", secundariasInvalidas.length === 0, JSON.stringify(secundariasInvalidas));

  // Estabelecimentos do de-para CONTRA o seed real (não só contra o próprio JSON): id existe,
  // nome bate. Isto pegaria, por exemplo, um de-para que apontasse "e4" com o nome de "e5".
  const dbEstabelecimentos = await svc
    .from("estabelecimentos")
    .select("id, nome, categoria_id")
    .in("id", Array.from(IDS_ESTABELECIMENTOS_ESPERADOS));
  const dbEstabPorId = new Map((dbEstabelecimentos.data ?? []).map((r) => [r.id as string, r]));

  const estabAusentesOuNomeErrado: string[] = [];
  for (const id of IDS_ESTABELECIMENTOS_ESPERADOS) {
    const r = dbEstabPorId.get(id);
    const eDepara = depara.estabelecimentos.find((e) => e.id === id);
    if (!r) {
      estabAusentesOuNomeErrado.push(`${id}: ausente em public.estabelecimentos`);
      continue;
    }
    if (r.nome !== NOMES_ESTABELECIMENTOS_ESPERADOS[id]) {
      estabAusentesOuNomeErrado.push(`${id}: nome no banco '${r.nome}' != esperado '${NOMES_ESTABELECIMENTOS_ESPERADOS[id]}'`);
    }
    if (eDepara && eDepara.nome !== NOMES_ESTABELECIMENTOS_ESPERADOS[id]) {
      estabAusentesOuNomeErrado.push(`${id}: nome no de-para '${eDepara.nome}' != esperado '${NOMES_ESTABELECIMENTOS_ESPERADOS[id]}'`);
    }
  }
  check(
    "40c. os 6 estabelecimentos EXISTEM em public.estabelecimentos e o nome bate (de-para == banco == congelado)",
    estabAusentesOuNomeErrado.length === 0,
    dbEstabelecimentos.error?.message ?? estabAusentesOuNomeErrado.join("; "),
  );

  // Legado ATUAL do estabelecimento (estabelecimentos.categoria_id) contra a família que o
  // de-para está levando como principal — e os dois contra uma constante congelada
  // independente, para não migrar um estabelecimento do segmento errado silenciosamente.
  const segmentoLegadoDivergente: string[] = [];
  for (const id of IDS_ESTABELECIMENTOS_ESPERADOS) {
    const r = dbEstabPorId.get(id);
    const eDepara = depara.estabelecimentos.find((e) => e.id === id);
    const esperado = ESTABELECIMENTO_SEGMENTO_LEGADO_ESPERADO[id];
    if (r && r.categoria_id !== esperado) {
      segmentoLegadoDivergente.push(`${id}: banco.categoria_id '${r.categoria_id}' != esperado '${esperado}'`);
    }
    if (eDepara && eDepara.principal.segmento_slug !== esperado) {
      segmentoLegadoDivergente.push(`${id}: de-para.principal.segmento_slug '${eDepara.principal.segmento_slug}' != esperado '${esperado}'`);
    }
  }
  check(
    "40d. família legada de cada estabelecimento bate: banco.categoria_id == de-para.principal.segmento_slug == congelado",
    segmentoLegadoDivergente.length === 0,
    segmentoLegadoDivergente.join("; "),
  );

  const e1 = depara.estabelecimentos.find((e) => e.id === "e1");
  check(
    "43. e1 NÃO contém fitness (vínculo legado decorativo removido)",
    !!e1 && e1.categorias.every((c) => c.segmento_slug !== "fitness") && (e1.remover_vinculo_legado_decorativo ?? []).some((r) => r.categoria_legada === "fitness"),
    JSON.stringify(e1),
  );

  // A anotação de remoção só vira FATO quando o vínculo decorativo realmente existe hoje no
  // legado — senão "remover fitness" seria remover algo que já não está lá. READ-ONLY: só SELECT,
  // nada é apagado. Também confere que o vínculo real (e1, alimentacao) está intacto.
  const dbEstabCategoriasE1 = await svc
    .from("estabelecimento_categorias")
    .select("estabelecimento_id, categoria_id")
    .eq("estabelecimento_id", "e1");
  const paresE1 = (dbEstabCategoriasE1.data ?? []).map((r) => r.categoria_id as string);
  check(
    "43b. (e1, fitness) EXISTE hoje em estabelecimento_categorias (a remoção anotada tem algo real para remover)",
    paresE1.includes("fitness"),
    dbEstabCategoriasE1.error?.message ?? JSON.stringify(paresE1),
  );
  check(
    "43c. (e1, alimentacao) EXISTE hoje em estabelecimento_categorias (o vínculo que fica intacto)",
    paresE1.includes("alimentacao"),
    JSON.stringify(paresE1),
  );

  for (const [id, esperado] of [["e4", 2], ["e5", 2], ["e6", 2]] as const) {
    const e = depara.estabelecimentos.find((x) => x.id === id);
    const numero = id === "e4" ? 44 : id === "e5" ? 45 : 46;
    check(`${numero}. ${id} contém ${esperado} folhas`, e?.categorias.length === esperado, String(e?.categorias.length));
  }

  check("47. contém exatamente 14 cupons", depara.cupons.length === 14, String(depara.cupons.length));

  const idsCupons = depara.cupons.map((c) => c.id);
  check(
    "47b. os 14 IDs de cupom são EXATAMENTE o conjunto congelado (sem duplicata, sem extra, sem faltando)",
    new Set(idsCupons).size === 14 && JSON.stringify([...idsCupons].sort()) === JSON.stringify([...IDS_CUPONS_ESPERADOS].sort()),
    idsCupons.join(","),
  );

  const dbCupons = await svc.from("cupons").select("id, titulo, estabelecimento_id, categoria_id").in("id", idsCupons);
  const dbCupomPorId = new Map((dbCupons.data ?? []).map((c) => [c.id as string, c]));
  const idsNoBanco = new Set(Array.from(dbCupomPorId.keys()));
  const cuponsAusentes = idsCupons.filter((id) => !idsNoBanco.has(id));
  check("48. todos os cupom IDs existem no seed legado", cuponsAusentes.length === 0, dbCupons.error?.message ?? JSON.stringify(cuponsAusentes));

  // Cada cupom do de-para contra o SEED REAL (titulo, estabelecimento_id, categoria_id legado) —
  // não só contra o próprio de-para. Isto pega um cupom transferido para outro estabelecimento ou
  // outro segmento sem que o de-para acuse nada (ele concordaria consigo mesmo).
  const cuponsDivergentesDoSeed: string[] = [];
  for (const c of depara.cupons) {
    const r = dbCupomPorId.get(c.id);
    const esperado = CUPOM_SEED_ESPERADO[c.id];
    if (!r) {
      cuponsDivergentesDoSeed.push(`${c.id}: ausente no banco`);
      continue;
    }
    if (!esperado) {
      cuponsDivergentesDoSeed.push(`${c.id}: sem expectativa congelada (cupom não deveria estar no de-para)`);
      continue;
    }
    if (r.titulo !== esperado.titulo) cuponsDivergentesDoSeed.push(`${c.id}: titulo banco '${r.titulo}' != esperado '${esperado.titulo}'`);
    if (c.titulo !== esperado.titulo) cuponsDivergentesDoSeed.push(`${c.id}: titulo de-para '${c.titulo}' != esperado '${esperado.titulo}'`);
    if (r.estabelecimento_id !== esperado.estabelecimento_id) cuponsDivergentesDoSeed.push(`${c.id}: estabelecimento banco '${r.estabelecimento_id}' != esperado '${esperado.estabelecimento_id}'`);
    if (c.estabelecimento_id !== esperado.estabelecimento_id) cuponsDivergentesDoSeed.push(`${c.id}: estabelecimento de-para '${c.estabelecimento_id}' != esperado '${esperado.estabelecimento_id}'`);
    if (r.categoria_id !== esperado.categoria_legada) cuponsDivergentesDoSeed.push(`${c.id}: categoria_id legado banco '${r.categoria_id}' != esperado '${esperado.categoria_legada}'`);
    if (c.folha.segmento_slug !== esperado.categoria_legada) cuponsDivergentesDoSeed.push(`${c.id}: de-para.folha.segmento_slug '${c.folha.segmento_slug}' != categoria_id legado esperado '${esperado.categoria_legada}'`);
  }
  check(
    "48b. PARIDADE — cada cupom bate contra o seed real: titulo, estabelecimento_id e categoria_id legado == segmento da folha",
    cuponsDivergentesDoSeed.length === 0,
    cuponsDivergentesDoSeed.join("; "),
  );

  const folhasInvalidas = depara.cupons.filter((c) => !resolverFolha(c.folha.segmento_slug, c.folha.categoria_slug));
  check("49. todas as folhas de cupom existem no catálogo", folhasInvalidas.length === 0, JSON.stringify(folhasInvalidas.map((c) => c.id)));

  let cumprem50 = 0;
  const falhas50: string[] = [];
  for (const c of depara.cupons) {
    const est = depara.estabelecimentos.find((e) => e.id === c.estabelecimento_id);
    const pertence = !!est && est.categorias.some((cat) => cat.segmento_slug === c.folha.segmento_slug && cat.categoria_slug === c.folha.categoria_slug);
    if (pertence) cumprem50++;
    else falhas50.push(c.id);
  }
  check("50. 14/14 cupons: folha ∈ categorias do estabelecimento", cumprem50 === 14 && falhas50.length === 0, `${cumprem50}/14 — falhas: ${falhas50.join(",")}`);

  let cumprem51 = 0;
  const falhas51: string[] = [];
  for (const e of depara.estabelecimentos) {
    const pertence = e.categorias.some((c) => c.segmento_slug === e.principal.segmento_slug && c.categoria_slug === e.principal.categoria_slug);
    if (pertence) cumprem51++;
    else falhas51.push(e.id);
  }
  check("51. 6/6 estabelecimentos: principal ∈ categorias", cumprem51 === 6 && falhas51.length === 0, `${cumprem51}/6 — falhas: ${falhas51.join(",")}`);

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL\n`);
  return failed > 0 ? 1 : 0;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exitCode = 1;
  });
