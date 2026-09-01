/**
 * MARCO 3A — prova de que a UX pública/privada fala SEGMENTO → CATEGORIA
 * em cima do runtime 14×75, sem reintroduzir o legado e sem duplicar o
 * catálogo em arrays manuais.
 *
 * Não refaz test-m2-cutover nem test-m1-taxonomia: aquelas provam o
 * contrato no banco. Esta suíte prova a CAMADA DE PRODUTO (URL, filtros,
 * forms, admin/portal) e o módulo puro `src/lib/taxonomia-url.ts`.
 *
 * Fixtures: nenhuma. Tudo é leitura local + inspeção estática. `encerrar()`
 * devolve o código; quem chama decide sair.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-m3a-taxonomia-ux");

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { encerrar } from "./_qa-conta";
import { TEMA_CORES } from "../src/lib/tema-visual";
import {
  ehUuid,
  folhasAtivasDoSegmento,
  hrefBusca,
  idsParaConsulta,
  montarCatalogoUrl,
  normalizarFiltroUrl,
  precisaCanonicalizar,
  type CatalogoUrl,
} from "../src/lib/taxonomia-url";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

function le(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

/** Mini-catálogo de TESTE — não é a taxonomia de produto. */
function catalogoFixture(): CatalogoUrl {
  return {
    segmentos: [
      { slug: "alimentacao", nome: "Alimentação" },
      { slug: "fitness", nome: "Fitness" },
      { slug: "educacao", nome: "Educação" },
    ],
    folhas: [
      {
        uuid: "11111111-1111-4111-8111-111111111111",
        slug: "pizzaria",
        nome: "Pizzaria",
        segmentoSlug: "alimentacao",
        ativo: true,
      },
      {
        uuid: "22222222-2222-4222-8222-222222222222",
        slug: "academia",
        nome: "Academia",
        segmentoSlug: "fitness",
        ativo: true,
      },
      {
        uuid: "33333333-3333-4333-8333-333333333333",
        slug: "esportes",
        nome: "Esportes",
        segmentoSlug: "fitness",
        ativo: true,
      },
      {
        uuid: "44444444-4444-4444-8444-444444444444",
        slug: "esportes",
        nome: "Esportes",
        segmentoSlug: "educacao",
        ativo: true,
      },
      {
        uuid: "55555555-5555-4555-8555-555555555555",
        slug: "antiga",
        nome: "Antiga",
        segmentoSlug: "alimentacao",
        ativo: false,
      },
    ],
  };
}

