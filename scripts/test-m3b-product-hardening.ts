/**
 * MARCO 3B — provas das correções de endurecimento (query, rótulo, fetch,
 * ordenação, compartilhar, 404). Não refaz M3A.
 *
 * Sem fixture no banco. `encerrar()` devolve o código.
 */
import { resolverAlvo } from "./_alvo";

resolverAlvo("test-m3b-product-hardening");

import fs from "node:fs";
import path from "node:path";

import { encerrar } from "./_qa-conta";
import { rotuloFolhaOuFallback } from "../src/lib/categoria-visual";
import {
  diaDeQuery,
  ehUuid,
  filtroDeQuery,
  hrefBusca,
  idsParaConsulta,
  normalizarFiltroUrl,
  precisaCanonicalizar,
  queryPrecisaLimpeza,
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

function catalogo(): CatalogoUrl {
  return {
    segmentos: [
      { slug: "alimentacao", nome: "Alimentação" },
      { slug: "fitness", nome: "Fitness" },
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
        slug: "esportes",
        nome: "Esportes",
        segmentoSlug: "fitness",
        ativo: true,
      },
    ],
  };
}

function main(): number {
  console.log("\n=== M3B/A — query params não derrubam a rota ===\n");
  const cat = catalogo();
  check("1. ehUuid em não-string não joga", ehUuid(["fitness"] as unknown as string) === false);
  const repetido = filtroDeQuery({ seg: ["alimentacao", "fitness"] });
  check("2. ?seg= repetido pega o primeiro (determinístico)", repetido.seg === "alimentacao");
  const nRep = normalizarFiltroUrl(repetido, cat);
  check("3. o primeiro valor ainda canonicaliza", nRep.seg === "alimentacao" && !nRep.cat);
  check(
    "4. precisaCanonicalizar com array não joga",
    precisaCanonicalizar({ seg: ["alimentacao", "x"] as unknown as string }, nRep) === true,
  );

  const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const nUuid = normalizarFiltroUrl(filtroDeQuery({ seg: uuid, cat: uuid }), cat);
  check("5. UUID em seg/cat é ignorado", !nUuid.seg && !nUuid.cat);
  check("6. hrefBusca nunca coloca UUID", !hrefBusca({ seg: uuid, cat: "pizzaria" }).includes(uuid));

  check("7. query vazia ?seg= some", !filtroDeQuery({ seg: "   " }).seg);
  check("7b. ?seg= vazio na barra precisa de limpeza", queryPrecisaLimpeza({ seg: "" }) === true);
  check(
    "7c. ?seg=a&seg=b na barra precisa de limpeza",
    queryPrecisaLimpeza({ seg: ["alimentacao", "fitness"] }) === true,
  );
  check(
    "8. dia repetido inválido some",
    diaDeQuery(["nope", "Seg"], ["Seg", "Ter"] as const) === "Seg",
  );
  check(
    "9. seg inexistente não 500 — estado vazio",
    !normalizarFiltroUrl({ seg: "nao-existe" }, cat).seg,
  );

  console.log("\n=== M3B/B — rótulo nunca é UUID ===\n");
  check("10. nome vazio → Categoria", rotuloFolhaOuFallback("") === "Categoria");
  check("11. null → Categoria", rotuloFolhaOuFallback(null) === "Categoria");
  check("12. nome real preservado", rotuloFolhaOuFallback("Pizzaria") === "Pizzaria");
  const uuidLabel = rotuloFolhaOuFallback(undefined);
  check("13. fallback não parece UUID", !ehUuid(uuidLabel) && uuidLabel === "Categoria");

  console.log("\n=== M3B/C — estático: fetch, sort, share, 404, legado ===\n");
  const buscarPage = le("src/app/m/buscar/page.tsx");
  const home = le("src/app/m/page.tsx");
  const filtros = le("src/app/m/filtros/page.tsx");
  const buscarClient = le("src/app/m/buscar/buscar-client.tsx");
  const estab = le("src/lib/data/estab.ts");
  const cupomPage = le("src/app/m/cupom/[id]/page.tsx");
  const share = le("src/components/botao-compartilhar.tsx");
  const notFound = le("src/app/m/not-found.tsx");

  check(
    "14. /m/buscar não busca o catálogo duas vezes",
    buscarPage.includes("buscarFiltrosTaxonomia(") &&
      !buscarPage.includes("buscarFiltrosPublicos("),
  );
  check(
    "15. home e filtros também numa chamada só",
    home.includes("buscarFiltrosTaxonomia(") &&
      !home.includes("buscarFiltrosPublicos(") &&
      filtros.includes("buscarFiltrosTaxonomia(") &&
      !filtros.includes("buscarFiltrosPublicos("),
  );
  check("16. busca usa filtroDeQuery (array-safe)", buscarPage.includes("filtroDeQuery("));
  check(
    "16b. busca limpa query suja (array/vazio) sem 500",
    buscarPage.includes("queryPrecisaLimpeza("),
  );
  check(
    "16c. home e busca reusam o catálogo já carregado",
    home.includes("buscarGradeDestaque(") &&
      home.includes("filtroTax") &&
      buscarPage.includes("buscarCatalogoFiltrado("),
  );
  check(
    "17. busca ordena por economia real; perto de mim usa geo do dispositivo",
    buscarClient.includes("Maior economia") &&
      buscarClient.includes("b.economia - a.economia") &&
      !buscarClient.includes("Melhor avaliados") &&
      buscarClient.includes("Perto de mim") &&
      buscarClient.includes("TEXTO_GEO_NEGADO"),
  );
  check("18. busca textual tem aria-label", buscarClient.includes('aria-label="Pesquisar cupom"'));
  check(
    "19. compartilhar não é botão morto",
    cupomPage.includes("BotaoCompartilhar") && share.includes("navigator.share"),
  );
  check(
    "19b. compartilhar confirma visualmente (clipboard)",
    share.includes("Link copiado") && !share.includes("sr-only"),
  );
  check("20. 404 do /m é página de produto", notFound.includes("Não encontramos isso"));
  check(
    "20b. /e e /admin têm error boundary de produto",
    le("src/app/e/error.tsx").includes("Não foi possível carregar") &&
      le("src/app/admin/error.tsx").includes("Não foi possível carregar"),
  );
  check(
    "21. rótulo de estabelecimento não cai no UUID",
    estab.includes("rotuloFolhaOuFallback(") && !estab.includes("?? r.categoria_id"),
  );

  const srcFiles = [
    "src/lib/data/cupons.ts",
    "src/lib/data/estab.ts",
    "src/lib/data/taxonomia.ts",
    "src/lib/data/admin.ts",
    "src/lib/actions/cupons.ts",
    "src/lib/actions/admin.ts",
    "src/app/m/buscar/page.tsx",
  ];
  const leTodos = srcFiles.map(le).join("\n");
  check(
    "22. runtime listado não lê public.categorias",
    !leTodos.includes('.from("categorias")') && !leTodos.includes(".from('categorias')"),
  );
  const semJunçãoNova = leTodos.replace(/estabelecimento_categorias_novas/g, "JUNCAO_NOVA");
  check(
    "23. runtime listado não lê estabelecimento_categorias legado",
    !semJunçãoNova.includes('.from("estabelecimento_categorias")') &&
      leTodos.includes("estabelecimento_categorias_novas"),
  );
  check(
    "24. predicado da busca continua categoria_nova_id",
    le("src/lib/data/cupons.ts").includes('.in("categoria_nova_id"'),
  );
  check(
    "25. idsParaConsulta de par (seg,cat) devolve 1 UUID",
    idsParaConsulta({ seg: "alimentacao", cat: "pizzaria" }, cat)?.length === 1,
  );

  check(
    "26. action de criação grava categoria_nova_id, não o legado",
    le("src/lib/actions/cupons.ts").includes("categoria_nova_id: categoriaId") &&
      le("src/lib/actions/cupons.ts").includes("`categoria_id` legado NÃO é gravado"),
  );
  check(
    "27. modais do admin anunciam dialog",
    le("src/app/admin/(painel)/cupons/cupons-client.tsx").includes('role="dialog"') &&
      le("src/app/admin/(painel)/estabelecimentos/estab-client.tsx").includes(
        'role="dialog"',
      ),
  );

  check(
    "28. detalhe público não inventa endereço/WhatsApp",
    !cupomPage.toLowerCase().includes("lorem") &&
      !cupomPage.includes("989324802") &&
      !cupomPage.includes("wa.me"),
  );
  check(
    "29. ranking da home não importa mock-data",
    !le("src/components/ranking-block.tsx").includes('from "@/lib/mock-data"'),
  );
  check(
    "30. premiações não listam prêmio lorem",
    !le("src/app/m/premiacoes/page.tsx").toLowerCase().includes("lorem"),
  );
  check(
    "31. share só envia título + URL atual",
    share.includes("window.location.href") &&
      share.includes("navigator.share({ title: titulo, url })") &&
      !share.includes("token") &&
      !share.includes("password"),
  );
  check(
    "32. App Router tem global-error com html/body",
    le("src/app/global-error.tsx").includes("<html") &&
      le("src/app/global-error.tsx").includes("<body") &&
      le("src/app/global-error.tsx").includes("Sentry.captureException"),
  );
  check(
    "33. lista /m/estabelecimentos não mostra estrela mock",
    !le("src/app/m/estabelecimentos/page.tsx").includes("StarRating"),
  );
  const estabPage = le("src/app/m/estabelecimentos/page.tsx");
  const perfilPage = le("src/app/m/perfil/page.tsx");
  const notifPage = le("src/app/m/perfil/notificacoes/page.tsx");
  const pagtoPage = le("src/app/m/perfil/pagamento/page.tsx");
  const prefPage = le("src/app/m/perfil/preferencias/page.tsx");
  check(
    "34. /m/estabelecimentos não importa mock-data",
    !estabPage.includes('from "@/lib/mock-data"') &&
      estabPage.includes("buscarEstabelecimentosPublicos("),
  );
  check(
    "35. loader público lê estabelecimentos ativos do banco",
    estab.includes("export async function buscarEstabelecimentosPublicos") &&
      estab.includes('.from("estabelecimentos")') &&
      estab.includes('.eq("status", "ativo")') &&
      estab.includes("visualDe(") &&
      !estab.includes('.from("categorias")'),
  );
  check(
    "36. lista pública não reintroduz rating/estrela",
    !estabPage.includes("StarRating") &&
      !estabPage.includes("rating") &&
      !estabPage.includes("NotifyBell"),
  );
  check(
    "37. perfil não mostra contagem fake de notificação",
    !perfilPage.includes("não lidas") && !perfilPage.includes("nao lidas"),
  );
  check(
    "38. sem fonte real, notificações não inventam contagem nem persona",
    !notifPage.includes("não lidas") &&
      !notifPage.toLowerCase().includes("hortifresh") &&
      !notifPage.includes("GymPass") &&
      notifPage.includes("Nenhuma notificação"),
  );
  check(
    "39. pagamento não apresenta cartão fictício como cadastrado",
    !pagtoPage.includes("4821") &&
      !pagtoPage.includes("Cartão cadastrado") &&
      pagtoPage.includes("Nenhum cartão cadastrado"),
  );
  const prefForm = le("src/app/m/perfil/preferencias/preferencias-form.tsx");
  check(
    "40. preferências persistem de verdade, sem mock",
    !prefPage.includes('from "@/lib/mock-data"') &&
      prefForm.includes("salvarPreferenciasAction") &&
      prefForm.includes("Preferências salvas") &&
      prefPage.includes("buscarPreferenciasDaSessao"),
  );
  check(
    "41. href da lista de estabelecimentos reusa slugs, sem UUID",
    hrefBusca({ seg: "alimentacao" }, { base: "/m/estabelecimentos" }) ===
      "/m/estabelecimentos?seg=alimentacao" &&
      !hrefBusca(
        { seg: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
        { base: "/m/estabelecimentos" },
      ).includes("aaaaaaaa"),
  );

  const adminDash = le("src/app/admin/(painel)/page.tsx");
  const adminFin = le("src/app/admin/(painel)/financeiro/page.tsx");
  const portalEst = le("src/app/portal/(painel)/estabelecimento/page.tsx");
  check(
    "42. admin dashboard não apresenta KPI mock como real",
    !adminDash.includes('from "@/lib/mock-data"') &&
      !adminDash.includes("adminKpis") &&
      !adminDash.includes("em tempo real") &&
      adminDash.includes("Ainda não disponíveis"),
  );
  check(
    "42b. financeiro admin não apresenta MRR mock",
    !adminFin.includes('from "@/lib/mock-data"') &&
      !adminFin.includes("81,9") &&
      !adminFin.includes("81.900") &&
      adminFin.includes("ainda não estão no ar"),
  );
  check(
    "43. portal estabelecimento persiste a sessão, sem identidade hardcoded",
    !portalEst.includes("Sabor & Cia") &&
      !portalEst.includes('from "@/lib/mock-data"') &&
      portalEst.includes("buscarEstabelecimentoDaSessao") &&
      le("src/app/portal/(painel)/estabelecimento/estabelecimento-form.tsx").includes(
        "salvarPerfilEstabAction",
      ),
  );
  check(
    "44. estabelecimento do portal vem da sessão (owner_id)",
    estab.includes("function buscarEstabelecimentoDaSessao") &&
      /buscarEstabelecimentoDaSessao[\s\S]*\.eq\("owner_id", uid\)/.test(estab) &&
      !portalEst.includes("searchParams"),
  );
  check(
    "45. cupom inexistente não cai em getCupom/mock",
    !cupomPage.includes("getCupom") &&
      !cupomPage.includes('from "@/lib/mock-data"') &&
      cupomPage.includes("buscarCupomPorId") &&
      cupomPage.includes("notFound()"),
  );
  check(
    "46. runtime de produto listado aqui não reimporta mock-data",
    ![
      "src/app/admin/(painel)/page.tsx",
      "src/app/admin/(painel)/financeiro/page.tsx",
      "src/app/portal/(painel)/estabelecimento/page.tsx",
      "src/app/m/cupom/[id]/page.tsx",
    ].some((f) => le(f).includes('from "@/lib/mock-data"')),
  );

  const sidebar = le("src/components/sidebar.tsx");
  const portalLayout = le("src/app/portal/(painel)/layout.tsx");
  check(
    "47. sidebar do portal não hardcoda Sabor & Cia",
    !sidebar.includes("Sabor & Cia") && !sidebar.includes('"SC"'),
  );
  check(
    "47b. chrome do portal deriva identidade da sessão",
    portalLayout.includes("buscarEstabelecimentoDaSessao") &&
      !portalLayout.includes("searchParams") &&
      sidebar.includes("identidade"),
  );
  check(
    "47c. ausência de estabelecimento não inventa identidade",
    portalLayout.includes("Estabelecimento") &&
      !portalLayout.includes("Sabor") &&
      !portalLayout.includes("PowerFit"),
  );
  check(
    "47d. chrome do portal não aceita id livre de estabelecimento",
    !portalLayout.includes("searchParams") &&
      !sidebar.includes("searchParams") &&
      !sidebar.includes("estabelecimentoId"),
  );

  return encerrar(passed, failed);
}

process.exitCode = main();
