/**
 * TX-P2A/TX-P2AF — a fronteira da taxonomia tem de ser INDISTINGUÍVEL do
 * acesso físico de hoje, E as duas metades da fronteira (filtro de
 * descoberta × categoria operacional) têm de ficar SEPARADAS mesmo
 * coincidindo hoje. A auditoria do TX-P2A achou uma função
 * `buscarCategorias()` genérica servindo as duas coisas — e depois do
 * cutover elas divergem (filtro vira segmento, operacional vira folha).
 * Esta suíte prova as duas propriedades: paridade com o legado E
 * separação entre as duas metades.
 *
 * Por isso a suíte é quase toda PARIDADE: para cada pergunta, compara o
 * resultado LEGADO (consulta física direta) com o da FRONTEIRA. Comparar
 * quantidade não bastaria — um filtro trocado devolveria a mesma contagem
 * com cupons errados —, então a comparação dos filtros é por CONJUNTO DE
 * IDs ordenado.
 *
 * A lógica de `src/lib/data/*` não é importável aqui (é `server-only`, e um
 * script Node fora do runtime do Next explode ao importá-la — mesma razão
 * documentada em test-tx-p1.ts). O que se testa é o CONTRATO DE BANCO que
 * aquele código consome, reproduzindo o predicado que ele emite. A seção H
 * é exceção deliberada: lê o CÓDIGO-FONTE (não o banco) para provar que
 * cada consumidor aponta para a metade certa da fronteira — é a prova
 * estrutural que a auditoria pediu para D.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-tx-p2a");

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const ordenado = (xs: string[]) => [...xs].sort().join(",");
const raiz = join(__dirname, "..");
const le = (rel: string) => readFileSync(join(raiz, rel), "utf8");

async function main() {
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const legado = await svc
    .from("categorias")
    .select("id, label, icon, gradiente, ordem")
    .order("ordem", { ascending: true });
  const L = legado.data ?? [];

  console.log("\n=== TX-P2A/A — paridade do catálogo de FILTROS ===\n");

  const filtros = await svc
    .from("catalogo_filtros")
    .select("slug, label, icon, gradiente, ordem")
    .order("ordem", { ascending: true });
  check("filtros: consulta sem erro", !filtros.error, filtros.error?.message);
  const F = filtros.data ?? [];

  check("filtros: mesma cardinalidade do legado", L.length === F.length, `legado=${L.length} filtros=${F.length}`);
  check(
    "filtros: mesma ORDEM de slugs (posição a posição)",
    L.map((c) => c.id).join(",") === F.map((c) => c.slug).join(","),
    `legado=[${L.map((c) => c.id)}] filtros=[${F.map((c) => c.slug)}]`,
  );
  const visualDivFiltro = F.find((f, i) => {
    const l = L[i];
    return !l || l.label !== f.label || l.icon !== f.icon || l.gradiente !== f.gradiente;
  });
  check("filtros: label/icon/gradiente idênticos ao legado", !visualDivFiltro, JSON.stringify(visualDivFiltro));

  console.log("\n=== TX-P2A/B — paridade do catálogo de CATEGORIAS operacionais ===\n");

  const categorias = await svc
    .from("catalogo_categorias")
    .select("categoria_id, slug, label, icon, gradiente, ordem")
    .order("ordem", { ascending: true });
  check("categorias: consulta sem erro", !categorias.error, categorias.error?.message);
  const C = categorias.data ?? [];

  check(
    "categorias: mesma cardinalidade do legado",
    L.length === C.length,
    `legado=${L.length} categorias=${C.length}`,
  );
  check(
    "categorias: categoria_id É o id físico (casa com cupons.categoria_id)",
    ordenado(L.map((c) => c.id)) === ordenado(C.map((c) => c.categoria_id as string)),
  );
  const visualDivCat = C.find((c) => {
    const l = L.find((x) => x.id === c.categoria_id);
    return !l || l.label !== c.label || l.icon !== c.icon || l.gradiente !== c.gradiente;
  });
  check("categorias: label/icon/gradiente idênticos ao legado", !visualDivCat, JSON.stringify(visualDivCat));

  // HOJE as duas views devolvem os mesmos slugs — é proposital (a mesma
  // tabela alimenta as duas). A suíte documenta isso explicitamente para
  // que ninguém leia "iguais hoje" como "podem virar uma view só":
  // depois do cutover catalogo_filtros vira segmento e catalogo_categorias
  // vira folha, e aí divergem em cardinalidade (14 vs ~75).
  check(
    "HOJE catalogo_filtros e catalogo_categorias têm os MESMOS slugs (proposital — não são a MESMA coisa, ver comentário)",
    ordenado(F.map((f) => f.slug as string)) === ordenado(C.map((c) => c.slug as string)),
  );

  console.log("\n=== TX-P2A/C — mapa categoria física -> filtro público (1:1 hoje) ===\n");

  const mapa = await svc.from("categoria_para_filtro").select("categoria_id, filtro_slug");
  check("mapa: consulta sem erro", !mapa.error, mapa.error?.message);
  const M = mapa.data ?? [];
  check(
    "mapa: cobre TODA categoria física (nenhum cupom fica órfão de visual)",
    ordenado(L.map((c) => c.id as string)) === ordenado(M.map((m) => m.categoria_id as string)),
  );
  check(
    "mapa: todo filtro_slug existe no catálogo de filtros",
    M.every((m) => F.some((f) => f.slug === m.filtro_slug)),
  );
  check(
    "mapa: HOJE é 1:1 (uma categoria física por filtro) — deixa de ser depois do cutover",
    new Set(M.map((m) => m.filtro_slug)).size === M.length,
  );

  const idsFisicosDoFiltro = (slug: string) =>
    M.filter((m) => m.filtro_slug === slug).map((m) => m.categoria_id as string);

  console.log("\n=== TX-P2A/D — PARIDADE POR IDs nos filtros reais (BLOQUEANTE) ===\n");

  async function cuponsLegado(cat?: string): Promise<string[]> {
    let q = svc.from("cupons").select("id").in("status", ["ativo", "indisponivel"]);
    if (cat) q = q.eq("categoria_id", cat); // o `.eq` de antes do TX-P2A
    const { data } = await q;
    return (data ?? []).map((r) => r.id as string);
  }
  async function cuponsFronteira(cat?: string): Promise<string[]> {
    let q = svc.from("cupons").select("id").in("status", ["ativo", "indisponivel"]);
    if (cat) q = q.in("categoria_id", idsFisicosDoFiltro(cat)); // o `.in` de agora
    const { data } = await q;
    return (data ?? []).map((r) => r.id as string);
  }

  const semFiltroL = await cuponsLegado();
  const semFiltroF = await cuponsFronteira();
  check(
    "filtro ausente: MESMO conjunto de IDs",
    ordenado(semFiltroL) === ordenado(semFiltroF),
    `${semFiltroL.length} vs ${semFiltroF.length}`,
  );

  for (const c of F) {
    const slug = c.slug as string;
    const a = await cuponsLegado(slug);
    const b = await cuponsFronteira(slug);
    check(
      `filtro "${slug}": MESMO conjunto de IDs (${a.length} cupons)`,
      ordenado(a) === ordenado(b),
      `legado=[${ordenado(a)}] fronteira=[${ordenado(b)}]`,
    );
  }

  let filtroQueNaoFiltra: string | null = null;
  for (const c of F) {
    const b = await cuponsFronteira(c.slug as string);
    if (b.length === semFiltroF.length && semFiltroF.length > 0) {
      filtroQueNaoFiltra = c.slug as string;
      break;
    }
  }
  check(
    "nenhum filtro devolve o catálogo inteiro (predicado realmente filtra)",
    filtroQueNaoFiltra === null,
    `slug=${filtroQueNaoFiltra}`,
  );

  console.log("\n=== TX-P2A/E — categoria inválida ===\n");

  const filtroIds = F.map((f) => f.slug as string);
  const categoriaValida = (cat: string | undefined) =>
    cat && filtroIds.includes(cat) ? cat : undefined;

  check("inválida: 'xpto' é saneado para undefined (sem filtro)", categoriaValida("xpto") === undefined);
  check("inválida: string vazia é saneada para undefined", categoriaValida("") === undefined);
  check("inválida: undefined segue undefined", categoriaValida(undefined) === undefined);
  check(
    "inválida: resultado é o catálogo INTEIRO, não zero",
    ordenado(await cuponsFronteira(categoriaValida("xpto"))) === ordenado(semFiltroF),
  );
  check("válida: slug real sobrevive ao saneamento", categoriaValida(filtroIds[0]) === filtroIds[0]);
  const zero = await svc
    .from("cupons")
    .select("id")
    .in("status", ["ativo", "indisponivel"])
    .in("categoria_id", []);
  check(
    "slug sem categoria física devolve ZERO (não o catálogo inteiro)",
    (zero.data ?? []).length === 0,
    `veio ${(zero.data ?? []).length}`,
  );

  console.log("\n=== TX-P2A/F — categorias permitidas do estabelecimento (junção intocada) ===\n");

  const { data: est } = await svc
    .from("estabelecimentos")
    .select("id, categoria_id")
    .eq("id", "e1")
    .maybeSingle();
  const { data: permitidas } = await svc
    .from("estabelecimento_categorias")
    .select("categoria_id, categorias(label)")
    .eq("estabelecimento_id", "e1");
  const conjunto = new Set((permitidas ?? []).map((r) => r.categoria_id as string));
  check("permitidas: e1 tem categorias vinculadas", conjunto.size > 0, `size=${conjunto.size}`);
  check(
    "permitidas: a principal do estabelecimento está no conjunto",
    !!est && conjunto.has(est.categoria_id as string),
  );
  check(
    "permitidas: label continua resolvendo pela junção",
    (permitidas ?? []).every((r) => !!(r.categorias as { label?: string } | null)?.label),
  );
  check(
    "permitidas: todo id permitido existe em catalogo_categorias (mesma chave física)",
    Array.from(conjunto).every((id) => C.some((c) => c.categoria_id === id)),
  );

  console.log("\n=== TX-P2A/G — segurança das três views ===\n");

  for (const view of ["catalogo_filtros", "catalogo_categorias", "categoria_para_filtro"] as const) {
    const r = await anon.from(view).select("*").limit(1);
    check(`anon LÊ ${view} (mesma leitura pública de hoje)`, !r.error, r.error?.message);
  }
  check(
    "anon vê o MESMO catálogo de filtros que o service_role",
    ordenado((await anon.from("catalogo_filtros").select("slug")).data?.map((r) => r.slug as string) ?? []) ===
      ordenado(filtroIds),
  );
  check(
    "anon vê o MESMO catálogo de categorias que o service_role",
    ordenado(
      (await anon.from("catalogo_categorias").select("categoria_id")).data?.map(
        (r) => r.categoria_id as string,
      ) ?? [],
    ) === ordenado(C.map((c) => c.categoria_id as string)),
  );

  // View simples é AUTO-ATUALIZÁVEL no Postgres: sem o revoke, um write na
  // view escreveria em public.categorias. Contraprova nas TRÊS views.
  const wInsFiltro = await anon
    .from("catalogo_filtros")
    .insert({ slug: "hack-p2af", label: "x", icon: "x", gradiente: "x" });
  check("anon NÃO insere em catalogo_filtros", !!wInsFiltro.error, "insert passou!");

  const wInsCat = await anon
    .from("catalogo_categorias")
    .insert({ categoria_id: "hack-p2af-2", slug: "x", label: "x", icon: "x", gradiente: "x" });
  check("anon NÃO insere em catalogo_categorias", !!wInsCat.error, "insert passou!");

  const wUpdFiltro = await anon.from("catalogo_filtros").update({ label: "hack" }).eq("slug", filtroIds[0]);
  check("anon NÃO atualiza catalogo_filtros", !!wUpdFiltro.error, "update passou!");

  const wUpdCat = await anon
    .from("catalogo_categorias")
    .update({ label: "hack" })
    .eq("categoria_id", filtroIds[0]);
  check("anon NÃO atualiza catalogo_categorias", !!wUpdCat.error, "update passou!");

  const wDelMapa = await anon.from("categoria_para_filtro").delete().eq("categoria_id", filtroIds[0]);
  check("anon NÃO deleta via categoria_para_filtro", !!wDelMapa.error, "delete passou!");

  const tabIns = await anon
    .from("categorias")
    .insert({ id: "hack-p2af-3", label: "x", icon: "x", gradiente: "x", ordem: 99 });
  check("anon NÃO escreve na tabela base categorias", !!tabIns.error, "insert passou!");

  const { data: sujeira } = await svc.from("categorias").select("id").like("id", "hack-p2af%");
  check("nenhuma escrita vazou para o banco", (sujeira ?? []).length === 0, `${(sujeira ?? []).length} linhas`);

  console.log("\n=== TX-P2A/H — prova ESTRUTURAL: cada consumidor usa a metade certa ===\n");

  // Consumidores de FILTRO: chamam buscarFiltrosPublicos/buscarFiltrosTaxonomia,
  // NUNCA buscarCatalogoCategorias.
  const consumidoresFiltro: [string, string][] = [
    ["src/app/m/page.tsx", "buscarFiltrosPublicos"],
    ["src/app/m/buscar/page.tsx", "buscarFiltrosPublicos"],
    ["src/app/m/filtros/page.tsx", "buscarFiltrosPublicos"],
    ["src/app/m/cupom/[id]/page.tsx", "buscarFiltrosPublicos"],
  ];
  for (const [arq, fn] of consumidoresFiltro) {
    const src = le(arq);
    check(`${arq}: chama ${fn}()`, src.includes(`${fn}(`), "não encontrado");
    check(`${arq}: NÃO chama buscarCatalogoCategorias`, !src.includes("buscarCatalogoCategorias"));
  }

  // Consumidores de CATEGORIA OPERACIONAL: chamam buscarCatalogoCategorias,
  // NUNCA buscarFiltrosPublicos/buscarFiltrosTaxonomia.
  const consumidoresOperacional: string[] = [
    "src/app/admin/(painel)/cupons/page.tsx",
    "src/app/admin/(painel)/estabelecimentos/page.tsx",
    "src/app/portal/(painel)/cupons/page.tsx",
  ];
  for (const arq of consumidoresOperacional) {
    const src = le(arq);
    check(`${arq}: chama buscarCatalogoCategorias()`, src.includes("buscarCatalogoCategorias("), "não encontrado");
    check(
      `${arq}: NÃO chama buscarFiltrosPublicos/buscarFiltrosTaxonomia`,
      !src.includes("buscarFiltrosPublicos") && !src.includes("buscarFiltrosTaxonomia"),
    );
  }

  // Nome ambíguo não pode voltar a existir em lugar nenhum do runtime.
  const semAmbiguo = ["src/lib/data/categorias.ts", "src/lib/data/taxonomia.ts", "src/lib/data/cupons.ts"].every(
    (arq) => !/\bexport (async )?function buscarCategorias\(/.test(le(arq)),
  );
  check("nenhum módulo reexporta um buscarCategorias() genérico", semAmbiguo);

  // /e/cupom (novo e editar) usa só a junção estabelecimento↔categoria —
  // não recebe filtro nem catálogo, então não pode citar nenhuma das duas
  // fronteiras de catálogo.
  for (const arq of ["src/app/e/cupom/novo/page.tsx", "src/app/e/cupom/[id]/editar/page.tsx"]) {
    const src = le(arq);
    check(
      `${arq}: não usa nenhuma fronteira de catálogo (só a junção)`,
      !src.includes("buscarFiltrosPublicos") &&
        !src.includes("buscarFiltrosTaxonomia") &&
        !src.includes("buscarCatalogoCategorias"),
    );
  }

  console.log("\n=== TX-P2A/I — sem N+1 ===\n");

  check("catálogo de filtros cabe em UMA consulta", F.length > 0 && F.length <= 200, `${F.length} linhas`);
  check("catálogo de categorias cabe em UMA consulta", C.length > 0 && C.length <= 200, `${C.length} linhas`);
  check("mapa cabe em UMA consulta", M.length > 0 && M.length <= 5000, `${M.length} linhas`);

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
