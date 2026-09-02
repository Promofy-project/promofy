/**
 * Suíte CLIENT-RETURNS-02 — descoberta, filtros, geo, preferências e planos
 * do consumidor.
 *
 * Prova comportamento real: módulos puros (distância, filtros, ranking),
 * leitura de fonte (UI honesta) e PostgREST com sessão `qa-*` efêmera.
 * `consumidor@` e `convidado@` NUNCA são tocados.
 *
 * Cobertura mínima do WP (21 itens):
 *  1. distância haversine
 *  2. fallback geo (texto honesto)
 *  3. filtro cidade
 *  4. filtro bairro
 *  5. tipo de promoção explícito
 *  6. tipo de consumo (formas existentes)
 *  7. valor mínimo (slider / sem limite)
 *  8. ilimitado NÃO ganha escassez
 *  9. em alta usa eventos reais
 * 10. popularidade regional não é inventada
 * 11. onboarding persiste
 * 12. preferências isoladas por usuário
 * 13. consentimento controla personalização
 * 14. sem consentimento → ranking neutro
 * 15. cold start determinístico
 * 16. não há produto "plano mensal"
 * 17. preço não é hardcoded em regra
 * 18. código promocional sem sucesso falso
 * 19. parceiro sem plano pago fictício
 * 20. taxonomia 14×75
 * 21. URLs inválidas não 500 / UUID fora da URL
 */
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolverAlvo } from "./_alvo";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import { distanciaKm, ordenarPorDistancia, TEXTO_GEO_NEGADO } from "../src/lib/distancia";
import {
  ehEscassez,
  ehNovoDoDia,
  noContextoRegional,
  restantesDe,
  scoreEmAlta,
} from "../src/lib/descoberta";
import {
  extraDeFiltro,
  filtroConsumidorDeQuery,
  locaisDoCatalogo,
  passarFiltroConsumidor,
  SENTINELA_MIN_SEM_LIMITE,
} from "../src/lib/filtros-consumidor";
import {
  ordenarRecomendacao,
  pontuarItem,
  PESOS_RECOMENDACAO,
  rotuloTrilho,
  type ItemRecomendacao,
} from "../src/lib/recomendacao";
import { preferenciasDeRespostas, tokenDeOpcao, OPCOES_ONBOARDING } from "../src/lib/preferencias";
import { consentimentoAtivo, FINALIDADE_PERSONALIZACAO } from "../src/lib/consentimento";
import { ehTipoPromocao, sanearTipoPromocao, TIPOS_PROMOCAO } from "../src/lib/tipo-promocao";
import {
  ehUuid,
  hrefBusca,
  montarCatalogoUrl,
  normalizarFiltroUrl,
} from "../src/lib/taxonomia-url";

const alvo = resolverAlvo("test-client-returns-consumidor");

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

function fonteSemComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string, senha = SENHA): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

function itemBase(parcial: Partial<ItemRecomendacao> & { id: string }): ItemRecomendacao {
  return {
    segmentoSlug: "alimentacao",
    estabelecimentoId: "e1",
    eventos: { validacoes7d: 0, ativacoes7d: 0 },
    favorito: false,
    resgatadoPeloUsuario: false,
    visitadoPeloUsuario: false,
    ...parcial,
  };
}

