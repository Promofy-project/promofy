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
 * Vocabulário FECHADO de public.tema_visual — um token por segmento do
 * catálogo definitivo (§5.1, 14 segmentos / 75 folhas). Esta lista é a
 * contraprova do domain: se a migration e este array divergirem, o loop
 * 20c/21c fica vermelho. São DESIGN TOKENS, nunca CSS.
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
      .insert({ slug: `${PREFIXO}alfa`, nome: "Alfa", icon: "Star", tema: "azul", ordem: 1 })
      .select("id, slug, ativo, criado_em, atualizado_em")
      .single();
    check("1. insere segmento válido", !segA.error, segA.error?.message);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    check("2. id UUID gerado pelo banco", UUID_RE.test(segA.data?.id ?? ""), segA.data?.id);
    check("7. ativo default true", segA.data?.ativo === true, String(segA.data?.ativo));

    const dupSlug = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}alfa`, nome: "Alfa 2", icon: "Star", tema: "azul", ordem: 2 });
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
        .insert({ slug, nome: "X", icon: "Star", tema: "azul", ordem: 1 });
      check(`4. slug inválido (${rotulo}) é NEGADO`, negado(r), `slug=${JSON.stringify(slug)}`);
    }

    for (const [rotulo, valido] of [
      ["pizzarias", `${PREFIXO}pizzarias`],
      ["saude-bem-estar", `${PREFIXO}saude-bem-estar`],
      ["com dígito", `${PREFIXO}auto2`],
    ] as const) {
      const r = await svc
        .from("segmentos")
        .insert({ slug: valido, nome: "Válido", icon: "Star", tema: "verde", ordem: 3 });
      check(`4b. slug VÁLIDO (${rotulo}) é aceito`, !r.error, r.error?.message);
    }

    const nomeVazio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}nome-vazio`, nome: "   ", icon: "Star", tema: "azul", ordem: 1 });
    check("5. nome vazio/só espaço é NEGADO", negado(nomeVazio));

    const iconVazio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}icon-vazio`, nome: "X", icon: "  ", tema: "azul", ordem: 1 });
    check("5b. icon vazio é NEGADO", negado(iconVazio));

    const ordemNeg = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}ordem-neg`, nome: "X", icon: "Star", tema: "azul", ordem: -1 });
    check("6. ordem negativa é NEGADA", negado(ordemNeg));

    console.log("\n=== TX-P2B/B — VISUAL: token de tema, nunca CSS ===\n");

    const temaCss = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-css`,
      nome: "X",
      icon: "Star",
      tema: "linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)",
      ordem: 1,
    });
    check("20. tema com CSS cru é NEGADO (é token, não gradiente)", negado(temaCss));

    const temaLivre = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-livre`, nome: "X", icon: "Star", tema: "turquesa", ordem: 1 });
    check("20b. tema fora do vocabulário é NEGADO", negado(temaLivre));

    // O vocabulário é fechado: TODOS os 14 têm de entrar. Um token que o
    // catálogo 14x75 precisa e o domain recusa só apareceria no TX-P2C,
    // com o seed já escrito — aqui aparece agora.
    for (let i = 0; i < TEMAS.length; i++) {
      const tema = TEMAS[i];
      const r = await svc.from("segmentos").insert({
        slug: `${PREFIXO}tema-${tema}`,
        nome: `Tema ${tema}`,
        icon: "Star",
        tema,
        ordem: 100 + i,
      });
      check(`20c. token válido '${tema}' é ACEITO`, !r.error, r.error?.message);
    }

    const temaVazio = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-vazio`, nome: "X", icon: "Star", tema: "", ordem: 1 });
    check("20d. tema string vazia é NEGADO", negado(temaVazio));

    const temaHex = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-hex`, nome: "X", icon: "Star", tema: "#FF8A3D", ordem: 1 });
    check("20e. tema com hex cru é NEGADO", negado(temaHex));

    const temaRgb = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-rgb`,
      nome: "X",
      icon: "Star",
      tema: "rgb(255, 138, 61)",
      ordem: 1,
    });
    check("20f. tema com rgb() cru é NEGADO", negado(temaRgb));

    // Tema é token de APRESENTAÇÃO, não identidade do segmento: o slug do
    // segmento não é tema, senão o vocabulário viraria a taxonomia.
    const temaNomeSegmento = await svc.from("segmentos").insert({
      slug: `${PREFIXO}tema-segmento`,
      nome: "X",
      icon: "Star",
      tema: "alimentacao",
      ordem: 1,
    });
    check("20g. nome de segmento como tema é NEGADO ('alimentacao' não é token)", negado(temaNomeSegmento));

    const temaCaixa = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-caixa`, nome: "X", icon: "Star", tema: "Azul", ordem: 1 });
    check("20h. token com caixa errada é NEGADO ('Azul')", negado(temaCaixa));

    const temaEspaco = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}tema-espaco`, nome: "X", icon: "Star", tema: "azul ", ordem: 1 });
    check("20i. token com espaço sobrando é NEGADO ('azul ')", negado(temaEspaco));

    console.log("\n=== TX-P2B/C — CATEGORIAS FOLHA ===\n");

    const segAId = segA.data?.id as string;
    const segB = await svc
      .from("segmentos")
      .insert({ slug: `${PREFIXO}beta`, nome: "Beta", icon: "Heart", tema: "rosa", ordem: 2 })
      .select("id")
      .single();
    const segBId = segB.data?.id as string;

    const catA = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segAId, slug: "pizzarias", nome: "Pizzarias", ordem: 1 })
      .select("id, ativo, icon_override, tema_override")
      .single();
    check("8. insere categoria folha válida", !catA.error, catA.error?.message);
    check("9. id UUID gerado pelo banco", UUID_RE.test(catA.data?.id ?? ""), catA.data?.id);
    check("19. override null é permitido (herda do segmento)", catA.data?.icon_override === null && catA.data?.tema_override === null);

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

    const overrideInvalido = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "tema-ruim",
      nome: "X",
      ordem: 1,
      tema_override: "neon",
    });
    check("21. tema_override fora do vocabulário é NEGADO", negado(overrideInvalido));

    const overrideVazio = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "icon-vazio",
      nome: "X",
      ordem: 1,
      icon_override: "   ",
    });
    check("21b. icon_override vazio é NEGADO (string vazia não é override)", negado(overrideVazio));

    const overrideValido = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "com-override",
      nome: "Com override",
      ordem: 5,
      icon_override: "Pizza",
      tema_override: "ambar",
    });
    check("19b. override VÁLIDO é aceito", !overrideValido.error, overrideValido.error?.message);

    // tema_override usa o MESMO domain — a folha tem de poder assumir
    // qualquer um dos 14, não só o do próprio segmento.
    for (let i = 0; i < TEMAS.length; i++) {
      const tema = TEMAS[i];
      const r = await svc.from("categorias_novas").insert({
        segmento_id: segAId,
        slug: `ov-${tema}`,
        nome: `Override ${tema}`,
        ordem: 200 + i,
        tema_override: tema,
      });
      check(`21c. tema_override '${tema}' é ACEITO`, !r.error, r.error?.message);
    }

    const overrideStringVazia = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "ov-vazio",
      nome: "X",
      ordem: 1,
      tema_override: "",
    });
    check("21d. tema_override string vazia é NEGADO ('' não é herdar — herdar é NULL)", negado(overrideStringVazia));

    const overrideCss = await svc.from("categorias_novas").insert({
      segmento_id: segAId,
      slug: "ov-css",
      nome: "X",
      ordem: 1,
      tema_override: "linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)",
    });
    check("21e. tema_override com CSS cru é NEGADO", negado(overrideCss));

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
      .insert({ slug: `${PREFIXO}hack`, nome: "H", icon: "Star", tema: "azul", ordem: 1 });
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
        .insert({ slug: `${PREFIXO}hack2`, nome: "H", icon: "Star", tema: "azul", ordem: 1 });
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
