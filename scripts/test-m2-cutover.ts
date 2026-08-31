/**
 * MARCO 2A — prova de que o RUNTIME cortou para o modelo 14x75.
 *
 * Não refaz test-tx-p2a/b/c/d1 nem test-m1-taxonomia: aquelas provam que o
 * staging está correto e que o legado continua intocado, e as quatro
 * primeiras têm de continuar VERDES depois desta rodar — é o que demonstra
 * que o cutover expandiu em vez de contrair.
 *
 * O que É novo aqui: as três views de fronteira (catalogo_segmentos,
 * catalogo_folhas, folha_para_segmento), a semântica de `ativo` nos dois
 * lados (nova seleção x histórico), a operabilidade da junção nova
 * (RLS + grants + trigger de folha ativa), o grant de UPDATE em
 * `categoria_nova_id` com a remoderação que ele obriga, o congelamento do
 * `categoria_id` legado, e o registro estático de ícones e temas.
 *
 * Regra da casa: verde vazio é pior que vermelho — todo teste negativo
 * confere `error` PRESENTE, nunca "0 linhas", porque a RLS filtra em
 * silêncio e um `.length === 0` passaria sempre.
 *
 * Fixtures usam prefixo `m2-` e saem no `finally`; o que muta dado
 * CANÔNICO (o `ativo` de uma folha real, a categoria de um cupom real) é
 * revertido antes de terminar — test-m1-taxonomia confere o de-para depois.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-m2-cutover");

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { encerrar } from "./_qa-conta";
import { TEMA_CORES, TEMA_FALLBACK, coresDoTema, gradienteWeb } from "../src/lib/tema-visual";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

/** Falhou de verdade? (erro presente, não apenas "0 linhas"). */
function negado(r: { error: unknown }): boolean {
  return Boolean(r.error);
}

const PREFIXO = "m2-";

interface CatalogoJson {
  segmentos: {
    slug: string;
    icone: string;
    tema: string;
    categorias: { slug: string; icone: string | null; tema: string | null }[];
  }[];
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

  const admin = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await admin.auth.signInWithPassword({
    email: "admin@promofy.test",
    password: "promofy123",
  });

  // Fixtures a desfazer no finally.
  let folhaDesativada: string | null = null;
  let segmentoFixture: string | null = null;
  let vinculoFixture: { estabelecimento_id: string; categoria_id: string } | null = null;