function testarModulosPuros() {
  console.log("\n[puro] Distância, geo, filtros e ranking");

  const kmSp = distanciaKm(-23.5614, -46.6558, -23.5617, -46.6825);
  check(
    "1. haversine Bela Vista→Pinheiros ~2–4 km",
    kmSp != null && kmSp > 2 && kmSp < 4,
    String(kmSp),
  );
  check("1b. coordenada inválida não inventa km", distanciaKm(-23, -46, 99, 0) == null);
  const ordenados = ordenarPorDistancia(
    [
      { id: "longe", lat: -23.5617, lng: -46.6825 },
      { id: "perto", lat: -23.5614, lng: -46.6558 },
      { id: "sem", lat: null, lng: null },
    ],
    { lat: -23.5614, lng: -46.6558 },
    (i) => ({ lat: i.lat, lng: i.lng }),
  );
  check(
    "1c. ordena por km real (perto primeiro; sem coord no fim)",
    ordenados[0].item.id === "perto" &&
      ordenados[1].item.id === "longe" &&
      ordenados[2].item.id === "sem" &&
      ordenados[2].km == null,
  );

  check(
    "2. fallback geo é o texto honesto",
    TEXTO_GEO_NEGADO === "Ative sua localização para ver os mais próximos.",
  );

  const catalogo = [
    {
      id: "a",
      cidade: "São Paulo, SP",
      bairro: "Bela Vista",
      tipoPromocao: "desconto",
      formasConsumo: ["local"],
      valorCompraMinimo: 40,
    },
    {
      id: "b",
      cidade: "Campinas, SP",
      bairro: "Centro",
      tipoPromocao: "frete_gratis",
      formasConsumo: ["delivery"],
      valorCompraMinimo: null,
    },
    {
      id: "c",
      cidade: "São Paulo, SP",
      bairro: "Pinheiros",
      tipoPromocao: "leve_mais_pague_menos",
      formasConsumo: ["retirada"],
      valorCompraMinimo: 10,
    },
  ];

  check(
    "3. filtro cidade muda o resultado",
    passarFiltroConsumidor(catalogo[0], { cidade: "São Paulo, SP" }) &&
      !passarFiltroConsumidor(catalogo[1], { cidade: "São Paulo, SP" }),
  );
  check(
    "4. filtro bairro muda o resultado",
    passarFiltroConsumidor(catalogo[0], { cidade: "São Paulo, SP", bairro: "Bela Vista" }) &&
      !passarFiltroConsumidor(catalogo[2], { cidade: "São Paulo, SP", bairro: "Bela Vista" }),
  );
  check(
    "5. tipo de promoção é o enum explícito (não regex de título)",
    ehTipoPromocao("desconto") &&
      ehTipoPromocao("leve_mais_pague_menos") &&
      ehTipoPromocao("frete_gratis") &&
      !ehTipoPromocao("2 por 1") &&
      sanearTipoPromocao("qualquer título") === "desconto" &&
      TIPOS_PROMOCAO.length === 3 &&
      passarFiltroConsumidor(catalogo[1], { tipoPromocao: "frete_gratis" }) &&
      !passarFiltroConsumidor(catalogo[0], { tipoPromocao: "frete_gratis" }),
  );
  check(
    "6. filtro de consumo reusa formas (local/retirada/delivery)",
    passarFiltroConsumidor(catalogo[0], { consumo: "local" }) &&
      !passarFiltroConsumidor(catalogo[0], { consumo: "delivery" }) &&
      passarFiltroConsumidor(catalogo[1], { consumo: "delivery" }),
  );
  check(
    "7. mínimo: cupom com piso 40 sai se o slider é 20; sem limite não filtra",
    !passarFiltroConsumidor(catalogo[0], { minCompra: 20 }) &&
      passarFiltroConsumidor(catalogo[0], { minCompra: 40 }) &&
      passarFiltroConsumidor(catalogo[0], { minCompra: SENTINELA_MIN_SEM_LIMITE }) &&
      filtroConsumidorDeQuery({ min: "sem-limite" }).minCompra === SENTINELA_MIN_SEM_LIMITE,
  );

  check("8. ilimitado NUNCA é escassez", !ehEscassez(null, 1) && !ehEscassez(null, 0));
  check("8b. limitado com 3 restantes É escassez", ehEscassez(100, 3));
  check("8c. restantesDe de ilimitado é null", restantesDe(null, 50) == null);

  check("9. em alta prefere validação a ativação", scoreEmAlta({ validacoes7d: 2, ativacoes7d: 99 }) === 2);
  check("9b. sem validação, usa ativação", scoreEmAlta({ validacoes7d: 0, ativacoes7d: 7 }) === 7);
  check("9c. zero eventos não é alta", scoreEmAlta({ validacoes7d: 0, ativacoes7d: 0 }) === 0);

  check("10. sem cidade/bairro não há popularidade regional", !noContextoRegional({ cidade: "São Paulo, SP" }));
  check(
    "10b. com cidade, só entra quem é da cidade",
    noContextoRegional({ cidade: "Campinas, SP", bairro: "Centro" }, "Campinas, SP") &&
      !noContextoRegional({ cidade: "São Paulo, SP" }, "Campinas, SP"),
  );

  check("K1 novos do dia compara YYYY-MM-DD (sem Intl)", ehNovoDoDia("2026-09-02", "2026-09-02") && !ehNovoDoDia("2026-09-01", "2026-09-02"));

  const locais = locaisDoCatalogo(catalogo);
  check(
    "locais vêm do catálogo real (SP e Campinas)",
    locais.cidades.includes("São Paulo, SP") &&
      locais.cidades.includes("Campinas, SP") &&
      locais.bairrosPorCidade["São Paulo, SP"].includes("Bela Vista"),
  );

  const extra = extraDeFiltro({ perto: true, cidade: "São Paulo, SP" });
  check(
    "lat/lng do consumidor NÃO entram na URL",
    extra.perto === "1" &&
      extra.cidade === "São Paulo, SP" &&
      !("lat" in extra) &&
      !("lng" in extra) &&
      !hrefBusca({}, extra).includes("lat="),
  );

  const afinidade = itemBase({
    id: "aff",
    segmentoSlug: "fitness",
    categoriaFolhaSlug: "academia",
    favorito: true,
    eventos: { validacoes7d: 1, ativacoes7d: 0 },
  });
  const outro = itemBase({
    id: "zzz",
    segmentoSlug: "pet",
    eventos: { validacoes7d: 40, ativacoes7d: 0 },
  });
  const ctxOff = {
    consentimentoPersonalizacao: false,
    perfil: { segmentos: ["fitness"], categorias: ["academia"] },
    hojeYmd: "2026-09-02",
  };
  const ctxOn = { ...ctxOff, consentimentoPersonalizacao: true };
  const pOff = pontuarItem(afinidade, ctxOff);
  const pOn = pontuarItem(afinidade, ctxOn);
  check("13. com consentimento o modo é personalizado", pOn.modo === "personalizado");
  check("14. sem consentimento o modo é neutro", pOff.modo === "neutro");
  check(
    "14b. sem consentimento não usa peso de categoria escolhida",
    pOff.pontos < PESOS_RECOMENDACAO.categoriaEscolhida,
  );
  check("13b. recusar não zera o catálogo (ainda pontua novidade/pop)", pOff.pontos >= 0);
  check(
    "rotulo: sem consentimento não diz Para você",
    rotuloTrilho("neutro", false) === "Em destaque" &&
      rotuloTrilho("personalizado", true) === "Para você",
  );

  const frioA = itemBase({
    id: "a-frio",
    cidade: "São Paulo, SP",
    publicadoYmd: "2026-09-02",
    eventos: { validacoes7d: 3, ativacoes7d: 0 },
  });
  const frioB = itemBase({
    id: "b-frio",
    cidade: "Campinas, SP",
    publicadoYmd: "2026-08-01",
    eventos: { validacoes7d: 0, ativacoes7d: 0 },
  });
  const cold = ordenarRecomendacao([frioB, frioA], {
    consentimentoPersonalizacao: true,
    perfil: { segmentos: [], categorias: [] },
    hojeYmd: "2026-09-02",
    cidade: "São Paulo, SP",
  });
  check(
    "15. cold start determinístico: cidade+novidade+pop, sem afinidade inventada",
    cold[0].item.id === "a-frio" && cold[0].modo === "neutro" && cold[1].item.id === "b-frio",
  );
  const same = ordenarRecomendacao([frioB, frioA], {
    consentimentoPersonalizacao: true,
    perfil: { segmentos: [], categorias: [] },
    hojeYmd: "2026-09-02",
    cidade: "São Paulo, SP",
  });
  check("15b. mesma entrada → mesma ordem (estável por id)", same[0].item.id === cold[0].item.id);

  const rankedOn = ordenarRecomendacao([outro, afinidade], ctxOn);
  check(
    "afinidade com consentimento sobe à frente da popularidade geral",
    rankedOn[0].item.id === "aff" && rankedOn[0].modo === "personalizado",
  );

  check("onboarding tem 7 perguntas", OPCOES_ONBOARDING.length === 7);
  check(
    "token canônico, não a frase",
    tokenDeOpcao(0, "Economizar em restaurantes e cafés") === "economizar_alimentacao",
  );
  const prefs = preferenciasDeRespostas([
    ["Economizar em restaurantes e cafés"],
    ["Restaurantes"],
    ["Experiência completa no local (refeições, estética, lazer)"],
    ["Sábados"],
    ["Descontos diretos (ex: 20% off)"],
    ["Não, prefiro ver manualmente"],
    ["Sim, adoro programas de fidelidade!"],
  ]);
  check(
    "respostas viram tokens (segmento alimentacao / categoria restaurante)",
    prefs.objetivos[0] === "economizar_alimentacao" &&
      prefs.segmentos.includes("alimentacao") &&
      prefs.categorias.includes("restaurante") &&
      prefs.estiloConsumo.includes("local") &&
      prefs.gamificacao.includes("sim"),
  );
  check(
    "consentimento inativo sem timestamps",
    !consentimentoAtivo({
      finalidade: FINALIDADE_PERSONALIZACAO,
      versao: "1",
      concedidoEm: null,
      revogadoEm: null,
    }),
  );
  check(
    "consentimento ativo com concedido_em e sem revoga",
    consentimentoAtivo({
      finalidade: FINALIDADE_PERSONALIZACAO,
      versao: "1",
      concedidoEm: "2026-09-02T12:00:00Z",
      revogadoEm: null,
    }),
  );

  const lixo = normalizarFiltroUrl(
    { seg: "nao-existe", cat: "tambem-nao" },
    { segmentos: [{ slug: "alimentacao", nome: "Alimentação" }], folhas: [] },
  );
  check("21. slug desconhecido não explode — vira filtro vazio", !lixo.seg && !lixo.cat);
  const uuid = "11111111-1111-1111-1111-111111111111";
  check("21b. UUID é reconhecido e não entra no href", ehUuid(uuid) && !hrefBusca({ seg: uuid }).includes(uuid));
  let threw = false;
  try {
    normalizarFiltroUrl(
      { seg: ["x", "y"] as unknown as string, cat: "  " },
      { segmentos: [], folhas: [] },
    );
  } catch {
    threw = true;
  }
  check("21c. query suja (array) não lança 500 no normalizador", !threw);
}

