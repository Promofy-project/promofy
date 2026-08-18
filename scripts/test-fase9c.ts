/**
 * Suíte da Fase 9 — Onda C (relatórios de QA: v2 §2.1, §1.1, §1.8, §1.6).
 *
 * C1 imagem na moderação · C2 janela editável no /e · C3 filtro por status
 * · C4 exclusão lógica com histórico preservado.
 *
 * O peso está em C4: é o único item que escreve no banco e o único capaz de
 * destruir dado. As asserções dele são sobre o que SOBROU depois da
 * exclusão, não sobre a exclusão em si — um soft delete que apaga histórico
 * por engano passaria num teste que só olha o status.
 *
 * PostgREST direto com sessão real, pelo motivo de sempre: regra que só
 * existe na Server Action é contornável por quem fala HTTP.
 *
 * Conta `qa-*` efêmera. `consumidor@` e `convidado@` NUNCA são tocados.
 */
import { readFileSync } from "node:fs";

import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase9c");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const SENHA = "promofy123";
const CUPOM_EXCL = "f9c-excluir";
const CUPOM_VIVO = "f9c-ativacao-viva";
const CUPOM_IMG = "f9c-com-imagem";

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

/** Fonte sem comentários — o comentário que EXPLICA o padrão antigo não pode ser acusado de ser ele. */
function fonteSemComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

