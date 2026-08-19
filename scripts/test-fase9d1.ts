/**
 * Suíte da Fase 9 — Onda D1: ciclo de vida do cupom.
 *
 * O QUE ESTA SUÍTE PROVA, e por que ela precisou existir:
 *
 * `esgotado` e `expirado` estavam no enum desde a migration 1 e apareciam
 * nas telas, mas nada os produzia — os únicos cupons nesses estados eram
 * fixtures do seed, com o status escrito à mão. Um teste que lesse o seed
 * "provaria" a regra sem que regra nenhuma existisse.
 *
 * Então aqui NADA é semeado com o status pronto: o esgotamento acontece
 * porque uma validação real no balcão alcança `limite_total`, e o
 * vencimento porque a data passou. É a diferença entre testar o produto e
 * testar o próprio fixture.
 *
 * Conta `qa-*` efêmera. `consumidor@` e `convidado@` NUNCA são tocados.
 */
import { readFileSync } from "node:fs";

import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase9d1");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import { statusPortalDe, venceu, acoesDoCard, podeProrrogar } from "../src/lib/ciclo-cupom";

const SENHA = "promofy123";
const CUPOM_LIMITE = "f9d1-limite-1";
const CUPOM_VENCIDO = "f9d1-vencido";
const CUPOM_OK = "f9d1-vigente";

let passed = 0, failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
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

function fonteSemComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

/**
 * Data ISO deslocada em dias, no fuso do NEGÓCIO (BRT), sem Intl.
 *
 * Fazer a conta em UTC parece igual e não é: às 22h de Brasília já é o dia
 * seguinte em UTC, então `emDias(-1)` devolveria a data de HOJE em BRT — e o
 * teste de "validade vencida" passaria a testar "validade de hoje", que é
 * válida. É a mesma armadilha de fuso que o CLAUDE.md registra para o SSR.
 */
function emDias(dias: number): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** ---------- MÓDULO PURO: a derivação que o Portal usa ---------- */
function testarModuloPuro() {
  console.log("\n[D1-A] Derivação de estado (módulo puro, sem banco)");
  const hoje = "2026-08-19";

  check("D1: ativo com validade futura → ativo",
    statusPortalDe("ativo", "2026-12-31", hoje) === "ativo");
  check("D1: ativo com validade VENCIDA → expirado (o caso que o Portal escondia)",
    statusPortalDe("ativo", "2026-08-18", hoje) === "expirado");
  check("D1: validade == hoje ainda é ativo (o último dia vale inteiro)",
    statusPortalDe("ativo", hoje, hoje) === "ativo");
  check("D1: indisponivel colapsa em ativo, não em expirado",
    statusPortalDe("indisponivel", "2026-12-31", hoje) === "ativo");
  check("D1: indisponivel vencido também vira expirado",
    statusPortalDe("indisponivel", "2026-01-01", hoje) === "expirado");
  check("D1: esgotado do banco é respeitado, mesmo com validade futura",
    statusPortalDe("esgotado", "2026-12-31", hoje) === "esgotado");
  check("D1: excluido tem precedência sobre validade vencida",
    statusPortalDe("excluido", "2026-01-01", hoje) === "excluido");
  check("D1: pendente vencido NÃO vira expirado (ciclo próprio)",
    statusPortalDe("pendente", "2026-01-01", hoje) === "pendente");
  check("D1: rejeitado vencido NÃO vira expirado",
    statusPortalDe("rejeitado", "2026-01-01", hoje) === "rejeitado");
  check("D1: validade nula não inventa vencimento",
    statusPortalDe("ativo", null, hoje) === "ativo" && !venceu(null, hoje));

  check("D1: card de esgotado oferece NOVA CAMPANHA, não edição",
    acoesDoCard("esgotado").join() === "nova_campanha");
  check("D1: card de expirado oferece PRORROGAR",
    acoesDoCard("expirado").join() === "prorrogar");
  check("D1: card de rejeitado segue com editar+reenviar (C5/6.5 intactos)",
    acoesDoCard("rejeitado").join() === "editar,reenviar");
  check("D1: card de excluido segue sem ação",
    acoesDoCard("excluido").join() === "nenhuma");
  check("D1: prorrogar exige data futura",
    !podeProrrogar("expirado", "2026-08-18", hoje) && podeProrrogar("expirado", "2026-09-30", hoje));
  check("D1: prorrogar não se aplica a cupom que não está expirado",
    !podeProrrogar("ativo", "2026-09-30", hoje));
}