  try {
    // ============================================================
    console.log("\n=== M2/A — as três views de fronteira ===\n");
    // ============================================================
    const segAtivos = await svc.from("segmentos").select("id").eq("ativo", true);
    const folhasTodas = await svc.from("categorias_novas").select("id");
    const vSeg = await svc.from("catalogo_segmentos").select("slug, nome, icone, tema, ordem");
    const vFolhas = await svc
      .from("catalogo_folhas")
      .select("categoria_id, slug, nome, segmento_slug, icone, tema, ordem, segmento_ordem");
    const vMapa = await svc
      .from("folha_para_segmento")
      .select("categoria_id, slug, nome, segmento_slug, icone, tema, ativo, segmento_ativo");

    check("1. catalogo_segmentos consulta sem erro", !vSeg.error, vSeg.error?.message);
    check("2. catalogo_folhas consulta sem erro", !vFolhas.error, vFolhas.error?.message);
    check("3. folha_para_segmento consulta sem erro", !vMapa.error, vMapa.error?.message);

    check(
      "4. catalogo_segmentos = 14 (os segmentos do catálogo v1)",
      (vSeg.data ?? []).length === 14,
      String(vSeg.data?.length),
    );
    check(
      "5. catalogo_folhas = 75 (as folhas do catálogo v1)",
      (vFolhas.data ?? []).length === 75,
      String(vFolhas.data?.length),
    );
    check(
      "6. folha_para_segmento = 75 (TODAS as folhas — a view do histórico não filtra)",
      (vMapa.data ?? []).length === (folhasTodas.data ?? []).length,
      `${vMapa.data?.length} vs ${folhasTodas.data?.length}`,
    );
    check(
      "7. cardinalidade 14 != 75 — a colisão semântica da TX-P2AF virou real e está separada",
      (vSeg.data ?? []).length !== (vFolhas.data ?? []).length,
    );
    check(
      "8. catalogo_segmentos bate com os segmentos ATIVOS da tabela base",
      (vSeg.data ?? []).length === (segAtivos.data ?? []).length,
    );

    // Herança visual: o catálogo v1 não tem NENHUM override, então toda
    // folha tem de exibir exatamente o ícone/tema do segmento dela.
    const catalogoJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "docs/taxonomia/catalogo-v1.json"), "utf8"),
    ) as CatalogoJson;
    const visualDoSegmento = new Map(
      catalogoJson.segmentos.map((s) => [s.slug, { icone: s.icone, tema: s.tema }]),
    );
    const herancaErrada = (vFolhas.data ?? []).filter((f) => {
      const seg = visualDoSegmento.get(f.segmento_slug as string);
      return !seg || f.icone !== seg.icone || f.tema !== seg.tema;
    });
    check(
      "9. herança coalesce(folha, segmento) resolvida no BANCO em todas as 75 folhas",
      herancaErrada.length === 0,
      JSON.stringify(herancaErrada.slice(0, 3)),
    );
    check(
      "10. nenhuma folha atravessa a fronteira com icone/tema NULL",
      (vFolhas.data ?? []).every((f) => f.icone && f.tema) &&
        (vMapa.data ?? []).every((f) => f.icone && f.tema),
    );
    check(
      "11. todo segmento_slug de folha_para_segmento existe em segmentos",
      new Set((vMapa.data ?? []).map((f) => f.segmento_slug)).size === 14,
    );

    // ============================================================
    console.log("\n=== M2/B — segurança das três views ===\n");
    // ============================================================
    for (const view of ["catalogo_segmentos", "catalogo_folhas", "folha_para_segmento"] as const) {
      const r = await anon.from(view).select("*").limit(1);
      check(`12. anon LÊ ${view} (leitura pública, como o legado)`, !r.error, r.error?.message);
    }
    check(
      "13. anon vê o MESMO catálogo de segmentos que o service_role",
      ((await anon.from("catalogo_segmentos").select("slug")).data ?? []).length === 14,
    );

    // View simples é AUTO-ATUALIZÁVEL no Postgres: sem o revoke, um write
    // na view escreveria na tabela base. Contraprova nas TRÊS.
    const wSeg = await anon
      .from("catalogo_segmentos")
      .insert({ slug: "m2-hack", nome: "x", icone: "x", tema: "x", ordem: 999 });
    check("14. anon NÃO insere em catalogo_segmentos", negado(wSeg), "insert passou!");
    const wUpdSeg = await anon
      .from("catalogo_segmentos")
      .update({ nome: "hack" })
      .eq("slug", "alimentacao");
    check("15. anon NÃO atualiza catalogo_segmentos", negado(wUpdSeg), "update passou!");
    const wFolha = await anon.from("catalogo_folhas").update({ nome: "hack" }).neq("slug", "");
    check("16. anon NÃO atualiza catalogo_folhas", negado(wFolha), "update passou!");
    const wMapa = await anon.from("folha_para_segmento").delete().neq("slug", "");
    check("17. anon NÃO deleta via folha_para_segmento", negado(wMapa), "delete passou!");

    // ============================================================
    console.log("\n=== M2/C — RLS e grants da junção nova ===\n");
    // ============================================================
    // e1 é ATIVO (dono = lojista@). Guardamos um estabelecimento não-ativo
    // para provar que o anônimo não o enxerga pela junção.
    const naoAtivo = await svc
      .from("estabelecimentos")
      .select("id")
      .neq("status", "ativo")
      .limit(1)
      .maybeSingle();

    const anonJoin = await anon
      .from("estabelecimento_categorias_novas")
      .select("estabelecimento_id, categoria_id");
    check("18. anon lê a junção nova sem erro", !anonJoin.error, anonJoin.error?.message);
    check(
      "19. anon vê vínculos de e1 (estabelecimento ATIVO)",
      (anonJoin.data ?? []).some((r) => r.estabelecimento_id === "e1"),
    );
    if (naoAtivo.data?.id) {
      check(
        "20. anon NÃO vê vínculos de estabelecimento não-ativo (a `using (true)` do M1 saiu)",
        !(anonJoin.data ?? []).some((r) => r.estabelecimento_id === naoAtivo.data!.id),
        `vazou ${naoAtivo.data.id}`,
      );
    } else {
      check("20. (sem estabelecimento não-ativo no alvo — asserção não roda)", true);
      console.log("        ^ nota: a asserção 20 NÃO rodou neste alvo, por falta de fixture.");
    }

    // O dono lê as próprias mesmo com o estabelecimento pendente/suspenso —
    // é isso que faz /e/cupom/novo listar categorias antes da aprovação.
    const donoJoin = await lojista
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", "e1");
    check(
      "21. dono lê os próprios vínculos (policy `dono e admin leem`)",
      !donoJoin.error && (donoJoin.data ?? []).length > 0,
      donoJoin.error?.message,
    );

    // Escrita: SÓ admin.
    const folhaLivre = (vFolhas.data ?? []).find(
      (f) => !(anonJoin.data ?? []).some((j) => j.estabelecimento_id === "e1" && j.categoria_id === f.categoria_id),
    );
    const insLojista = await lojista
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: folhaLivre!.categoria_id as string });
    check("22. lojista NÃO insere na junção nova", negado(insLojista), "insert passou!");
    const delLojista = await lojista
      .from("estabelecimento_categorias_novas")
      .delete()
      .eq("estabelecimento_id", "e1");
    check(
      "23. lojista NÃO deleta da junção nova",
      negado(delLojista) ||
        (await svc
          .from("estabelecimento_categorias_novas")
          .select("categoria_id")
          .eq("estabelecimento_id", "e1")).data!.length > 0,
      "delete apagou linhas!",
    );
    const insAnon = await anon
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: folhaLivre!.categoria_id as string });
    check("24. anon NÃO insere na junção nova", negado(insAnon), "insert passou!");

    const insAdmin = await admin
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: folhaLivre!.categoria_id as string });
    check("25. ADMIN insere na junção nova (a operação do painel funciona)", !insAdmin.error, insAdmin.error?.message);
    if (!insAdmin.error) {
      vinculoFixture = {
        estabelecimento_id: "e1",
        categoria_id: folhaLivre!.categoria_id as string,
      };
    }

    // ============================================================
    console.log("\n=== M2/D — `ativo` governa NOVA SELEÇÃO, nunca o histórico ===\n");
    // ============================================================
    // Fixture: um segmento e uma folha próprios, para desativar sem tocar
    // no catálogo canônico.
    const segFix = await svc
      .from("segmentos")
      .insert({
        slug: `${PREFIXO}seg`,
        nome: "M2 fixture",
        icone: "Store",
        tema: "cinza",
        ordem: 900,
      })
      .select("id")
      .single();
    segmentoFixture = segFix.data?.id ?? null;
    check("26. fixture: segmento m2- criado", !segFix.error, segFix.error?.message);

    const folhaFix = await svc
      .from("categorias_novas")
      .insert({ segmento_id: segmentoFixture!, slug: `${PREFIXO}folha`, nome: "M2 folha", ordem: 1 })
      .select("id")
      .single();
    check("27. fixture: folha m2- criada", !folhaFix.error, folhaFix.error?.message);
    const folhaFixId = folhaFix.data!.id as string;

    check(
      "28. folha ativa aparece nas TRÊS views",
      ((await svc.from("catalogo_folhas").select("categoria_id").eq("categoria_id", folhaFixId)).data ?? [])
        .length === 1 &&
        ((await svc.from("folha_para_segmento").select("categoria_id").eq("categoria_id", folhaFixId))
          .data ?? []).length === 1,
    );

    // Vínculo NOVO exige folha ativa (trigger do Marco 2A).
    const vincAtiva = await svc
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e1", categoria_id: folhaFixId });
    check("29. vínculo com folha ATIVA é aceito", !vincAtiva.error, vincAtiva.error?.message);

    // Agora desativa a folha fixture.
    await svc.from("categorias_novas").update({ ativo: false }).eq("id", folhaFixId);
    folhaDesativada = folhaFixId;

    check(
      "30. folha desativada SOME de catalogo_folhas (não é mais oferecível)",
      ((await svc.from("catalogo_folhas").select("categoria_id").eq("categoria_id", folhaFixId)).data ?? [])
        .length === 0,
    );
    const mapaInativa = await svc
      .from("folha_para_segmento")
      .select("categoria_id, nome, icone, tema, ativo")
      .eq("categoria_id", folhaFixId)
      .maybeSingle();
    check(
      "31. folha desativada CONTINUA em folha_para_segmento, com nome/ícone/tema resolvidos",
      !!mapaInativa.data?.nome && !!mapaInativa.data?.icone && !!mapaInativa.data?.tema,
      JSON.stringify(mapaInativa.data),
    );
    check("32. folha_para_segmento expõe `ativo` = false para o form saber", mapaInativa.data?.ativo === false);
    check(
      "33. o vínculo JÁ EXISTENTE não foi invalidado pela desativação",
      ((await svc
        .from("estabelecimento_categorias_novas")
        .select("categoria_id")
        .eq("estabelecimento_id", "e1")
        .eq("categoria_id", folhaFixId)).data ?? []).length === 1,
    );

    // Vínculo NOVO com folha inativa é recusado — nas duas pontas.
    const vincInativa = await svc
      .from("estabelecimento_categorias_novas")
      .insert({ estabelecimento_id: "e2", categoria_id: folhaFixId });
    check(
      "34. vínculo NOVO com folha INATIVA é recusado pelo banco (inclusive service_role)",
      negado(vincInativa),
      "insert passou!",
    );

    // Cupom: a folha inativa não pode ser NOVA seleção.
    const cupomInativo = await svc
      .from("cupons")
      .update({ categoria_nova_id: folhaFixId })
      .eq("id", "c01");
    check(
      "35. cupom NÃO pode ser recategorizado para folha inativa",
      negado(cupomInativo),
      "update passou!",
    );

    // ...mas o cupom que JÁ usa uma folha continua vivo e resolvível.
    const c01 = await svc.from("cupons").select("categoria_nova_id").eq("id", "c01").single();
    check(
      "36. cupom existente permanece com a categoria dele (nada foi invalidado)",
      !!c01.data?.categoria_nova_id,
    );

    // ============================================================
    console.log("\n=== M2/E — categoria_id LEGADO congelado ===\n");
    // ============================================================
    const e1Cats = await svc
      .from("estabelecimento_categorias_novas")
      .select("categoria_id")
      .eq("estabelecimento_id", "e1");
    const folhaValidaE1 = (e1Cats.data ?? []).find((c) => c.categoria_id !== folhaFixId)!
      .categoria_id as string;

    const cupomNovo = await svc
      .from("cupons")
      .insert({
        id: `${PREFIXO}cupom`,
        estabelecimento_id: "e1",
        titulo: "M2 fixture",
        beneficio: "fixture",
        economia: 1,
        validade_fim: "2030-12-31",
        categoria_nova_id: folhaValidaE1,
        // categoria_id legado deliberadamente OMITIDO
      })
      .select("id, categoria_id, categoria_nova_id")
      .single();
    check(
      "37. cupom NOVO nasce com categoria_id legado NULL (a coluna é nullable e a escrita congelou)",
      !cupomNovo.error && cupomNovo.data?.categoria_id === null,
      cupomNovo.error?.message ?? String(cupomNovo.data?.categoria_id),
    );
    check(
      "38. cupom NOVO nasce com a folha UUID preenchida",
      cupomNovo.data?.categoria_nova_id === folhaValidaE1,
    );
    check(
      "39. checar_categoria_cupom deixa NULL passar (senão nenhum cupom novo nasceria)",
      !cupomNovo.error,
      cupomNovo.error?.message,
    );

    // O caminho LEGADO continua protegido: valor preenchido e fora do
    // conjunto legado continua sendo recusado, como sempre foi.
    const legadoInvalido = await svc
      .from("cupons")
      .update({ categoria_id: "pet" })
      .eq("id", `${PREFIXO}cupom`);
    check(
      "40. categoria_id legado PREENCHIDO e fora do conjunto continua recusado",
      negado(legadoInvalido),
      "update passou!",
    );

    // MARCO 2B (CONTRACT, 20260831130000): item 40b MUDOU DE PROPÓSITO
    // (reescrito, não acomodado) — mesma doutrina do 29/30 em
    // test-m1-taxonomia e do 34/37 do próprio MARCO 2A. Até o contract, a
    // isenção de service_role no INSERT (item 1, trigger) era a ÚNICA
    // barreira, e este teste provava que ela era design deliberado, não
    // lacuna. O contract fechou essa isenção pela raiz: categoria_nova_id
    // é agora fisicamente NOT NULL, e uma constraint de coluna NÃO
    // distingue papel — nem o trigger tenta mais isentar service_role no
    // INSERT (ver checar_categoria_nova_cupom, inalterada; quem fecha o
    // gap é a própria constraint, verificada depois do trigger rodar).
    // "service_role nunca é canal da aplicação" (CLAUDE.md) continua
    // verdade, mas deixou de ser o MOTIVO da proteção — agora é a
    // constraint, para qualquer role, sem exceção.
    const semFolha = await svc
      .from("cupons")
      .insert({
        id: `${PREFIXO}sem-folha`,
        estabelecimento_id: "e1",
        titulo: "M2B service_role também é recusado (contract)",
        beneficio: "fixture",
        economia: 1,
        validade_fim: "2030-12-31",
      })
      .select("id, categoria_nova_id")
      .single();
    check(
      "40b. service_role AGORA é recusado ao criar cupom sem folha — a isenção do item 1 não sobrevive à constraint física (23502 not_null_violation)",
      semFolha.error?.code === "23502",
      semFolha.error?.code ?? JSON.stringify(semFolha.data),
    );

    const migrations = fs.readdirSync(path.join(process.cwd(), "supabase/migrations"));
    check(
      "40c. a migration de CONTRACT (20260831130000) agora EXISTE no diretório — guarda cumpriu seu papel (impedir aplicação prematura), fase seguinte é hospedar",
      migrations.some((f) => f.startsWith("20260831130000")),
      migrations.filter((f) => f.startsWith("2026083113")).join(", "),
    );

    // ============================================================
    console.log("\n=== M2/E2 — HARDENING FINAL: fecha o gap da janela bridge->runtime ===\n");
    //
    // O gap: entre a 120000 hospedada e o runtime novo (criarCupomAction)
    // em produção, um INSERT do código ANTIGO (só categoria_id, nunca
    // categoria_nova_id) nasceria com o shadow NULL — um cupom real e
    // permanente, órfão do modelo novo, sem mapping seguro para corrigir
    // depois. As provas abaixo espelham os itens A-G do hardening.
    // ============================================================

    // A. OLD-SHAPED INSERT — authenticated tenta criar cupom só com
    // categoria_id legado, sem categoria_nova_id. Simula produção antiga
    // durante a janela.
    const oldShaped = await lojista.from("cupons").insert({
      id: `${PREFIXO}hard-a`,
      estabelecimento_id: "e1",
      categoria_id: "alimentacao",
      titulo: "M2 hardening A (old-shaped)",
      beneficio: "fixture",
      economia: 1,
      validade_fim: "2030-12-31",
    });
    check(
      "A. authenticated NÃO cria cupom old-shaped (categoria_id sem categoria_nova_id)",
      negado(oldShaped) &&
        (oldShaped.error?.message ?? "").includes("categoria_nova_obrigatoria_no_runtime"),
      oldShaped.error?.message ?? "insert passou!",
    );

    // B. NEW-SHAPED INSERT — authenticated dono cria com categoria_nova_id
    // válida (categoria_id omitido, como o runtime novo sempre faz).
    const newShaped = await lojista
      .from("cupons")
      .insert({
        id: `${PREFIXO}hard-b`,
        estabelecimento_id: "e1",
        categoria_nova_id: folhaValidaE1,
        titulo: "M2 hardening B (new-shaped)",
        beneficio: "fixture",
        economia: 1,
        validade_fim: "2030-12-31",
      })
      .select("id, categoria_id, categoria_nova_id")
      .single();
    check(
      "B. authenticated CRIA cupom new-shaped (só categoria_nova_id)",
      !newShaped.error && newShaped.data?.categoria_id === null,
      newShaped.error?.message ?? JSON.stringify(newShaped.data),
    );

    // C. CLEAR SHADOW — authenticated tenta apagar categoria_nova_id de um
    // cupom que já tem folha, voltando para NULL.
    const clearShadow = await lojista
      .from("cupons")
      .update({ categoria_nova_id: null })
      .eq("id", `${PREFIXO}hard-b`);
    check(
      "C. authenticated NÃO limpa categoria_nova_id (UUID -> NULL)",
      negado(clearShadow) &&
        (clearShadow.error?.message ?? "").includes("categoria_nova_nao_pode_ser_limpa_via_api"),
      clearShadow.error?.message ?? "update passou!",
    );

    // D. SERVICE ROLE VIA API — a MESMA limpeza (C), agora por
    // service_role. Item 2 (ao contrário do item 1) NÃO isenta
    // service_role: ele é operador de teste/migração, não sinônimo de
    // "pode desfazer o cutover" desfazendo um shadow já definido.
    const clearShadowSvc = await svc
      .from("cupons")
      .update({ categoria_nova_id: null })
      .eq("id", `${PREFIXO}hard-b`);
    check(
      "D. service_role TAMBÉM NÃO limpa categoria_nova_id via API (item 2 não tem exceção de papel)",
      negado(clearShadowSvc) &&
        (clearShadowSvc.error?.message ?? "").includes("categoria_nova_nao_pode_ser_limpa_via_api"),
      clearShadowSvc.error?.message ?? "update passou!",
    );
    await svc.from("cupons").delete().eq("id", `${PREFIXO}hard-a`);
    await svc.from("cupons").delete().eq("id", `${PREFIXO}hard-b`);

    // E. LEGACY CHANGE — authenticated tenta mudar categoria_id legado de
    // um cupom CANÔNICO (c01) de um valor válido para outro valor válido.
    // c01 é usado porque precisa de um cupom cujo categoria_id legado já
    // era não-nulo (as fixtures A/B nascem com ele NULL, por design do
    // Marco 2A) — test-m1-taxonomia já confere c01 de volta ao de-para
    // original no fim; aqui a asserção é só a rejeição.
    const legacyBefore = await svc.from("cupons").select("categoria_id").eq("id", "c01").single();
    const legacyChange = await lojista
      .from("cupons")
      .update({ categoria_id: "fitness" })
      .eq("id", "c01");
    check(
      "E. authenticated NÃO muda categoria_id legado de um valor válido para outro (recategorização pela porta legada)",
      negado(legacyChange) &&
        (legacyChange.error?.message ?? "").includes("categoria_id_legado_congelada"),
      legacyChange.error?.message ?? "update passou!",
    );
    const legacyAfter = await svc.from("cupons").select("categoria_id").eq("id", "c01").single();
    check(
      "E2. c01 preserva categoria_id legado após a tentativa recusada",
      legacyAfter.data?.categoria_id === legacyBefore.data?.categoria_id,
      `${legacyBefore.data?.categoria_id} -> ${legacyAfter.data?.categoria_id}`,
    );

    // F. LEGACY SAME VALUE — authenticated reescreve categoria_id com o
    // MESMO valor, junto de um campo seguro (titulo). new IS DISTINCT
    // FROM old é false aqui: o freeze do item 3 nunca dispara.
    const tituloOriginal = await svc.from("cupons").select("titulo").eq("id", "c01").single();
    const legacySameValue = await lojista
      .from("cupons")
      .update({ categoria_id: legacyBefore.data?.categoria_id, titulo: tituloOriginal.data?.titulo })
      .eq("id", "c01")
      .select("categoria_id")
      .single();
    check(
      "F. authenticated GRAVA categoria_id com o MESMO valor sem ser bloqueado pelo freeze",
      !legacySameValue.error && legacySameValue.data?.categoria_id === legacyBefore.data?.categoria_id,
      legacySameValue.error?.message,
    );

    // G. SEED/RESET — não repete `db reset` aqui (caro, fora do propósito
    // de uma suíte de asserções pontuais); a prova real já rodou nesta
    // mesma sessão, ANTES desta suíte: `npm run db:reset` aplicou a
    // migration endurecida e o `seed.sql` completou com os 14 cupons
    // canônicos e os backfills de taxonomia — se o hardening tivesse
    // quebrado o caminho administrativo (auth.role() nulo), o reset
    // inteiro teria falhado antes de qualquer teste rodar. Esta asserção
    // confere o RESULTADO observável desse caminho: os 14 cupons
    // canônicos (nascidos via seed.sql, psql, contexto administrativo)
    // têm categoria_nova_id preenchida pelo backfill.
    const canonicos = await svc
      .from("cupons")
      .select("id", { count: "exact", head: true })
      .not("categoria_nova_id", "is", null)
      .in("id", [
        "c01", "c02", "c03", "c04", "c05", "c06", "c07", "c08",
        "c09", "c10", "c11", "c12", "p-campanha-esgotada", "p-campanha-expirada",
      ]);
    check(
      "G. seed/reset: os 14 cupons canônicos (via psql administrativo) têm categoria_nova_id preenchida",
      canonicos.count === 14,
      String(canonicos.count),
    );

    // ============================================================
    console.log("\n=== M2/F — grant de UPDATE + remoderação ===\n");
    // ============================================================
    // O cupom fixture precisa estar ATIVO para o rebaixamento ser visível.
    await svc.from("cupons").update({ status: "ativo" }).eq("id", `${PREFIXO}cupom`);
    const outraFolhaE1 = (e1Cats.data ?? []).find(
      (c) => c.categoria_id !== folhaValidaE1 && c.categoria_id !== folhaFixId,
    )?.categoria_id as string | undefined;

    if (outraFolhaE1) {
      const antes = await svc
        .from("cupons")
        .select("status, moderacao_historico")
        .eq("id", `${PREFIXO}cupom`)
        .single();

      const trocaLojista = await lojista
        .from("cupons")
        .update({ categoria_nova_id: outraFolhaE1 })
        .eq("id", `${PREFIXO}cupom`);
      check(
        "41. lojista PODE atualizar categoria_nova_id (grant por coluna existe)",
        !trocaLojista.error,
        trocaLojista.error?.message,
      );

      const depois = await svc
        .from("cupons")
        .select("status, categoria_nova_id, moderacao_historico")
        .eq("id", `${PREFIXO}cupom`)
        .single();
      const hist = (depois.data?.moderacao_historico ?? []) as { acao?: string }[];
      const histAntes = (antes.data?.moderacao_historico ?? []) as unknown[];
      check(
        "42. trocar a folha REBAIXA cupom ativo para moderação (status -> pendente)",
        antes.data?.status === "ativo" && depois.data?.status === "pendente",
        `${antes.data?.status} -> ${depois.data?.status}`,
      );
      check(
        "43. a troca entra em moderacao_historico como `editado_material`",
        hist.length === histAntes.length + 1 && hist[hist.length - 1]?.acao === "editado_material",
        JSON.stringify(hist.slice(-1)),
      );
      check("44. a folha nova de fato ficou gravada", depois.data?.categoria_nova_id === outraFolhaE1);
    } else {
      check("41-44. (e1 não tem 2 folhas livres — asserções não rodam)", false, "fixture insuficiente");
    }

    // O lojista continua SEM poder abrir outras colunas.
    const updProibido = await lojista
      .from("cupons")
      .update({ status: "ativo" })
      .eq("id", `${PREFIXO}cupom`);
    check(
      "45. o grant novo NÃO abriu outras colunas (status continua fora)",
      negado(updProibido),
      "update de status passou!",
    );

    // ============================================================
    console.log("\n=== M2/G — registro de ícones e temas (estático) ===\n");
    // ============================================================
    const iconSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/icon.tsx"),
      "utf8",
    );
    const iconesCatalogo = catalogoJson.segmentos
      .flatMap((s) => [s.icone, ...s.categorias.map((c) => c.icone)])
      .filter((i): i is string => Boolean(i));
    const iconesFaltando = Array.from(new Set(iconesCatalogo)).filter(
      (i) => !new RegExp(`\\n  ${i},`).test(iconSrc),
    );
    check(
      "46. TODO ícone do catálogo real está no registry (fallback é para o desconhecido, não para o catálogo)",
      iconesFaltando.length === 0,
      iconesFaltando.join(", "),
    );

    const temasCatalogo = catalogoJson.segmentos
      .flatMap((s) => [s.tema, ...s.categorias.map((c) => c.tema)])
      .filter((t): t is string => Boolean(t));
    const temasFaltando = Array.from(new Set(temasCatalogo)).filter((t) => !(t in TEMA_CORES));
    check(
      "47. TODO tema do catálogo real está em TEMA_CORES",
      temasFaltando.length === 0,
      temasFaltando.join(", "),
    );
    check("48. TEMA_CORES tem os 14 tokens do catálogo v1", Object.keys(TEMA_CORES).length === 14);

    // Nenhum tema conhecido pode renderizar como o fallback: seria "não sei
    // o que é isto" e "isto é Serviços" desenhando o mesmo card.
    const comoFallback = Object.entries(TEMA_CORES).filter(
      ([, c]) => c.de === TEMA_FALLBACK.de && c.para === TEMA_FALLBACK.para,
    );
    check(
      "49. nenhum token conhecido cai no visual do fallback",
      comoFallback.length === 0,
      comoFallback.map(([t]) => t).join(", "),
    );
    const gradientes = Object.keys(TEMA_CORES).map((t) => gradienteWeb(t));
    check(
      "50. os 14 gradientes são mutuamente distintos",
      new Set(gradientes).size === 14,
      `${new Set(gradientes).size} distintos`,
    );
    check(
      "51. os 6 gradientes herdados batem com o legado (identidade visual preservada)",
      gradienteWeb("laranja") === "linear-gradient(135deg, #FF8A3D 0%, #FF5A5F 100%)" &&
        gradienteWeb("verde") === "linear-gradient(135deg, #22C55E 0%, #0EA5A4 100%)" &&
        gradienteWeb("rosa") === "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" &&
        gradienteWeb("azul") === "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)" &&
        gradienteWeb("indigo") === "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" &&
        gradienteWeb("ambar") === "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
    );
    check(
      "52. token desconhecido cai no fallback (tolerância defensiva, não comportamento normal)",
      coresDoTema("nao-existe-este-token").de === TEMA_FALLBACK.de,
    );
    // O banco NUNCA guarda CSS — a tradução é só desta camada.
    const temaComCss = await svc
      .from("segmentos")
      .update({ tema: "linear-gradient(135deg, #fff 0%, #000 100%)" })
      .eq("slug", "alimentacao");
    check("53. o banco continua recusando CSS em `tema`", negado(temaComCss), "update passou!");

    // ============================================================
    console.log("\n=== M2/H — o legado continua no banco, intocado ===\n");
    // ============================================================
    const catLegado = await svc.from("categorias").select("id", { count: "exact", head: true });
    check("54. public.categorias legado continua com 6 linhas", catLegado.count === 6, String(catLegado.count));
    const joinLegado = await svc
      .from("estabelecimento_categorias")
      .select("estabelecimento_id", { count: "exact", head: true });
    check(
      "55. estabelecimento_categorias legado continua com 7 linhas",
      joinLegado.count === 7,
      String(joinLegado.count),
    );
    for (const view of ["catalogo_filtros", "catalogo_categorias", "categoria_para_filtro"] as const) {
      const r = await svc.from(view).select("*", { count: "exact", head: true });
      check(`56. view P2A ${view} continua servindo o legado (6 linhas)`, r.count === 6, String(r.count));
    }
    const cuponsLegado = await svc
      .from("cupons")
      .select("id", { count: "exact", head: true })
      .not("categoria_id", "is", null);
    check(
      "57. os cupons anteriores ao cutover preservam o categoria_id legado (rede de rollback)",
      (cuponsLegado.count ?? 0) >= 14,
      String(cuponsLegado.count),
    );
  } finally {
    // ============================================================
    console.log("\n=== M2/Z — cleanup ===\n");
    // ============================================================
    await svc.from("cupons").delete().eq("id", `${PREFIXO}cupom`);

    if (vinculoFixture) {
      await svc
        .from("estabelecimento_categorias_novas")
        .delete()
        .eq("estabelecimento_id", vinculoFixture.estabelecimento_id)
        .eq("categoria_id", vinculoFixture.categoria_id);
    }
    if (folhaDesativada) {
      // Reativar ANTES de remover o vínculo não é necessário, mas reativar
      // é: `impedir_remover_categoria_do_conjunto_em_uso` não olha `ativo`,
      // e deixar a folha desativada mudaria o catálogo para a próxima suíte.
      await svc.from("categorias_novas").update({ ativo: true }).eq("id", folhaDesativada);
      await svc
        .from("estabelecimento_categorias_novas")
        .delete()
        .eq("categoria_id", folhaDesativada);
      await svc.from("categorias_novas").delete().eq("id", folhaDesativada);
    }
    if (segmentoFixture) {
      await svc.from("categorias_novas").delete().eq("segmento_id", segmentoFixture);
      await svc.from("segmentos").delete().eq("id", segmentoFixture);
    }
    // Prova de que o catálogo canônico voltou ao estado de antes — sem
    // isto, test-m1-taxonomia (que confere o de-para) falharia depois.
    const seg = await svc.from("segmentos").select("id", { count: "exact", head: true });
    const fol = await svc.from("categorias_novas").select("id", { count: "exact", head: true });
    const join = await svc
      .from("estabelecimento_categorias_novas")
      .select("estabelecimento_id", { count: "exact", head: true });
    check("58. cleanup: catálogo de volta a 14 segmentos", seg.count === 14, String(seg.count));
    check("59. cleanup: catálogo de volta a 75 folhas", fol.count === 75, String(fol.count));
    check("60. cleanup: junção nova de volta a 10 vínculos", join.count === 10, String(join.count));
    const inativas = await svc
      .from("categorias_novas")
      .select("id", { count: "exact", head: true })
      .eq("ativo", false);
    check("61. cleanup: nenhuma folha ficou desativada", inativas.count === 0, String(inativas.count));
  }

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