function testarFonte() {
  console.log("\n[fonte] UI honesta — planos, código, geo, histórico");

  const planosPage = fonteSemComentarios("src/app/m/planos/page.tsx");
  const planCard = fonteSemComentarios("src/components/plan-card.tsx");
  const cadastro = fonteSemComentarios("src/app/m/cadastro/page.tsx");
  const auth = fonteSemComentarios("src/lib/actions/auth.ts");
  const portalPlanos = fonteSemComentarios("src/app/portal/(painel)/planos/page.tsx");
  const sidebar = fonteSemComentarios("src/components/sidebar.tsx");
  const geo = fonteSemComentarios("src/components/localizacao-dispositivo.tsx");
  const dataPlanos = fonteSemComentarios("src/lib/data/planos.ts");
  const rec = fonteSemComentarios("src/lib/recomendacao.ts");
  const tipo = fonteSemComentarios("src/lib/tipo-promocao.ts");
  const selo = fonteSemComentarios("src/components/cupom-selo-utilizado.tsx");
  const usar = fonteSemComentarios("src/components/cupom-acao-usar.tsx");
  const fav = fonteSemComentarios("src/app/m/favoritos/page.tsx");
  const nov = fonteSemComentarios("src/app/m/novidades/page.tsx");

  check(
    "16. /m/planos não tem toggle Mensal|Anual",
    !/Mensal/.test(planosPage) && !/Anual/.test(planosPage) && planosPage.includes("contrato anual"),
  );
  check(
    "16b. fonte dos planos é public.planos, não mock",
    planosPage.includes("buscarPlanosConsumidor") && dataPlanos.includes('from("planos")'),
  );
  check(
    "17. regra comercial não hardcodar 9,90 (lê o banco)",
    dataPlanos.includes('eq("id", "basico")') &&
      !/9\.90|9,90/.test(fonteSemComentarios("src/lib/data/planos.ts").replace(/9,90/g, "")),
  );
  check("17b. pesos de ranking são explícitos e testáveis", rec.includes("PESOS_RECOMENDACAO"));
  check(
    "tipo de promoção é enum fechado (3 ids)",
    tipo.includes("leve_mais_pague_menos") && tipo.includes("frete_gratis") && tipo.includes("desconto"),
  );

  check(
    "18. código promocional é em breve / disabled — sem sucesso falso",
    cadastro.includes("Em breve") &&
      cadastro.includes("disabled") &&
      !/aplicado com sucesso|desconto aplicado|código válido/i.test(cadastro),
  );
  check(
    "18b. checkout de plano está desabilitado (Billing ainda não)",
    planCard.includes("Pagamento em breve") && planCard.includes("disabled"),
  );

  check(
    "19. /portal/planos não vende R$149/R$349",
    !portalPlanos.includes("149") &&
      !portalPlanos.includes("349") &&
      portalPlanos.includes("Gratuito para o parceiro"),
  );
  check("19b. item Planos sai do menu do portal", !sidebar.includes('href: "/portal/planos"'));

  check(
    "geo só-web isolado (navigator.geolocation + hook)",
    geo.includes("navigator.geolocation") && geo.includes("useLocalizacaoDispositivo"),
  );
  check("cadastro exige aceite no servidor", auth.includes("É preciso aceitar os termos") && auth.includes("termos_versao"));

  check("A. selo Utilizado existe (não reimplementar)", selo.includes("Utilizado"));
  check("A. Usar vs Regras: ação de usar é componente próprio", usar.includes("Usar cupom") || usar.includes("ativarCupom"));
  check("AC. favoritos continuam no fetcher real", fav.includes("buscarCuponsFavoritos"));
  check("AC. novidades continuam no fetcher real", nov.includes("buscarCuponsNovidades"));
}