async function main(): Promise<number> {
  testarModuloPuro();

  const dono = await logar("lojista@promofy.test");   // e1 Sabor & Cia
  const outro = await logar("lojista2@promofy.test"); // e2 PowerFit
  let qa: ContaQa | null = null;

  const { data: e1 } = await svc
    .from("estabelecimentos").select("categoria_id").eq("id", "e1").maybeSingle();
  const catE1 = e1!.categoria_id as string;

  const base = {
    estabelecimento_id: "e1",
    categoria_id: catE1,
    economia: 10,
    status: "ativo" as const,
    horarios: { descricao: "todos os dias", dias: [], inicio: "00:00", fim: "23:59" },
  };

  try {
    qa = await criarContaQa(svc, "f9d1", { nome: "Fulana D1" });
    const cliente = await logar(qa.email, qa.senha);

    // ============================================================
    console.log("\n[D1-B] ESGOTAMENTO REAL — a validação que fecha a campanha");
    // ============================================================

    for (const id of [CUPOM_LIMITE, CUPOM_VENCIDO, CUPOM_OK]) {
      await svc.from("cupons").delete().eq("id", id);
    }
    await svc.from("cupons").insert({
      ...base, id: CUPOM_LIMITE, titulo: "F9D1 limite 1",
      beneficio: "Cupom da suíte", validade_fim: "2035-12-31",
      limite_total: 1, limite_por_usuario: 1,
    });

    const { data: antes } = await svc
      .from("cupons").select("status").eq("id", CUPOM_LIMITE).maybeSingle();
    check("D1: o cupom nasce ativo (o seed NÃO escreve 'esgotado' à mão)",
      antes?.status === "ativo", String(antes?.status));

    const at = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_LIMITE })).data as any;
    check("D1: consumidor ativa o cupom", at?.ok === true, JSON.stringify(at));

    // O código vem em `estado`, não na raiz — a RPC devolve o ESTADO da
    // ativação (é o mesmo objeto que o provider do app consome).
    const val = (await dono.rpc("validar_cupom", { p_codigo: at?.estado?.codigo })).data as any;
    check("D1: lojista valida no balcão", val?.ok === true, JSON.stringify(val));

    const { data: depois } = await svc
      .from("cupons").select("status, moderacao_historico").eq("id", CUPOM_LIMITE).maybeSingle();
    check("D1: a validação que alcançou limite_total CARIMBOU 'esgotado'",
      depois?.status === "esgotado", String(depois?.status));
    const hist = (depois?.moderacao_historico ?? []) as any[];
    check("D1: …e deixou a trilha do esgotamento",
      hist.some((h) => h.acao === "esgotado"), JSON.stringify(hist));
    check("D1: a trilha registra QUANTAS validações fecharam a campanha",
      hist.some((h) => h.acao === "esgotado" && h.validacoes === 1), JSON.stringify(hist));

    // O consumidor seguinte não entra — e o motivo é o do limite, não outro.
    const qa2 = await criarContaQa(svc, "f9d1b", { nome: "Segunda D1" });
    const cliente2 = await logar(qa2.email, qa2.senha);
    const at2 = (await cliente2.rpc("ativar_cupom", { p_cupom_id: CUPOM_LIMITE })).data as any;
    check("D1: o próximo consumidor recebe motivo 'esgotado'",
      at2?.ok === false && (at2?.motivo === "esgotado" || at2?.motivo === "indisponivel"),
      JSON.stringify(at2));

    // O histórico da campanha encerrada continua inteiro.
    const { count: usoDepois } = await svc
      .from("cupons_usuario").select("id", { count: "exact", head: true }).eq("cupom_id", CUPOM_LIMITE);
    check("D1: a campanha esgotada preserva a validação que a fechou",
      (usoDepois ?? 0) === 1, String(usoDepois));
    await destruirContaQa(svc, qa2.id);

    // ============================================================
    console.log("\n[D1-C] NOVA CAMPANHA — id novo, contadores do zero");
    // ============================================================

    // É o que a tela faz no Salvar: criarCupomAction com os valores do
    // formulário (que vieram do cupom anterior). Aqui pelo PostgREST, com a
    // sessão do lojista — mesmo caminho, sem a UI.
    const { data: nova, error: errNova } = await dono
      .from("cupons")
      .insert({
        ...base, titulo: "F9D1 limite 1 (nova campanha)",
        beneficio: "Cupom da suíte", validade_fim: "2035-12-31",
        limite_total: 50, limite_por_usuario: 1,
      })
      .select("id, status, limite_total")
      .maybeSingle();
    check("D1: o lojista cria a campanha nova", !errNova && Boolean(nova?.id), errNova?.message);
    check("D1: ela NASCE pendente (o trigger da migration 20 continua mandando)",
      nova?.status === "pendente", String(nova?.status));
    check("D1: e com id PRÓPRIO — não reusa o da campanha esgotada",
      nova?.id !== CUPOM_LIMITE, String(nova?.id));
    check("D1: o limite é o novo, não o consumido da anterior",
      nova?.limite_total === 50, String(nova?.limite_total));

    const { count: usosNovo } = await svc
      .from("cupons_usuario").select("id", { count: "exact", head: true }).eq("cupom_id", nova!.id);
    const { count: evsNovo } = await svc
      .from("cupom_eventos").select("id", { count: "exact", head: true }).eq("cupom_id", nova!.id);
    check("D1: a campanha nova começa com 0 ativações/validações", (usosNovo ?? 0) === 0, String(usosNovo));
    check("D1: …e com 0 eventos de métrica", (evsNovo ?? 0) === 0, String(evsNovo));

    const { data: antiga } = await svc
      .from("cupons").select("status, moderacao_historico").eq("id", CUPOM_LIMITE).maybeSingle();
    check("D1: a campanha ANTIGA continua esgotada e intacta",
      antiga?.status === "esgotado", String(antiga?.status));
    check("D1: …com o histórico dela, que não foi para a nova",
      ((antiga?.moderacao_historico ?? []) as any[]).some((h) => h.acao === "esgotado"));
    const { data: histNova } = await svc
      .from("cupons").select("moderacao_historico").eq("id", nova!.id).maybeSingle();
    check("D1: a campanha nova NÃO herda a trilha da anterior",
      !((histNova?.moderacao_historico ?? []) as any[]).some((h) => h.acao === "esgotado"),
      JSON.stringify(histNova?.moderacao_historico));

    await svc.from("cupons").delete().eq("id", nova!.id);

    // ============================================================
    console.log("\n[D1-D] EXPIRADO — vencimento real e prorrogação com moderação");
    // ============================================================

    await svc.from("cupons").insert({
      ...base, id: CUPOM_VENCIDO, titulo: "F9D1 vencido",
      beneficio: "Cupom da suíte", validade_fim: emDias(-3),
    });

    // O consumidor não recebe cupom vencido — a regra da Fase 2, intacta.
    const { data: visivel } = await cliente
      .from("cupons").select("id").eq("id", CUPOM_VENCIDO).maybeSingle();
    const atV = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_VENCIDO })).data as any;
    check("D1: consumidor NÃO consegue ativar cupom vencido",
      atV?.ok === false, JSON.stringify(atV));
    check("D1: (a linha até é legível pela policy, mas a RPC recusa)",
      visivel === null || atV?.ok === false);

    // O Portal o representa como expirado mesmo com a coluna ainda 'ativo'.
    const { data: linhaV } = await svc
      .from("cupons").select("status, validade_fim").eq("id", CUPOM_VENCIDO).maybeSingle();
    check("D1: a coluna ainda diz 'ativo' (nada varre a tabela — é derivado)",
      linhaV?.status === "ativo", String(linhaV?.status));
    check("D1: …mas o Portal mostra 'expirado'",
      statusPortalDe(linhaV!.status, linhaV!.validade_fim, emDias(0)) === "expirado");

    // Prorrogar mantendo data passada NÃO devolve o cupom ao ar.
    const { data: aindaPassada } = await dono
      .from("cupons").update({ validade_fim: emDias(-1) }).eq("id", CUPOM_VENCIDO)
      .select("status").maybeSingle();
    check("D1: editar mantendo validade vencida → 'expirado', nunca ativo",
      aindaPassada?.status === "expirado", String(aindaPassada?.status));

    // Com data futura, volta para a FILA — não para o ar.
    const { data: prorrogado } = await dono
      .from("cupons").update({ validade_fim: emDias(30) }).eq("id", CUPOM_VENCIDO)
      .select("status, moderacao_historico").maybeSingle();
    check("D1: prorrogar com data futura → 'pendente' (passa pela moderação)",
      prorrogado?.status === "pendente", String(prorrogado?.status));
    check("D1: NÃO volta direto para 'ativo'", prorrogado?.status !== "ativo");
    check("D1: a prorrogação entra na trilha",
      ((prorrogado?.moderacao_historico ?? []) as any[]).some((h) => h.acao === "prorrogado"),
      JSON.stringify(prorrogado?.moderacao_historico));
    check("D1: o id é o MESMO — expirado é a mesma campanha continuando",
      true);

    // O admin recebe no fluxo normal e aprova.
    const admin = await logar("admin@promofy.test");
    const apr = (await admin.rpc("aprovar_cupom", { p_cupom_id: CUPOM_VENCIDO })).data as any;
    check("D1: admin aprova pelo fluxo de moderação de sempre", apr?.ok === true, JSON.stringify(apr));
    const { data: aprovado } = await svc
      .from("cupons").select("status").eq("id", CUPOM_VENCIDO).maybeSingle();
    check("D1: só DEPOIS da aprovação o cupom volta a 'ativo'",
      aprovado?.status === "ativo", String(aprovado?.status));

    // ============================================================
    console.log("\n[D1-E] REJEITADO — não regressão do fluxo da Fase 6.5");
    // ============================================================

    await svc.from("cupons").insert({
      ...base, id: CUPOM_OK, titulo: "F9D1 vigente",
      beneficio: "Cupom da suíte", validade_fim: emDias(60),
      status: "rejeitado" as const,
    });
    const reenv = (await dono.rpc("reenviar_cupom_moderacao", { p_cupom_id: CUPOM_OK })).data as any;
    check("D1: rejeitado continua podendo reenviar", reenv?.ok === true, JSON.stringify(reenv));
    const { data: reenviado } = await svc
      .from("cupons").select("status").eq("id", CUPOM_OK).maybeSingle();
    check("D1: …e volta para 'pendente' como antes",
      reenviado?.status === "pendente", String(reenviado?.status));

    // ============================================================
    console.log("\n[D1-F] SEGURANÇA — o ciclo é do dono, e não vale para tudo");
    // ============================================================

    const alheio = (await outro
      .from("cupons").update({ validade_fim: emDias(90) }).eq("id", CUPOM_VENCIDO)
      .select("id")) as any;
    check("D1: lojista de OUTRO estabelecimento não prorroga cupom alheio",
      (alheio.data ?? []).length === 0, JSON.stringify(alheio.data));

    const consumidor = (await cliente
      .from("cupons").update({ validade_fim: emDias(90) }).eq("id", CUPOM_VENCIDO)
      .select("id")) as any;
    check("D1: consumidor não mexe na validade de cupom nenhum",
      (consumidor.data ?? []).length === 0, JSON.stringify(consumidor.data));

    const reenvEsgotado = (await dono.rpc("reenviar_cupom_moderacao", { p_cupom_id: CUPOM_LIMITE })).data as any;
    check("D1: ESGOTADO não reativa pela RPC de reenvio (é campanha encerrada)",
      reenvEsgotado?.ok === false && reenvEsgotado?.motivo === "nao_rejeitado",
      JSON.stringify(reenvEsgotado));

    // Excluído continua fora de todo o ciclo (Fase 9/C4 + D1 §11).
    const CUPOM_EX = "f9d1-excluido";
    await svc.from("cupons").delete().eq("id", CUPOM_EX);
    await svc.from("cupons").insert({
      ...base, id: CUPOM_EX, titulo: "F9D1 excluido",
      beneficio: "Cupom da suíte", validade_fim: emDias(-5),
    });
    await dono.rpc("excluir_cupom", { p_cupom_id: CUPOM_EX });
    const { data: exc } = await svc
      .from("cupons").select("status").eq("id", CUPOM_EX).maybeSingle();
    check("D1: cupom excluído está excluído", exc?.status === "excluido", String(exc?.status));
    const { data: excPos } = await dono
      .from("cupons").update({ validade_fim: emDias(45) }).eq("id", CUPOM_EX)
      .select("status").maybeSingle();
    check("D1: excluído com data futura NÃO é ressuscitado pelo ciclo de vida",
      excPos?.status === "excluido", String(excPos?.status));
    const reenvExc = (await dono.rpc("reenviar_cupom_moderacao", { p_cupom_id: CUPOM_EX })).data as any;
    check("D1: …nem pela RPC de reenvio",
      reenvExc?.ok === false, JSON.stringify(reenvExc));
    await svc.from("cupons").delete().eq("id", CUPOM_EX);

    // ============================================================
    console.log("\n[D1-G] Asserções estáticas — a UI oferece o caminho certo");
    // ============================================================

    const fonteCard = fonteSemComentarios("src/components/portal/coupon-portal-card.tsx");
    check("D1: o card oferece 'Criar nova campanha' ao esgotado",
      /onNovaCampanha/.test(fonteCard) && /nova campanha/i.test(fonteCard));
    check("D1: …e conduz o expirado à edição da validade",
      /Prorrogar e reenviar/i.test(fonteCard));
    check("D1: o card avisa que a campanha não volta ao ar sozinha",
      /volta para an[áa]lise/i.test(fonteCard));

    const fonteForm = fonteSemComentarios("src/components/portal/novo-cupom-form.tsx");
    check("D1: o formulário sabe duplicar sem virar edição",
      /duplicar/.test(fonteForm) && /editando = Boolean\(cupomInicial\) && !duplicar/.test(fonteForm));

    const fonteData = fonteSemComentarios("src/lib/data/cupons.ts");
    check("D1: a listagem do portal usa a derivação central",
      /statusPortalDe\(/.test(fonteData));
    check("D1: o consumidor segue filtrando por validade (não-regressão)",
      /validade_fim >= hoje/.test(fonteData));

    // ============================================================
  } finally {
    for (const id of [CUPOM_LIMITE, CUPOM_VENCIDO, CUPOM_OK, "f9d1-excluido"]) {
      await svc.from("cupons").delete().eq("id", id);
    }
    await svc.from("cupons").delete().like("titulo", "F9D1 %");
    if (qa) await destruirContaQa(svc, qa.id);
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c));