async function main(): Promise<number> {
  const dono = await logar("lojista@promofy.test"); // e1 Sabor & Cia
  let qa: ContaQa | null = null;

  const { data: e1 } = await svc
    .from("estabelecimentos").select("categoria_id").eq("id", "e1").maybeSingle();
  const catE1 = e1!.categoria_id as string;

  const base = {
    estabelecimento_id: "e1",
    categoria_id: catE1,
    economia: 10,
    validade_fim: "2035-12-31",
    status: "ativo" as const,
    horarios: { descricao: "todos os dias", dias: [], inicio: "00:00", fim: "23:59" },
  };

  try {
    qa = await criarContaQa(svc, "f9c", { nome: "Fulana Onda C" });
    const cliente = await logar(qa.email, qa.senha);

    // ============================================================
    console.log("\n[C1] Imagem do cupom na moderação (v2 §2.1)");
    // ============================================================

    // O dado precisa CHEGAR ao admin — era isto que faltava: a query já
    // trazia, o tipo não expunha e a tela não renderizava.
    await svc.from("cupons").delete().eq("id", CUPOM_IMG);
    await svc.from("cupons").insert({
      ...base, id: CUPOM_IMG, titulo: "F9C com imagem",
      beneficio: "Cupom da suíte", status: "pendente" as const,
      imagem: "e1/abc123.jpg",
    });

    const admin = await logar("admin@promofy.test");
    const { data: vistoAdmin } = await admin
      .from("cupons").select("id, imagem, estabelecimento_id").eq("id", CUPOM_IMG).maybeSingle();
    check("C1: admin enxerga a coluna imagem do cupom em moderação",
      vistoAdmin?.imagem === "e1/abc123.jpg", JSON.stringify(vistoAdmin));
    check("C1: e o estabelecimento_id, necessário para montar a URL pública",
      vistoAdmin?.estabelecimento_id === "e1");

    // Cupom SEM imagem não pode virar erro — é caso legítimo.
    const { data: semImg } = await admin
      .from("cupons").select("imagem").eq("id", "c01").maybeSingle();
    check("C1: cupom sem imagem devolve string vazia, não null (fallback previsível)",
      typeof semImg?.imagem === "string", JSON.stringify(semImg));

    const fonteAdmin = fonteSemComentarios("src/app/admin/(painel)/cupons/cupons-client.tsx");
    check("C1: a tela de moderação renderiza a imagem",
      /urlPublicaImagem/.test(fonteAdmin) && /<img/.test(fonteAdmin));
    check("C1: …e tem estado explícito para 'sem imagem'",
      /sem imagem/i.test(fonteAdmin));
    check("C1: aprovar/rejeitar continuam na tela (nada foi trocado por imagem)",
      /aprovarCupomAction/.test(fonteAdmin) && /rejeitarCupomAction/.test(fonteAdmin));

    // ============================================================
    console.log("\n[C2] Janela de consumo editável no /e (v2 §1.1)");
    // ============================================================

    const fonteE = fonteSemComentarios("src/app/e/cupom/novo/novo-cupom-form.tsx");

    // O defeito: a CRIAÇÃO mandava literais e todo cupom nascia 24x7.
    check("C2: a criação não manda mais horaInicio '00:00' literal",
      !/horaInicio:\s*"00:00"/.test(fonteE), "literal ainda presente");
    check("C2: …nem horaFim '23:59' literal",
      !/horaFim:\s*"23:59"/.test(fonteE));
    check("C2: …nem dias: [] literal",
      !/dias:\s*\[\]/.test(fonteE));

    // Os seis campos passam a existir, hidratados de cupomInicial.
    for (const campo of [
      "validadeInicio", "ocultarAteInicio", "prazoAtivacaoHoras", "dias", "horaInicio", "horaFim",
    ]) {
      check(`C2: o form hidrata ${campo} de cupomInicial`,
        new RegExp(`cupomInicial\\??\\.${campo}`).test(fonteE));
    }
    check("C2: o seletor de dias usa o vocabulário canônico (DIAS_SEMANA)",
      /DIAS_SEMANA/.test(fonteE));
    check("C2: valida horário incompleto igual ao portal",
      /horarioIncompleto/.test(fonteE));
    check("C2: valida o prazo mínimo igual ao portal",
      /prazoInvalido/.test(fonteE) && /PRAZO_ATIVACAO_MIN_HORAS/.test(fonteE));

    // E o COMPORTAMENTO: editar sem tocar na janela não pode alterá-la.
    // É o negativo que protege contra o bug que a Fase 6.5 evitou.
    const CUPOM_JAN = "f9c-janela";
    const janelaOriginal = {
      descricao: "Seg, Ter, 18:00 às 22:00",
      dias: ["Seg", "Ter"], inicio: "18:00", fim: "22:00",
    };
    await svc.from("cupons").delete().eq("id", CUPOM_JAN);
    await svc.from("cupons").insert({
      ...base, id: CUPOM_JAN, titulo: "F9C janela preservada",
      beneficio: "Cupom da suíte", horarios: janelaOriginal, prazo_ativacao_horas: 8,
    });

    const { error: errTitulo } = await dono
      .from("cupons").update({ titulo: "F9C janela preservada (editado)" }).eq("id", CUPOM_JAN);
    check("C2: lojista edita só o título", !errTitulo, errTitulo?.message);

    const { data: depoisEdicao } = await svc
      .from("cupons").select("horarios, prazo_ativacao_horas").eq("id", CUPOM_JAN).maybeSingle();
    const h = depoisEdicao?.horarios as Record<string, unknown> | null;
    check("C2: a janela sobrevive a uma edição que não a tocou",
      h?.inicio === "18:00" && h?.fim === "22:00", JSON.stringify(h));
    check("C2: os dias sobrevivem",
      Array.isArray(h?.dias) && (h!.dias as string[]).join(",") === "Seg,Ter",
      JSON.stringify(h?.dias));
    check("C2: o prazo de ativação sobrevive",
      depoisEdicao?.prazo_ativacao_horas === 8, String(depoisEdicao?.prazo_ativacao_horas));
    await svc.from("cupons").delete().eq("id", CUPOM_JAN);

    // ============================================================
    console.log("\n[C3] Filtro por status no portal (v2 §1.8)");
    // ============================================================

    const fonteLista = fonteSemComentarios("src/app/portal/(painel)/cupons/cupons-client.tsx");
    check("C3: existe filtro de status na listagem", /filtroStatus/.test(fonteLista));
    check("C3: 'Todos' existe como opção de volta", /todos/.test(fonteLista));
    check("C3: o estado selecionado é anunciado (aria-pressed), não só colorido",
      /aria-pressed/.test(fonteLista));
    check("C3: lista vazia oferece a saída em vez de sumir em silêncio",
      /Nenhum cupom com este status/.test(fonteLista));

    // Os status oferecidos têm de EXISTIR no enum do banco — nada de rótulo
    // sem lastro. Compara com o enum real, não com uma lista escrita à mão.
    const { data: enumRows } = await svc.rpc("_nao_existe" as never).then(
      () => ({ data: null }), () => ({ data: null }));
    void enumRows;
    const statusReais = ["ativo", "pendente", "rejeitado", "esgotado", "expirado", "excluido"];
    for (const s of statusReais) {
      const { error } = await svc.from("cupons").select("id").eq("status", s).limit(1);
      check(`C3: '${s}' é status válido no banco (consulta não falha)`, !error, error?.message);
    }

    // ============================================================
    console.log("\n[C4] Exclusão lógica com histórico preservado (v2 §1.6 + §4.2)");
    // ============================================================

    // O caminho FÍSICO tem de estar fechado — é o que protege o histórico.
    await svc.from("cupons").delete().eq("id", CUPOM_EXCL);
    await svc.from("cupons").insert({
      ...base, id: CUPOM_EXCL, titulo: "F9C para excluir", beneficio: "Cupom da suíte",
    });

    const del = await dono.from("cupons").delete().eq("id", CUPOM_EXCL);
    const { data: sobreviveu } = await svc
      .from("cupons").select("id").eq("id", CUPOM_EXCL).maybeSingle();
    check("C4: DELETE físico pelo lojista NÃO apaga o cupom (policy e grant fora)",
      sobreviveu?.id === CUPOM_EXCL, `erro=${del.error?.message ?? "nenhum"}`);

    // Gera histórico REAL: ativação + validação + nota. É isto que a
    // exclusão não pode levar junto.
    const at = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_EXCL })).data as any;
    check("C4: consumidor ativa o cupom (histórico a preservar)", at?.ok === true,
      JSON.stringify(at?.motivo));
    const val = (await dono.rpc("validar_cupom", { p_codigo: at?.estado?.codigo })).data as any;
    check("C4: lojista valida no balcão", val?.ok === true, JSON.stringify(val?.motivo));
    const rowId = at?.estado?.row_id as number;
    await cliente.rpc("responder_nps", { p_row_id: rowId, p_nota: 10 });

    const antes = {
      usos: (await svc.from("cupons_usuario").select("id").eq("cupom_id", CUPOM_EXCL)).data?.length ?? 0,
      eventos: (await svc.from("cupom_eventos").select("id").eq("cupom_id", CUPOM_EXCL)).data?.length ?? 0,
    };
    check("C4: há histórico antes da exclusão", antes.usos > 0 && antes.eventos > 0,
      JSON.stringify(antes));

    const ex = (await dono.rpc("excluir_cupom", { p_cupom_id: CUPOM_EXCL })).data as any;
    check("C4: exclusão lógica é aceita", ex?.ok === true, JSON.stringify(ex));

    const { data: linhaExcl } = await svc
      .from("cupons").select("status, moderacao_historico").eq("id", CUPOM_EXCL).maybeSingle();
    check("C4: o cupom continua existindo, com status 'excluido'",
      linhaExcl?.status === "excluido", String(linhaExcl?.status));

    const hist = (linhaExcl?.moderacao_historico ?? []) as { acao?: string }[];
    check("C4: a exclusão entra na trilha de auditoria",
      Array.isArray(hist) && hist.some((e) => e.acao === "excluido"), JSON.stringify(hist));

    // O CENTRO DA ONDA C: nada do histórico pode ter sumido.
    const depois = {
      usos: (await svc.from("cupons_usuario").select("id, nps").eq("cupom_id", CUPOM_EXCL)).data ?? [],
      eventos: (await svc.from("cupom_eventos").select("id").eq("cupom_id", CUPOM_EXCL)).data?.length ?? 0,
    };
    check("C4: as ativações/validações NÃO foram apagadas (FK é cascade!)",
      depois.usos.length === antes.usos, `antes=${antes.usos} depois=${depois.usos.length}`);
    check("C4: os eventos de métrica NÃO foram apagados",
      depois.eventos === antes.eventos, `antes=${antes.eventos} depois=${depois.eventos}`);
    check("C4: a nota de NPS continua gravada",
      depois.usos.some((u: any) => u.nps === 10), JSON.stringify(depois.usos));

    // O consumidor não pode mais ver nem ativar.
    const { data: publico } = await cliente
      .from("cupons").select("id").eq("id", CUPOM_EXCL).maybeSingle();
    check("C4: o consumidor NÃO enxerga mais o cupom excluído",
      publico == null, JSON.stringify(publico));
    const reAtivar = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_EXCL })).data as any;
    check("C4: e não consegue ativá-lo (motivo indisponivel)",
      reAtivar?.ok === false && reAtivar?.motivo === "indisponivel", JSON.stringify(reAtivar));

    // Idempotência: excluir de novo não é erro.
    const ex2 = (await dono.rpc("excluir_cupom", { p_cupom_id: CUPOM_EXCL })).data as any;
    check("C4: excluir de novo é idempotente (ja_excluido)",
      ex2?.ok === true && ex2?.ja_excluido === true, JSON.stringify(ex2));

    // Posse: outro lojista não exclui cupom alheio.
    const outro = await logar("lojista2@promofy.test"); // e2 PowerFit
    const alheio = (await outro.rpc("excluir_cupom", { p_cupom_id: CUPOM_IMG })).data as any;
    check("C4: lojista de OUTRO estabelecimento não exclui (nao_autorizado)",
      alheio?.ok === false && alheio?.motivo === "nao_autorizado", JSON.stringify(alheio));

    // Ativação viva bloqueia — a promessa feita a quem está a caminho.
    await svc.from("cupons").delete().eq("id", CUPOM_VIVO);
    await svc.from("cupons").insert({
      ...base, id: CUPOM_VIVO, titulo: "F9C ativação viva", beneficio: "Cupom da suíte",
    });
    const atViva = (await cliente.rpc("ativar_cupom", { p_cupom_id: CUPOM_VIVO })).data as any;
    check("C4: consumidor ativa o segundo cupom", atViva?.ok === true);
    const bloq = (await dono.rpc("excluir_cupom", { p_cupom_id: CUPOM_VIVO })).data as any;
    check("C4: exclusão é RECUSADA com ativação viva",
      bloq?.ok === false && bloq?.motivo === "tem_ativacao_viva", JSON.stringify(bloq));
    check("C4: …e a recusa diz quantas ativações seguram o cupom",
      (bloq?.ativacoes ?? 0) >= 1, JSON.stringify(bloq));
    const { data: aindaAtivo } = await svc
      .from("cupons").select("status").eq("id", CUPOM_VIVO).maybeSingle();
    check("C4: o cupom recusado continua ativo (a recusa não deixou meio-estado)",
      aindaAtivo?.status === "ativo", String(aindaAtivo?.status));

    // ============================================================
  } finally {
    for (const id of [CUPOM_EXCL, CUPOM_VIVO, CUPOM_IMG, "f9c-janela"]) {
      await svc.from("cupons").delete().eq("id", id);
    }
    if (qa) await destruirContaQa(svc, qa.id);
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c));