async function main(): Promise<number> {
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ============================================================
  console.log("\n=== M3A/A — URL pura (sem banco) ===\n");
  // ============================================================
  const cat = catalogoFixture();

  check("1. busca aceita seg", hrefBusca({ seg: "alimentacao" }) === "/m/buscar?seg=alimentacao");
  check(
    "2. busca aceita seg+cat",
    hrefBusca({ seg: "alimentacao", cat: "pizzaria" }) ===
      "/m/buscar?seg=alimentacao&cat=pizzaria",
  );

  const nFolha = normalizarFiltroUrl({ seg: "alimentacao", cat: "pizzaria" }, cat);
  check("3. cat resolve UUID", idsParaConsulta(nFolha, cat)?.[0] === cat.folhas[0].uuid);

  check(
    "4. URL pública não usa UUID (hrefBusca descarta)",
    !hrefBusca({ seg: cat.folhas[0].uuid, cat: cat.folhas[0].uuid }).includes("11111111"),
  );
  check("5. ehUuid reconhece UUID", ehUuid(cat.folhas[0].uuid));

  const legado = normalizarFiltroUrl({ cat: "alimentacao" }, cat);
  check("6. formato legado ?cat=segmento vira ?seg=", legado.seg === "alimentacao" && !legado.cat);
  check(
    "7. legado precisa canonicalizar",
    precisaCanonicalizar({ cat: "alimentacao" }, legado),
  );

  const inconsistente = normalizarFiltroUrl({ seg: "fitness", cat: "pizzaria" }, cat);
  check(
    "8. combinação seg/cat inconsistente é normalizada (solta a cat)",
    inconsistente.seg === "fitness" && inconsistente.cat === undefined,
  );

  const ambiguo = normalizarFiltroUrl({ cat: "esportes" }, cat);
  check(
    "9. slug de folha ambíguo sem seg não adivinha",
    !ambiguo.seg && !ambiguo.cat,
  );
  check(
    "10. mesmo slug com seg certo resolve",
    normalizarFiltroUrl({ seg: "educacao", cat: "esportes" }, cat).cat === "esportes",
  );

  check(
    "11. folha inativa não aparece para seleção nova",
    folhasAtivasDoSegmento("alimentacao", cat).every((f) => f.slug !== "antiga") &&
      folhasAtivasDoSegmento("alimentacao", cat).some((f) => f.slug === "pizzaria"),
  );
  check(
    "12. folha inativa continua resolvendo filtro histórico",
    idsParaConsulta({ seg: "alimentacao", cat: "antiga" }, cat)?.[0] ===
      "55555555-5555-4555-8555-555555555555",
  );

  const uuidNaUrl = normalizarFiltroUrl({ cat: cat.folhas[0].uuid }, cat);
  check("13. UUID na query é ignorado", !uuidNaUrl.seg && !uuidNaUrl.cat);

  // ============================================================
  console.log("\n=== M3A/B — views locais 14×75 ===\n");
  // ============================================================
  const vSeg = await svc.from("catalogo_segmentos").select("slug, nome, icone, tema");
  const vFolhas = await svc
    .from("catalogo_folhas")
    .select("categoria_id, slug, nome, segmento_slug");
  const vMapa = await svc
    .from("folha_para_segmento")
    .select("categoria_id, slug, nome, segmento_slug, ativo, segmento_ativo");

  check("14. catalogo_segmentos = 14", (vSeg.data ?? []).length === 14, String(vSeg.data?.length));
  check("15. catalogo_folhas = 75", (vFolhas.data ?? []).length === 75, String(vFolhas.data?.length));
  check(
    "16. folha_para_segmento = 75",
    (vMapa.data ?? []).length === 75,
    String(vMapa.data?.length),
  );

  const real = montarCatalogoUrl({
    segmentos: vSeg.data ?? [],
    folhas: vMapa.data ?? [],
  });
  check("17. montarCatalogoUrl: 14 segmentos", real.segmentos.length === 14);
  check("18. montarCatalogoUrl: 75 folhas", real.folhas.length === 75);

  const idsAlim = idsParaConsulta({ seg: "alimentacao" }, real);
  check(
    "19. filtro real de segmento devolve UUIDs de categoria_nova_id",
    (idsAlim?.length ?? 0) > 1 && (idsAlim ?? []).every((id) => ehUuid(id)),
    String(idsAlim?.length),
  );
  const idsPizza = idsParaConsulta({ seg: "alimentacao", cat: "pizzaria" }, real);
  check("20. cat=pizzaria resolve 1 UUID", idsPizza?.length === 1, String(idsPizza?.length));

  const pizza = (vFolhas.data ?? []).find(
    (f) => f.slug === "pizzaria" && f.segmento_slug === "alimentacao",
  );
  check(
    "21. UUID de pizzaria bate com catalogo_folhas",
    Boolean(pizza?.categoria_id && idsPizza?.[0] === pizza.categoria_id),
  );

  // ============================================================
  console.log("\n=== M3A/B2 — slug duplicado `esportes` (catálogo real) ===\n");
  // ============================================================
  const folhasEsportes = (vFolhas.data ?? []).filter((f) => f.slug === "esportes");
  check(
    "48. `esportes` NÃO é slug de segmento (não cai no legado ?cat=segmento)",
    !real.segmentos.some((s) => s.slug === "esportes"),
  );
  check(
    "49. `esportes` existe em mais de um segmento no catálogo real",
    folhasEsportes.length >= 2,
    String(folhasEsportes.length),
  );
  const folhaFit = folhasEsportes.find((f) => f.segmento_slug === "fitness");
  const folhaEdu = folhasEsportes.find((f) => f.segmento_slug === "educacao");
  check("50. fitness/esportes existe", Boolean(folhaFit?.categoria_id));
  check("51. educacao/esportes existe", Boolean(folhaEdu?.categoria_id));
  check(
    "52. os dois UUIDs são diferentes",
    Boolean(folhaFit?.categoria_id && folhaEdu?.categoria_id) &&
      folhaFit!.categoria_id !== folhaEdu!.categoria_id,
  );

  const nFit = normalizarFiltroUrl({ seg: "fitness", cat: "esportes" }, real);
  const nEdu = normalizarFiltroUrl({ seg: "educacao", cat: "esportes" }, real);
  check(
    "53. fitness+esportes é um estado válido",
    nFit.seg === "fitness" && nFit.cat === "esportes",
    JSON.stringify(nFit),
  );
  check(
    "54. educacao+esportes é um estado válido",
    nEdu.seg === "educacao" && nEdu.cat === "esportes",
    JSON.stringify(nEdu),
  );

  const idsFit = idsParaConsulta({ seg: "fitness", cat: "esportes" }, real);
  const idsEdu = idsParaConsulta({ seg: "educacao", cat: "esportes" }, real);
  check(
    "55. fitness/esportes resolve a folha do segmento fitness",
    idsFit?.length === 1 && idsFit[0] === folhaFit?.categoria_id,
    `${idsFit?.[0]} vs ${folhaFit?.categoria_id}`,
  );
  check(
    "56. educacao/esportes resolve a folha do segmento educacao",
    idsEdu?.length === 1 && idsEdu[0] === folhaEdu?.categoria_id,
    `${idsEdu?.[0]} vs ${folhaEdu?.categoria_id}`,
  );
  check(
    "57. os predicados categoria_nova_id são UUIDs distintos",
    Boolean(idsFit?.[0] && idsEdu?.[0] && idsFit[0] !== idsEdu[0] && ehUuid(idsFit[0]) && ehUuid(idsEdu[0])),
  );

  const invertido: CatalogoUrl = { ...real, folhas: [...real.folhas].reverse() };
  const porUuid: CatalogoUrl = {
    ...real,
    folhas: [...real.folhas].sort((a, b) => (a.uuid < b.uuid ? 1 : -1)),
  };
  check(
    "58. inverter a ordem das folhas não troca fitness/esportes",
    idsParaConsulta({ seg: "fitness", cat: "esportes" }, invertido)?.[0] ===
      folhaFit?.categoria_id,
  );
  check(
    "59. ordenar por UUID desc não troca educacao/esportes",
    idsParaConsulta({ seg: "educacao", cat: "esportes" }, porUuid)?.[0] ===
      folhaEdu?.categoria_id,
  );

  const semSeg = normalizarFiltroUrl({ cat: "esportes" }, real);
  check(
    "60. ?cat=esportes sem seg NÃO escolhe uma das duas (estado vazio)",
    !semSeg.seg && !semSeg.cat,
    JSON.stringify(semSeg),
  );
  check(
    "61. ?cat=esportes sem seg não vira predicado (null = sem filtro, não a 1ª folha)",
    idsParaConsulta({ cat: "esportes" }, real) === null,
  );
  check(
    "62. a mesma recusa vale com o catálogo invertido (não depende de ordem)",
    !normalizarFiltroUrl({ cat: "esportes" }, invertido).cat &&
      idsParaConsulta({ cat: "esportes" }, invertido) === null,
  );

  // ============================================================
  console.log("\n=== M3A/C — estático: fonte, legado, forms ===\n");
  // ============================================================
  const home = le("src/app/m/page.tsx");
  const homeChips = le("src/components/home-category-chips.tsx");
  const taxonomia = le("src/lib/data/taxonomia.ts");
  const cuponsData = le("src/lib/data/cupons.ts");
  const buscarPage = le("src/app/m/buscar/page.tsx");
  const buscarClient = le("src/app/m/buscar/buscar-client.tsx");
  const eNovo = le("src/app/e/cupom/novo/page.tsx");
  const eEditar = le("src/app/e/cupom/[id]/editar/page.tsx");
  const eForm = le("src/app/e/cupom/novo/novo-cupom-form.tsx");
  const portalPage = le("src/app/portal/(painel)/cupons/page.tsx");
  const portalForm = le("src/components/portal/novo-cupom-form.tsx");
  const adminCupons = le("src/app/admin/(painel)/cupons/cupons-client.tsx");
  const adminEstab = le("src/app/admin/(painel)/estabelecimentos/estab-client.tsx");
  const actions = le("src/lib/actions/cupons.ts");
  const seletor = le("src/components/seletor-categoria-estab.tsx");
  const iconSrc = le("src/components/icon.tsx");
  const urlMod = le("src/lib/taxonomia-url.ts");

  check(
    "22. Home usa catalogo_segmentos (via buscarFiltrosPublicos/Taxonomia)",
    home.includes("buscarFiltrosPublicos(") &&
      (home.includes("buscarFiltrosTaxonomia(") || taxonomia.includes("catalogo_segmentos")),
  );
  check("23. chips da home apontam para /m/buscar?seg=", homeChips.includes("hrefBusca({ seg:"));
  check("24. chips da home NÃO filtram /m?cat=", !homeChips.includes("/m?cat="));
  check("25. busca aceita seg no server", buscarPage.includes("searchParams") && buscarPage.includes("seg"));
  check("26. busca aceita cat no server", buscarPage.includes("cat"));
  check("27. busca chama idsParaConsulta", buscarPage.includes("idsParaConsulta("));
  check(
    "28. filtro real consulta categoria_nova_id",
    cuponsData.includes('.in("categoria_nova_id"') || cuponsData.includes(".in(\"categoria_nova_id\""),
  );
  check(
    "29. buscarCuponsBusca NÃO filtra no cliente por c.categoria === cat",
    !buscarClient.includes("c.categoria === cat"),
  );
  check("30. URL canônica usa slug (hrefBusca)", urlMod.includes('p.set("seg"') && urlMod.includes('p.set("cat"'));
  check("31. formato legado continua no normalizarFiltroUrl", urlMod.includes("Legado Marco 2"));
  check(
    "32. create envia categoria_nova_id",
    actions.includes("categoria_nova_id: categoriaId") || actions.includes("categoria_nova_id: categoriaId,"),
  );
  check("33. edit envia categoria_nova_id", actions.includes("patch.categoria_nova_id = input.categoria"));
  check("34. criação /e só oferece folhas ativas", eNovo.includes(".filter(") && eNovo.includes("c.ativo"));
  check(
    "35. edição /e mantém a folha atual mesmo inativa",
    eEditar.includes("c.ativo || c.id === cupom.categoriaId"),
  );
  check("36. forms usam SeletorCategoriaEstab", eForm.includes("SeletorCategoriaEstab") && portalForm.includes("SeletorCategoriaEstab"));
  check(
    "37. folha inativa atual continua visível (copy de edição)",
    seletor.includes("Categoria atual — indisponível para novas seleções"),
  );
  check(
    "38. portal sem legado funcional (não filtra cupons.categoria_id)",
    !portalPage.includes("categoria_id legado") &&
      portalPage.includes("buscarCategoriasEstab") &&
      !portalPage.includes('.eq("categoria_id"'),
  );
  check(
    "39. admin cupons filtra pelo catálogo novo (segmentoSlug), não pelo legado",
    adminCupons.includes("segmentoSlug") && !adminCupons.includes("cupons.categoria_id"),
  );
  check(
    "40. admin estabelecimentos agrupa por segmento",
    adminEstab.includes("agruparPorSegmento") && adminEstab.includes("principal"),
  );
  check("41. recategorização: UI avisa, não duplica a regra", seletor.includes("reenvia o cupom para análise"));

  const icones14 = [
    "UtensilsCrossed",
    "Dumbbell",
    "Car",
    "Scissors",
    "Clapperboard",
    "Plane",
    "Shirt",
    "Smartphone",
    "GraduationCap",
    "PawPrint",
    "Wrench",
    "Stethoscope",
    "Sofa",
    "Baby",
  ];
  const iconesFaltando = icones14.filter((i) => !new RegExp(`\\n  ${i},`).test(iconSrc));
  check("42. 14 ícones de segmento no registry", iconesFaltando.length === 0, iconesFaltando.join(", "));
  check("43. 14 temas em TEMA_CORES", Object.keys(TEMA_CORES).length === 14);

  const arquivosApp = [
    "src/lib/taxonomia-url.ts",
    "src/lib/data/taxonomia.ts",
    "src/lib/data/cupons.ts",
    "src/lib/data/categorias.ts",
    "src/components/home-category-chips.tsx",
    "src/components/filtro-taxonomia-chips.tsx",
    "src/components/seletor-categoria-estab.tsx",
    "src/app/m/page.tsx",
    "src/app/m/buscar/page.tsx",
    "src/app/m/buscar/buscar-client.tsx",
    "src/app/m/filtros/page.tsx",
    "src/app/m/filtros/filtros-client.tsx",
  ];
  const paralela = arquivosApp.filter((arq) => /\[\s*["']alimentacao["']\s*,\s*["']fitness["']/.test(le(arq)));
  check("44. nenhuma lista paralela 14×75 criada nestes arquivos", paralela.length === 0, paralela.join(", "));

  check(
    "45. runtime continua em categoria_nova_id (não voltou categoria_id legado no predicado da busca)",
    cuponsData.includes("categoria_nova_id") &&
      !cuponsData.includes('.in("categoria_id"') &&
      !cuponsData.includes('.eq("categoria_id"'),
  );

  check(
    "46. a11y: aria-pressed nos chips de filtro",
    le("src/components/filtro-taxonomia-chips.tsx").includes("aria-pressed") &&
      le("src/app/m/filtros/filtros-client.tsx").includes("aria-pressed"),
  );
  check(
    "47. select de admin tem label associado",
    adminCupons.includes('htmlFor="admin-cupom-seg"') && adminCupons.includes('id="admin-cupom-seg"'),
  );
  check(
    "63. resolução de folha no predicado sempre casa slug E segmento",
    urlMod.includes("f.slug === n.cat && f.segmentoSlug === n.seg") &&
      urlMod.includes("f.slug === catIn && f.segmentoSlug === seg"),
  );
  check(
    "64. /m/buscar não resolve slug sozinho (só idsParaConsulta)",
    buscarPage.includes("idsParaConsulta(") &&
      !buscarPage.includes("folhas.find") &&
      !cuponsData.includes("f.slug ==="),
  );

  return encerrar(passed, failed);
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exitCode = 1;
  });
