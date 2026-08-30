/**
 * TX-P2B — o schema STAGING da taxonomia nova (segmento -> categoria
 * folha) tem de recusar por CONSTRAINT tudo o que a arquitetura proíbe,
 * antes de existir catálogo real dentro dele. A ordem é deliberada: o
 * DDL é auditado com dado de teste agora, para o TX-P2C carregar os
 * 14x75 num modelo já provado.
 *
 * Regra da casa que vale aqui: um verde vazio é pior que um vermelho.
 * Por isso todo teste negativo confere que a operação FALHOU de verdade
 * (`error` presente), nunca que ela "não retornou linha" — inserção
 * negada por grant e inserção negada por CHECK são coisas diferentes, e
 * o teste distingue as duas.
 *
 * TX-P2D1E canonicalizou o staging: `icon`/`icon_override`/`tema_override`
 * viraram `icone`/`icone`/`tema` (NULL continua significando "herdar do
 * segmento"), e `public.tema_visual` deixou de ser whitelist fechada nos
 * 14 tokens do seed — agora valida FORMATO (slug minúsculo, sem CSS).
 * Os testes que antes provavam "fora do vocabulário é NEGADO" com um
 * token sintaticamente válido (`turquesa`, `alimentacao`, `neon`) foram
 * INVERTIDOS para "é ACEITO" — não são mais casos negativos, são a prova
 * de que o domain não é mais uma lista fechada de produto. Isto não é
 * enfraquecer o teste: é seguir o contrato novo, que só rejeita FORMATO
 * inválido (vazio, CSS, maiúscula, espaço, hífen malformado, underscore),
 * nunca um token desconhecido mas bem formado.
 *
 * Fixtures usam prefixo `p2b-` e são removidos no `finally`. `encerrar()`
 * devolve o código e quem chama decide — `process.exit()` no meio pularia
 * o cleanup (armadilha já paga neste repo).
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-tx-p2b");

import { createClient } from "@supabase/supabase-js";

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

const PREFIXO = "p2b-";

/**
 * Vocabulário INICIAL de public.tema_visual — um token por segmento do
 * catálogo definitivo (§5.1, 14 segmentos / 75 folhas). NÃO é whitelist
 * do domain desde a TX-P2D1E — o domain valida FORMATO, não uma lista
 * fechada. Esta lista prova que os 14 tokens que o catálogo usa
 * continuam válidos pelo novo formato (contraprova de regressão), não
 * que o domain aceita SÓ estes 14.
 */
const TEMAS = [
  "laranja",   // Alimentação
  "verde",     // Fitness e Saúde
  "grafite",   // Automotivo
  "rosa",      // Beleza e Bem Estar
  "roxo",      // Entretenimento
  "ciano",     // Turismo e Hotelaria
  "violeta",   // Moda
  "azul",      // Eletrônicos
  "indigo",    // Educação
  "ambar",     // Pet
  "cinza",     // Serviços
  "vermelho",  // Saúde
  "terra",     // Casa e Decoração
  "amarelo",   // Infantil e Maternidade
] as const;