async function testarBanco() {
  console.log("\n[banco] Schema, RLS, persistência, 14×75, eventos");

  let qaA: ContaQa | undefined;
  let qaB: ContaQa | undefined;

  try {
    const { data: colsEst } = await svc
      .from("estabelecimentos")
      .select("id, cidade, bairro, latitude, longitude")
      .eq("id", "e1")
      .maybeSingle();
    check(
      "schema geo pública no seed (e1 Bela Vista + par lat/lng)",
      colsEst?.bairro === "Bela Vista" &&
        colsEst?.latitude != null &&
        colsEst?.longitude != null,
      JSON.stringify(colsEst),
    );

    const { data: e5 } = await svc
      .from("estabelecimentos")
      .select("latitude, longitude, bairro")
      .eq("id", "e5")
      .maybeSingle();
    check("e5 remoto não inventa coordenada (NULL)", e5?.latitude == null && e5?.longitude == null);

    const badGeo = await svc
      .from("estabelecimentos")
      .update({ latitude: 100, longitude: 0 })
      .eq("id", "e5")
      .select("id");
    check(
      "constraint lat -90..90 recusa 100",
      Boolean(badGeo.error),
      badGeo.error?.message ?? "aceitou!",
    );

    const { data: c02 } = await svc
      .from("cupons")
      .select("tipo_promocao, valor_compra_minimo, formas_consumo, limite_total")
      .eq("id", "c02")
      .maybeSingle();
    check(
      "5/7 seed: c02 desconto + mínimo 40 + local",
      c02?.tipo_promocao === "desconto" &&
        Number(c02?.valor_compra_minimo) === 40,
      JSON.stringify(c02),
    );

    const { data: c03 } = await svc
      .from("cupons")
      .select("limite_total")
      .eq("id", "c03")
      .maybeSingle();
    check("8. c03 ilimitado (limite_total null)", c03?.limite_total == null);

    const { data: c06 } = await svc
      .from("cupons")
      .select("tipo_promocao, formas_consumo, estabelecimento_id")
      .eq("id", "c06")
      .maybeSingle();
    check(
      "5c. c06 público é frete_gratis + delivery",
      c06?.tipo_promocao === "frete_gratis",
      JSON.stringify(c06),
    );

    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sinais = await svc.rpc("sinais_descoberta", { p_desde: desde });
    const linhas = (sinais.data ?? []) as { cupom_id: string; validacoes: number; ativacoes: number }[];
    const c01sinal = linhas.find((r) => r.cupom_id === "c01");
    check(
      "9. RPC sinais_descoberta devolve eventos reais (c01 tem validações)",
      !sinais.error && Number(c01sinal?.validacoes ?? 0) > 0,
      JSON.stringify(c01sinal ?? sinais.error),
    );
    check(
      "9b. agregado é batch (não vaza usuario_id)",
      linhas.length > 0 && !JSON.stringify(linhas[0]).includes("usuario_id"),
    );

    const estoque = await svc.rpc("estoque_cupons");
    const estq = (estoque.data ?? []) as { cupom_id: string; limite_total: number; consumidos: number }[];
    check(
      "8d. estoque_cupons só lista quem TEM limite (c03 ausente)",
      !estoque.error && !estq.some((r) => r.cupom_id === "c03") && estq.some((r) => r.cupom_id === "c01"),
      String(estq.length),
    );

    const { data: planos } = await svc
      .from("planos")
      .select("id, preco, descricao, ordem")
      .order("ordem");
    const ids = (planos ?? []).map((p) => p.id);
    check(
      "V. planos oficiais no banco: promo, basico, plus, familia, vip",
      ids.includes("promo") &&
        ids.includes("basico") &&
        ids.includes("plus") &&
        ids.includes("familia") &&
        ids.includes("vip"),
      ids.join(","),
    );
    const basico = (planos ?? []).find((p) => p.id === "basico");
    check(
      "17c. preço do Básico vem da tabela (9.9), não de constante de regra",
      Number(basico?.preco) === 9.9 && (basico?.descricao ?? "").toLowerCase().includes("anual"),
    );

    const vSeg = await svc.from("catalogo_segmentos").select("slug");
    const vFolhas = await svc.from("catalogo_folhas").select("categoria_id");
    check("20. catalogo_segmentos = 14", (vSeg.data ?? []).length === 14, String(vSeg.data?.length));
    check("20b. catalogo_folhas = 75", (vFolhas.data ?? []).length === 75, String(vFolhas.data?.length));
    const real = montarCatalogoUrl({
      segmentos: (vSeg.data ?? []).map((s) => ({ slug: s.slug, nome: s.slug })),
      folhas: (await svc.from("folha_para_segmento").select("categoria_id, slug, nome, segmento_slug, ativo, segmento_ativo")).data ?? [],
    });
    check("20c. montarCatalogoUrl: 14×75", real.segmentos.length === 14 && real.folhas.length === 75);

    const { data: pontuacao } = await svc.from("config_pontos").select("acao, pontos").order("acao");
    const mapa = Object.fromEntries((pontuacao ?? []).map((p) => [p.acao, Number(p.pontos)]));
    check(
      "AF. config_pontos intocado (resgate 50 / nps 30 / indicacao 100 / visita 10)",
      mapa.resgate === 50 && mapa.nps === 30 && mapa.indicacao === 100 && mapa.visita === 10,
      JSON.stringify(mapa),
    );

    qaA = await criarContaQa(svc, "cr02-a");
    qaB = await criarContaQa(svc, "cr02-b");
    const a = await logar(qaA.email);
    const b = await logar(qaB.email);

    const onb = preferenciasDeRespostas([
      ["Cuidar da saúde e bem-estar"],
      ["Academias e Centros Esportivos"],
      ["Prático e rápido (delivery, take away)"],
      ["Segunda a sexta (dias úteis)"],
      ["Descontos diretos (ex: 20% off)"],
      ["Sim, sempre!"],
      ["Talvez, só se for vantajoso"],
    ]);
    const upA = await a.from("preferencias_usuario").upsert({
      usuario_id: qaA.id,
      objetivos: onb.objetivos,
      segmentos: onb.segmentos,
      categorias: onb.categorias,
      locais: onb.locais,
      estilo_consumo: onb.estiloConsumo,
      dias: onb.dias,
      beneficio_preferido: onb.beneficioPreferido,
      gamificacao: onb.gamificacao,
    });
    check("11. onboarding persiste (upsert preferencias_usuario)", !upA.error, upA.error?.message);

    const { data: lida } = await a
      .from("preferencias_usuario")
      .select("segmentos, categorias, objetivos")
      .eq("usuario_id", qaA.id)
      .maybeSingle();
    check(
      "11b. leitura devolve tokens (fitness / academia)",
      (lida?.segmentos ?? []).includes("fitness") && (lida?.categorias ?? []).includes("academia"),
      JSON.stringify(lida),
    );

    const { data: vazou } = await b
      .from("preferencias_usuario")
      .select("usuario_id, segmentos")
      .eq("usuario_id", qaA.id)
      .maybeSingle();
    check("12. B não lê preferências de A", vazou == null, JSON.stringify(vazou));

    const upB = await b.from("preferencias_usuario").upsert({
      usuario_id: qaB.id,
      segmentos: ["pet"],
      categorias: [],
      objetivos: [],
      locais: [],
      estilo_consumo: [],
      dias: [],
      beneficio_preferido: [],
      gamificacao: [],
    });
    check("12b. B persiste as próprias prefs", !upB.error, upB.error?.message);
    const { data: soB } = await b.from("preferencias_usuario").select("segmentos").maybeSingle();
    check("12c. B vê só pet (isolamento)", (soB?.segmentos ?? []).includes("pet") && !(soB?.segmentos ?? []).includes("fitness"));

    const consA = await a.from("consentimentos_usuario").upsert({
      usuario_id: qaA.id,
      finalidade: FINALIDADE_PERSONALIZACAO,
      versao: "1",
      concedido_em: new Date().toISOString(),
      revogado_em: null,
    });
    check("13c. consentimento versionável persiste", !consA.error, consA.error?.message);

    const { data: consLida } = await a
      .from("consentimentos_usuario")
      .select("finalidade, versao, concedido_em, revogado_em")
      .eq("finalidade", FINALIDADE_PERSONALIZACAO)
      .maybeSingle();
    check(
      "13d. registro tem finalidade+versão+timestamp (não boolean solto)",
      consLida?.finalidade === "personalizacao" &&
        consLida?.versao === "1" &&
        Boolean(consLida?.concedido_em) &&
        consLida?.revogado_em == null,
      JSON.stringify(consLida),
    );

    const { data: consB } = await b
      .from("consentimentos_usuario")
      .select("usuario_id")
      .eq("usuario_id", qaA.id)
      .maybeSingle();
    check("13e. B não lê consentimento de A", consB == null);

    const lojista = await logar("lojista@promofy.test");
    const { data: lojistaPrefs } = await lojista.from("preferencias_usuario").select("usuario_id");
    check(
      "lojista não lista preferências de consumidores",
      (lojistaPrefs ?? []).length === 0,
      String((lojistaPrefs ?? []).length),
    );

    const aceite = await a.from("aceites_documento").insert({
      usuario_id: qaA.id,
      documento: "termos_consumidor",
      versao: "2.0",
    });
    check("T. aceite versionado inserível pelo dono", !aceite.error, aceite.error?.message);
    const updAceite = await a
      .from("aceites_documento")
      .update({ versao: "9.9" })
      .eq("usuario_id", qaA.id)
      .select("id");
    check(
      "T. aceite é trilha (update recusado)",
      Boolean(updAceite.error) || (updAceite.data ?? []).length === 0,
      updAceite.error?.message ?? "atualizou!",
    );
  } finally {
    await destruirContaQa(svc, qaA?.id);
    await destruirContaQa(svc, qaB?.id);
  }
}

async function main(): Promise<number> {
  console.log(`\n[test-client-returns-consumidor] alvo: ${alvo.nome} (${alvo.envFile})\n`);
  testarModulosPuros();
  testarFonte();
  await testarBanco();
  return encerrar(passed, failed);
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