async function main(): Promise<number> {
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // authenticated COMUM (consumidor) — não é admin, não é service_role.
  const usuario = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const login = await usuario.auth.signInWithPassword({
    email: "convidado@promofy.test",
    password: "promofy123",
  });
  const temSessao = !login.error && Boolean(login.data.session);

  try {
    console.log("\n=== TX-P2B/A — SEGMENTOS: identidade e constraints ===\n");

    const segA = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}alfa`, nome: "Alfa", icone: "Star", tema: "azul", ordem: 1 })
      .select("id, slug, ativo, criado_em, atualizado_em")
      .single();
    check("1. insere segmento válido", !segA.error, segA.error?.message);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    check("2. id UUID gerado pelo banco", UUID_RE.test(segA.data?.id ?? ""), segA.data?.id);
    check("7. ativo default true", segA.data?.ativo === true, String(segA.data?.ativo));

    const dupSlug = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}alfa`, nome: "Alfa 2", icone: "Star", tema: "azul", ordem: 2 });
    check("3. slug de segmento duplicado é NEGADO (unique global)", negado(dupSlug));

    for (const [rotulo, slug] of [
      ["maiúscula", `${PREFIXO}Beta`],
      ["espaço à esquerda", ` ${PREFIXO}beta`],
      ["underscore", `${PREFIXO}beta_`],
      ["barra", `${PREFIXO}beta/x`],
      ["acento", `${PREFIXO}saude-bem-estar-ç`],
      ["vazio", ""],
      ["hífen duplo", `${PREFIXO}beta--x`],
      ["hífen no fim", `${PREFIXO}beta-`],
    ] as const) {
      const r = await svc
        .from("segmentos")
        .insert({ slug, nome: "X", icone: "Star", tema: "azul", ordem: 1 });
      check(`4. slug inválido (${rotulo}) é NEGADO`, negado(r), `slug=${JSON.stringify(slug)}`);
    }

    for (const [rotulo, valido] of [
      ["pizzarias", `${PREFIXO}pizzarias`],
      ["saude-bem-estar", `${PREFIXO}saude-bem-estar`],
      ["com dígito", `${PREFIXO}auto2`],
    ] as const) {
      const r = await svc
        .from("segmentos")
        .insert({ slug: valido, nome: "Válido", icone: "Star", tema: "verde", ordem: 3 });
      check(`4b. slug VÁLIDO (${rotulo}) é aceito`, !r.error, r.error?.message);
    }

    const nomeVazio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}nome-vazio`, nome: "   ", icone: "Star", tema: "azul", ordem: 1 });
    check("5. nome vazio/só espaço é NEGADO", negado(nomeVazio));

    const iconVazio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}icone-vazio`, nome: "X", icone: "  ", tema: "azul", ordem: 1 });
    check("5b. icone vazio é NEGADO", negado(iconVazio));

    const ordemNeg = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}ordem-neg`, nome: "X", icone: "Star", tema: "azul", ordem: -1 });
    check("6. ordem negativa é NEGADA", negado(ordemNeg));

    console.log("\n=== TX-P2B/B — VISUAL: token de tema, formato validado, NUNCA CSS (TX-P2D1E) ===\n");

    const temaCss = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-css`,
      nome: "X",
      icone: "Star",
      tema: "linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)",
      ordem: 1,
    });
    check("20. tema com CSS cru é NEGADO (é token, não gradiente)", negado(temaCss));

    // ANTES (TX-P2B): "fora do vocabulário fechado" era negado. DEPOIS (TX-P2D1E): o domain só
    // valida FORMATO — um slug bem formado mas fora do seed inicial é ACEITO. Isto é a prova de
    // que o domain não é mais uma whitelist de produto, e não uma regressão de rigor: CSS, hex,
    // rgb, maiúscula, espaço e hífen malformado continuam negados nos testes abaixo.
    const temaLivre = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-livre`, nome: "X", icone: "Star", tema: "turquesa", ordem: 1 });
    check(
      "20b. tema sintaticamente válido fora do vocabulário inicial ('turquesa') é ACEITO — domain não é whitelist fechada",
      !temaLivre.error,
      temaLivre.error?.message,
    );

    // O vocabulário inicial dos 14 continua válido pelo novo formato — contraprova de regressão,
    // não prova de que o domain aceita SÓ estes 14 (ver comentário do array TEMAS).
    for (let i = 0; i < TEMAS.length; i++) {
      const tema = TEMAS[i];
      const r = await svc.from("segmentos").insert({
        slug: `${PREFIXO}tema-${tema}`,
        nome: `Tema ${tema}`,
        icone: "Star",
        tema,
        ordem: 100 + i,
      });
      check(`20c. token do vocabulário inicial '${tema}' é ACEITO`, !r.error, r.error?.message);
    }

    const temaFuturo = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-futuro`,
      nome: "X",
      icone: "Star",
      tema: "tema-futuro",
      ordem: 1,
    });
    check(
      "20c2. token NOVO fora do seed inicial ('tema-futuro') é ACEITO — domain extensível sem migration de DDL",
      !temaFuturo.error,
      temaFuturo.error?.message,
    );

    const temaVazio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-vazio`, nome: "X", icone: "Star", tema: "", ordem: 1 });
    check("20d. tema string vazia é NEGADO", negado(temaVazio));

    const temaHex = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-hex`, nome: "X", icone: "Star", tema: "#FF8A3D", ordem: 1 });
    check("20e. tema com hex cru é NEGADO", negado(temaHex));

    const temaRgb = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-rgb`,
      nome: "X",
      icone: "Star",
      tema: "rgb(255, 138, 61)",
      ordem: 1,
    });
    check("20f. tema com rgb() cru é NEGADO", negado(temaRgb));

    // ANTES: "nome de segmento como tema" era negado por não estar no vocabulário fechado. O
    // domain de formato não distingue significado — 'alimentacao' é um slug válido como qualquer
    // outro. A distinção tema≠identidade-do-segmento agora é convenção de produto/documentação,
    // não mais uma regra que o schema force.
    const temaNomeSegmento = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-segmento`,
      nome: "X",
      icone: "Star",
      tema: "alimentacao",
      ordem: 1,
    });
    check(
      "20g. nome de segmento como tema ('alimentacao') é ACEITO — domain valida formato, não significado (TX-P2D1E)",
      !temaNomeSegmento.error,
      temaNomeSegmento.error?.message,
    );

    const temaCaixa = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-caixa`, nome: "X", icone: "Star", tema: "Azul", ordem: 1 });
    check("20h. token com caixa errada é NEGADO ('Azul')", negado(temaCaixa));

    const temaEspacoFim = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-espaco-fim`, nome: "X", icone: "Star", tema: "azul ", ordem: 1 });
    check("20i. token com espaço no FIM é NEGADO ('azul ')", negado(temaEspacoFim));

    const temaEspacoInicio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-espaco-inicio`, nome: "X", icone: "Star", tema: " azul", ordem: 1 });
    check("20j. token com espaço no INÍCIO é NEGADO (' azul')", negado(temaEspacoInicio));

    const temaUnderscore = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-underscore`, nome: "X", icone: "Star", tema: "tema_foo", ordem: 1 });
    check("20k. token com underscore é NEGADO ('tema_foo')", negado(temaUnderscore));

    const temaHifenInicio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-hifen-inicio`, nome: "X", icone: "Star", tema: "-tema", ordem: 1 });
    check("20l. token começando com hífen é NEGADO ('-tema')", negado(temaHifenInicio));

    const temaHifenFim = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-hifen-fim`, nome: "X", icone: "Star", tema: "tema-", ordem: 1 });
    check("20m. token terminando em hífen é NEGADO ('tema-')", negado(temaHifenFim));

    console.log("\n=== TX-P2B/C — CATEGORIAS FOLHA ===\n");

    const segAId = segA.data?.id as string;
    const segB = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}beta`, nome: "Beta", icone: "Heart", tema: "rosa", ordem: 2 })
      .select("id")
      .single();
    const segBId = segB.data?.id as string;

    const catA = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "pizzarias", nome: "Pizzarias", ordem: 1 })
      .select("id, ativo, icone, tema")
      .single();
    check("8. insere categoria folha válida", !catA.error, catA.error?.message);
    check("9. id UUID gerado pelo banco", UUID_RE.test(catA.data?.id ?? ""), catA.data?.id);
    check("19. icone/tema null é permitido (herda do segmento)", catA.data?.icone === null && catA.data?.tema === null);

    const fkFantasma = await svc.from("categorias_novas").insert({
      segmento_id: "00000000-0000-0000-0000-000000000000",
      slug: "orfa",
      nome: "Órfã",
      ordem: 1,
    });
    check("10. FK para segmento inexistente é NEGADA", negado(fkFantasma));

    const dupNoMesmo = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "pizzarias", nome: "Pizzarias 2", ordem: 2 });
    check("11. slug duplicado NO MESMO segmento é NEGADO", negado(dupNoMesmo));

    const mesmoSlugOutroSeg = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segBId, slug: "pizzarias", nome: "Pizzarias (Beta)", ordem: 1 });
    check(
      "12. MESMO slug em segmento DIFERENTE é PERMITIDO (escopo por segmento)",
      !mesmoSlugOutroSeg.error,
      mesmoSlugOutroSeg.error?.message,
    );

    // O caso que motiva o escopo: "outros" repetido entre segmentos.
    const outrosA = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "outros", nome: "Outros", ordem: 90 });
    const outrosB = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segBId, slug: "outros", nome: "Outros", ordem: 90 });
    check(
      "12b. 'outros' coexiste em dois segmentos (arquitetura não bloqueia a decisão de produto)",
      !outrosA.error && !outrosB.error,
      outrosA.error?.message ?? outrosB.error?.message,
    );

    const catSlugRuim = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "Pizzarias", nome: "X", ordem: 1 });
    check("13. slug de categoria inválido é NEGADO", negado(catSlugRuim));

    const catNomeVazio = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "nome-vazio", nome: "", ordem: 1 });
    check("14. nome de categoria vazio é NEGADO", negado(catNomeVazio));

    const catOrdemNeg = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "ordem-neg", nome: "X", ordem: -5 });
    check("15. ordem negativa em categoria é NEGADA", negado(catOrdemNeg));

    // ANTES: "fora do vocabulário" era negado. DEPOIS (TX-P2D1E): 'neon' é um slug bem formado,
    // então é ACEITO — mesma lógica de 20b/20g, agora para o campo `tema` de categorias_novas.
    const overrideInvalido = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "tema-neon",
      nome: "X",
      ordem: 1,
      tema: "neon",
    });
    check(
      "21. tema de categoria fora do vocabulário inicial ('neon') é ACEITO — mesmo domain extensível herdado do segmento",
      !overrideInvalido.error,
      overrideInvalido.error?.message,
    );

    const overrideVazio = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "icone-vazio",
      nome: "X",
      ordem: 1,
      icone: "   ",
    });
    check("21b. icone vazio é NEGADO (string vazia não é override)", negado(overrideVazio));

    const overrideValido = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "com-override",
      nome: "Com override",
      ordem: 5,
      icone: "Pizza",
      tema: "ambar",
    });
    check("19b. override VÁLIDO (icone/tema) é aceito", !overrideValido.error, overrideValido.error?.message);

    // tema em categoria usa o MESMO domain — a folha tem de poder assumir qualquer um dos 14 do
    // vocabulário inicial, não só o do próprio segmento (contraprova de regressão).
    for (let i = 0; i < TEMAS.length; i++) {
      const tema = TEMAS[i];
      const r = await svc.from("categorias_novas").insert({
        segmento_id: segAId,
        slug: `ov-${tema}`,
        nome: `Override ${tema}`,
        ordem: 200 + i,
        tema,
      });
      check(`21c. tema '${tema}' em categoria é ACEITO`, !r.error, r.error?.message);
    }

    const overrideStringVazia = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "ov-vazio",
      nome: "X",
      ordem: 1,
      tema: "",
    });
    check("21d. tema string vazia em categoria é NEGADO ('' não é herdar — herdar é NULL)", negado(overrideStringVazia));

    const overrideCss = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "ov-css",
      nome: "X",
      ordem: 1,
      tema: "linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)",
    });
    check("21e. tema com CSS cru em categoria é NEGADO", negado(overrideCss));

    const overrideMalformado = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "ov-malformado",
      nome: "X",
      ordem: 1,
      tema: "TEMA_RUIM",
    });
    check("21f. tema malformado em categoria é NEGADO ('TEMA_RUIM' — maiúscula + underscore)", negado(overrideMalformado));

    console.log("\n=== TX-P2B/D — DELETE e desativação ===\n");

    const delSegComCat = await svc.from("segmentos").delete().eq("id", segAId);
    check(
      "16. apagar segmento COM categoria é NEGADO (ON DELETE RESTRICT)",
      negado(delSegComCat),
      "delete passou — histórico ficaria órfão!",
    );

    const desativaCat = await svc
      .from("categorias_novas")
      .update({ ativo: false })
      .eq("id", catA.data?.id as string)
      .select("id, ativo")
      .single();
    check(
      "17. desativar categoria PRESERVA a linha",
      !desativaCat.error && desativaCat.data?.ativo === false,
      desativaCat.error?.message,
    );

    const desativaSeg = await svc
      .from("segmentos")
      .update({ ativo: false })
      .eq("id", segBId)
      .select("id, ativo")
      .single();
    check(
      "18. desativar segmento PRESERVA a linha",
      !desativaSeg.error && desativaSeg.data?.ativo === false,
      desativaSeg.error?.message,
    );

    // Contrato de RLS escolhido (A): linha desativada continua LEGÍVEL —
    // é o que impede o card de cupom histórico cair no fallback cinza.
    const leDesativada = await anon
      .from("categorias_novas")
      .select("id, ativo")
      .eq("id", catA.data?.id as string)
      .maybeSingle();
    check(
      "17b. anon AINDA LÊ categoria desativada (histórico não some — contrato A)",
      !leDesativada.error && leDesativada.data?.ativo === false,
      leDesativada.error?.message ?? "não voltou",
    );

    const relido = await svc
      .from("categorias_novas")
      .select("criado_em, atualizado_em")
      .eq("id", catA.data?.id as string)
      .single();
    check(
      "17c. trigger atualizou `atualizado_em` no update (reusa set_atualizado_em)",
      !!relido.data &&
        new Date(relido.data.atualizado_em as string) > new Date(relido.data.criado_em as string),
      JSON.stringify(relido.data),
    );

    console.log("\n=== TX-P2B/E — SEGURANÇA: catálogo é somente leitura ===\n");

    const anonSegSel = await anon.from("segmentos").select("id").limit(1);
    check("22. anon SELECT em segmentos é PERMITIDO", !anonSegSel.error, anonSegSel.error?.message);
    const anonCatSel = await anon.from("categorias_novas").select("id").limit(1);
    check("22b. anon SELECT em categorias_novas é PERMITIDO", !anonCatSel.error, anonCatSel.error?.message);

    check("23. sessão authenticated comum obtida (convidado@)", temSessao, login.error?.message);
    if (temSessao) {
      const authSeg = await usuario.from("segmentos").select("id").limit(1);
      check("23b. authenticated SELECT em segmentos é PERMITIDO", !authSeg.error, authSeg.error?.message);
      const authCat = await usuario.from("categorias_novas").select("id").limit(1);
      check("23c. authenticated SELECT em categorias_novas é PERMITIDO", !authCat.error, authCat.error?.message);
    }

    const anonInsSeg = await anon
      .from("segmentos")
      .insert({ slug: `${PREFIXO}hack`, nome: "H", icone: "Star", tema: "azul", ordem: 1 });
    check("24. anon INSERT segmentos é NEGADO", negado(anonInsSeg), "insert passou!");

    const anonInsCat = await anon
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "hack", nome: "H", ordem: 1 });
    check("24b. anon INSERT categorias_novas é NEGADO", negado(anonInsCat), "insert passou!");

    const anonUpdSeg = await anon.from("segmentos").update({ nome: "hack" }).eq("id", segAId);
    check("25. anon UPDATE segmentos é NEGADO", negado(anonUpdSeg), "update passou!");
    const anonUpdCat = await anon
      .from("categorias_novas")
      .update({ nome: "hack" })
      .eq("id", catA.data?.id as string);
    check("25b. anon UPDATE categorias_novas é NEGADO", negado(anonUpdCat), "update passou!");

    const anonDelSeg = await anon.from("segmentos").delete().eq("id", segAId);
    check("26. anon DELETE segmentos é NEGADO", negado(anonDelSeg), "delete passou!");
    const anonDelCat = await anon.from("categorias_novas").delete().eq("id", catA.data?.id as string);
    check("26b. anon DELETE categorias_novas é NEGADO", negado(anonDelCat), "delete passou!");

    if (temSessao) {
      const authIns = await usuario
        .from("segmentos")
        .insert({ slug: `${PREFIXO}hack2`, nome: "H", icone: "Star", tema: "azul", ordem: 1 });
      check("27. authenticated comum INSERT é NEGADO", negado(authIns), "insert passou!");
      const authInsCat = await usuario
        .from("categorias_novas")
        .insert({ segmento_id: segAId, slug: "hack2", nome: "H", ordem: 1 });
      check("27b. authenticated comum INSERT em categorias_novas é NEGADO", negado(authInsCat), "insert passou!");

      const authUpd = await usuario.from("segmentos").update({ nome: "hack" }).eq("id", segAId);
      check("28. authenticated comum UPDATE é NEGADO", negado(authUpd), "update passou!");
      const authUpdCat = await usuario
        .from("categorias_novas")
        .update({ nome: "hack" })
        .eq("id", catA.data?.id as string);
      check("28b. authenticated comum UPDATE em categorias_novas é NEGADO", negado(authUpdCat), "update passou!");

      const authDel = await usuario.from("segmentos").delete().eq("id", segAId);
      check("29. authenticated comum DELETE é NEGADO", negado(authDel), "delete passou!");
      const authDelCat = await usuario
        .from("categorias_novas")
        .delete()
        .eq("id", catA.data?.id as string);
      check("29b. authenticated comum DELETE em categorias_novas é NEGADO", negado(authDelCat), "delete passou!");
    }

    // Contraprova de que as negações acima não foram "0 linhas por RLS":
    // nada mudou de verdade.
    const intacto = await svc.from("segmentos").select("nome").eq("id", segAId).single();
    check("30. nenhuma escrita negada vazou (segmento segue com nome original)", intacto.data?.nome === "Alfa", intacto.data?.nome);

    console.log("\n=== TX-P2B/F — LEGADO INTOCADO ===\n");

    const legado = await svc.from("categorias").select("id").order("id");
    check(
      "31. public.categorias legado continua com as 6 linhas de sempre",
      (legado.data ?? []).length === 6,
      `veio ${(legado.data ?? []).length}`,
    );
    const cupomLegado = await svc.from("cupons").select("categoria_id").limit(1).single();
    check(
      "32. cupons.categoria_id continua sendo o slug legado (text), não UUID",
      typeof cupomLegado.data?.categoria_id === "string" && !UUID_RE.test(cupomLegado.data.categoria_id),
      String(cupomLegado.data?.categoria_id),
    );

    console.log("\n=== TX-P2B/G — REPARENTING: segmento_id incondicionalmente imutável (TX-P2D1E) ===\n");

    const segC = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}reparent-c`, nome: "Reparent C", icone: "Star", tema: "azul", ordem: 300 })
      .select("id")
      .single();
    const segD = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}reparent-d`, nome: "Reparent D", icone: "Star", tema: "verde", ordem: 301 })
      .select("id")
      .single();
    check("35. cria segmentos C e D para o teste de reparenting", !segC.error && !segD.error, segC.error?.message ?? segD.error?.message);
    const segCId = segC.data?.id as string;
    const segDId = segD.data?.id as string;

    const folhaReparent = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segCId, slug: "folha-reparent", nome: "Folha Reparent", ordem: 1 })
      .select("id, segmento_id")
      .single();
    check("36. cria folha em C", !folhaReparent.error, folhaReparent.error?.message);
    const folhaReparentId = folhaReparent.data?.id as string;

    // service_role — não é anon, não é authenticated comum, é o papel mais privilegiado que o
    // PostgREST expõe. Se o trigger bloqueia até para ele, bloqueia para qualquer um.
    const tentativaReparent = await svc
      .from("categorias_novas")
      .update({ segmento_id: segDId })
      .eq("id", folhaReparentId);
    check(
      "37. service_role tenta trocar segmento_id C→D — UPDATE FALHA incondicionalmente",
      negado(tentativaReparent),
      "update passou! reparenting não deveria ser possível para NINGUÉM",
    );

    const posReparent = await svc
      .from("categorias_novas")
      .select("segmento_id")
      .eq("id", folhaReparentId)
      .single();
    check(
      "38. segmento_id permanece C após a tentativa negada (nenhuma mutação vazou)",
      posReparent.data?.segmento_id === segCId,
      posReparent.data?.segmento_id,
    );

    const updateNormal = await svc
      .from("categorias_novas")
      .update({ nome: "Folha Reparent Renomeada", ativo: false })
      .eq("id", folhaReparentId)
      .select("id, nome, ativo, segmento_id, criado_em, atualizado_em")
      .single();
    check(
      "39. UPDATE de nome/ativo SEM tocar segmento_id FUNCIONA normalmente",
      !updateNormal.error &&
        updateNormal.data?.nome === "Folha Reparent Renomeada" &&
        updateNormal.data?.ativo === false &&
        updateNormal.data?.segmento_id === segCId,
      updateNormal.error?.message,
    );
    check(
      "40. atualizado_em avança no update normal (trigger de auditoria não foi afetado pelo novo trigger)",
      !!updateNormal.data &&
        new Date(updateNormal.data.atualizado_em as string) > new Date(updateNormal.data.criado_em as string),
      JSON.stringify(updateNormal.data),
    );

    // Contraprova fina: um UPDATE que INCLUI segmento_id no SET mas com o MESMO valor não deve
    // disparar a exceção — a trigger function usa `is distinct from`, reage a MUDANÇA de valor,
    // não à mera presença da coluna na cláusula SET (`before update of segmento_id` dispara nos
    // dois casos; quem decide bloquear ou não é o corpo da função).
    const updateSegmentoIgualNaoMuda = await svc
      .from("categorias_novas")
      .update({ segmento_id: segCId, nome: "Folha Reparent Reafirmada" })
      .eq("id", folhaReparentId)
      .select("id, segmento_id, nome")
      .single();
    check(
      "41. UPDATE que reafirma o MESMO segmento_id (sem mudar o valor) NÃO é bloqueado",
      !updateSegmentoIgualNaoMuda.error && updateSegmentoIgualNaoMuda.data?.segmento_id === segCId,
      updateSegmentoIgualNaoMuda.error?.message,
    );
  } finally {
    // Cleanup: categorias antes de segmentos (o RESTRICT é justamente
    // o que impede a ordem inversa).
    // Escopado ao que ESTA suite criou. Um `delete` sem filtro aqui
    // funcionaria hoje (a tabela so tem fixture), mas depois do TX-P2C
    // apagaria o catalogo real no banco local de quem rodasse a suite.
    const meus = await svc.from("segmentos").select("id").like("slug", `${PREFIXO}%`);
    const meusIds = (meus.data ?? []).map((s) => s.id as string);
    if (meusIds.length > 0) {
      await svc.from("categorias_novas").delete().in("segmento_id", meusIds);
      await svc.from("segmentos").delete().in("id", meusIds);
    }

    const restaCat = meusIds.length
      ? await svc.from("categorias_novas").select("id").in("segmento_id", meusIds)
      : { data: [] as { id: string }[] };
    const restaSeg = await svc.from("segmentos").select("id").like("slug", `${PREFIXO}%`);
    check("33. cleanup: zero categorias_novas residuais", (restaCat.data ?? []).length === 0, `${(restaCat.data ?? []).length} linhas`);
    check("34. cleanup: zero segmentos residuais", (restaSeg.data ?? []).length === 0, `${(restaSeg.data ?? []).length} linhas`);
  }

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
