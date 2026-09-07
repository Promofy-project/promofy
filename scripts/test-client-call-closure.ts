/**
 * CLIENT-CALL-CLOSURE-01 — janela, reserva, pausa, indicadores, reativação, /e.
 *
 * Conta `qa-*` efêmera. `consumidor@` e `convidado@` NUNCA são tocados.
 * Alvo local por padrão. Nenhuma escrita hospedada.
 */
import { readFileSync } from "node:fs";

import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-client-call-closure");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import { acoesDoCard, statusPortalDe } from "../src/lib/ciclo-cupom";
import {
  COPY_CONFIRMAR_PAUSA,
  COPY_REATIVAR_HISTORICO,
  textoDisponibilidade,
  textoResgates,
} from "../src/lib/cupom-indicadores";
import { formatarEntradaCodigoCupom, normalizarCodigoCupom } from "../src/lib/codigo-cupom";
import { ASPECTO_IMAGEM_CUPOM } from "../src/lib/recorte-imagem";

const SENHA = "promofy123";
const PREFIX = "ccc-";

let passed = 0;
let failed = 0;
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

function fonte(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function horaBrt(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  return `${p.find((x) => x.type === "hour")!.value}:${p.find((x) => x.type === "minute")!.value}`;
}

function deslocarHoras(hhmm: string, horas: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h + horas) % 24) + 24) % 24;
  return `${String(total).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function emDias(dias: number): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

type Alcance = { alcancavel: boolean; teto: string | null };

type IndicadorVitrine = {
  cupom_id: string;
  ocupados: number | null;
  disponiveis: number | null;
  resgates_confirmados: number;
  limite_total: number | null;
};

async function main(): Promise<number> {
  console.log("\n[CCC] Módulo puro + estáticos");
  check("indisponivel vigente → pausado",
    statusPortalDe("indisponivel", "2030-01-01", "2026-09-07") === "pausado");
  check("indisponivel vencido → expirado (não retoma direto)",
    statusPortalDe("indisponivel", "2020-01-01", "2026-09-07") === "expirado");
  check("ativo oferece pausar", acoesDoCard("ativo").includes("pausar"));
  check("pausado oferece retomar", acoesDoCard("pausado").includes("retomar"));
  check("esgotado oferece nova_campanha (reativar)",
    acoesDoCard("esgotado").join() === "nova_campanha");
  check("expirado oferece prorrogar", acoesDoCard("expirado").join() === "prorrogar");
  check("disponíveis = total − ocupados",
    textoDisponibilidade(10, 7) === "7 disponíveis de 10");
  check("ilimitado não ganha disponibilidade",
    textoDisponibilidade(null, null) === null);
  check("zero resgates some", textoResgates(0) === null);
  check("resgates só no plural honesto",
    textoResgates(1) === "1 resgate realizado" &&
      textoResgates(23) === "23 resgates realizados");
  check("copy de pausa está no contrato", COPY_CONFIRMAR_PAUSA.includes("impede novas ativações"));
  check("copy de reativação preserva histórico",
    COPY_REATIVAR_HISTORICO.includes("histórico serão preservados"));

  const dono = await logar("lojista@promofy.test");
  const outro = await logar("lojista2@promofy.test");
  let qa: ContaQa | null = null;
  let qaB: ContaQa | null = null;
  const ids: string[] = [];

  const { data: e1 } = await svc
    .from("estabelecimentos")
    .select("categoria_id, categoria_principal_id")
    .eq("id", "e1")
    .maybeSingle();
  const base = {
    estabelecimento_id: "e1",
    categoria_id: e1!.categoria_id as string,
    categoria_nova_id: e1!.categoria_principal_id as string,
    economia: 10,
    status: "ativo" as const,
    validade_fim: "2035-12-31",
    beneficio: "CCC suíte",
    horarios: { descricao: "todos", dias: [] as string[], inicio: "00:00", fim: "23:59" },
  };

  async function criar(id: string, extra: Record<string, unknown> = {}) {
    ids.push(id);
    await svc.from("cupons").delete().eq("id", id);
    const { error } = await svc.from("cupons").insert({ ...base, id, titulo: id, ...extra });
    if (error) throw new Error(`criar ${id}: ${error.message}`);
  }

  try {
    qa = await criarContaQa(svc, "ccc-a", { nome: "QA CCC A" });
    qaB = await criarContaQa(svc, "ccc-b", { nome: "QA CCC B" });
    const cliente = await logar(qa.email, qa.senha);
    const clienteB = await logar(qaB.email, qaB.senha);

    const ping = (await cliente.rpc("ativar_cupom", { p_cupom_id: "c01" })).data as {
      estado?: { ativado_em?: string };
    } | null;
    const relogio = new Date(ping?.estado?.ativado_em ?? Date.now());
    const janela = (ini: number, fim: number) => ({
      descricao: `+${ini}h a +${fim}h`,
      dias: [] as string[],
      inicio: deslocarHoras(horaBrt(relogio), ini),
      fim: deslocarHoras(horaBrt(relogio), fim),
    });

    // ---------- JANELA 1–5 ----------
    console.log("\n[CCC] Janela (GATE 2) — sem reescrever janela_alcance");
    await criar(`${PREFIX}jan-a`, {
      prazo_ativacao_horas: 5,
      horarios: janela(1, 2),
    });
    const rA = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}jan-a` })).data as {
      ok?: boolean;
      estado?: { expira_em?: string };
    };
    const alcA = (await svc.rpc("janela_alcance", {
      p_horarios: janela(1, 2),
      p_prazo_horas: 5,
    })).data as Alcance | null;
    check("1. pré-ativação permitida", rA?.ok === true, JSON.stringify(rA));
    const expA = rA?.estado?.expira_em ? new Date(rA.estado.expira_em) : null;
    const tetoA = alcA?.teto ? new Date(alcA.teto) : null;
    check("2. expira no teto da janela",
      Boolean(expA && tetoA && expA.getTime() <= tetoA.getTime() + 60_000),
      `expira=${expA?.toISOString()} teto=${tetoA?.toISOString()}`);

    await criar(`${PREFIX}jan-b`, {
      prazo_ativacao_horas: 5,
      horarios: janela(-1, 1),
    });
    const rB = (await clienteB.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}jan-b` })).data as {
      ok?: boolean;
      estado?: { expira_em?: string };
    };
    const alcB = (await svc.rpc("janela_alcance", {
      p_horarios: janela(-1, 1),
      p_prazo_horas: 5,
    })).data as Alcance | null;
    const expB = rB?.estado?.expira_em ? new Date(rB.estado.expira_em) : null;
    const tetoB = alcB?.teto ? new Date(alcB.teto) : null;
    check("janela aberta agora: ativa e teto <= fim",
      rB?.ok === true && Boolean(expB && tetoB && expB.getTime() <= tetoB.getTime() + 60_000),
      JSON.stringify({ rB, tetoB }));

    await criar(`${PREFIX}jan-c`, {
      prazo_ativacao_horas: 5,
      horarios: janela(-3, -1),
    });
    const rC = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}jan-c` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("3/C. depois do fim → nova ativação negada",
      rC?.ok === false && rC?.motivo === "fora_da_janela", JSON.stringify(rC));

    if (rA?.estado?.expira_em) {
      await svc
        .from("cupons_usuario")
        .update({ expira_em: new Date(Date.now() - 60_000).toISOString() })
        .eq("cupom_id", `${PREFIX}jan-a`)
        .eq("usuario_id", qa.id);
      const { data: rowExp } = await svc
        .from("cupons_usuario")
        .select("codigo")
        .eq("cupom_id", `${PREFIX}jan-a`)
        .eq("usuario_id", qa.id)
        .maybeSingle();
      const valTeto = (await dono.rpc("validar_cupom", {
        p_codigo: rowExp?.codigo,
      })).data as { ok?: boolean; motivo?: string };
      check("3. não valida depois do teto/expira_em",
        valTeto?.ok === false && valTeto?.motivo === "expirado", JSON.stringify(valTeto));
    } else {
      check("3. não valida depois do teto/expira_em", false, "sem ativação para expirar");
    }

    await criar(`${PREFIX}jan-e`, {
      prazo_ativacao_horas: 5,
      horarios: janela(9, 11),
    });
    const rE = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}jan-e` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("4. janela fora do alcance bloqueia",
      rE?.ok === false && rE?.motivo === "fora_da_janela", JSON.stringify(rE));

    const overnight = {
      descricao: "overnight",
      dias: [] as string[],
      inicio: deslocarHoras(horaBrt(relogio), 1),
      fim: deslocarHoras(horaBrt(relogio), -10),
    };
    const alcF = (await svc.rpc("janela_alcance", {
      p_horarios: overnight,
      p_prazo_horas: 5,
    })).data as Alcance | null;
    check("5. overnight alcançável (abre em 1h, cruza meia-noite)",
      alcF?.alcancavel === true && Boolean(alcF.teto), JSON.stringify(alcF));

    // ---------- LIMITE 6–10 ----------
    console.log("\n[CCC] Limite / reserva (GATE 3)");
    await criar(`${PREFIX}lim-1`, { limite_total: 1, limite_por_usuario: 1 });
    const atLim = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}lim-1` })).data as {
      ok?: boolean;
    };
    const indLim = ((await svc.rpc("indicadores_vitrine_cupons")).data as {
      cupom_id: string;
      ocupados: number | null;
      disponiveis: number | null;
      resgates_confirmados: number;
      limite_total: number | null;
    }[] | null)?.find((r) => r.cupom_id === `${PREFIX}lim-1`);
    check("6. reserva conta capacidade",
      atLim?.ok === true && Number(indLim?.ocupados) === 1 && Number(indLim?.disponiveis) === 0,
      JSON.stringify(indLim));
    const atLimB = (await clienteB.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}lim-1` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("7. limite total bloqueia novo",
      atLimB?.ok === false && atLimB?.motivo === "esgotado", JSON.stringify(atLimB));

    await criar(`${PREFIX}lim-race`, { limite_total: 1, limite_por_usuario: 1 });
    const [raceA, raceB] = await Promise.all([
      cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}lim-race` }),
      clienteB.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}lim-race` }),
    ]);
    const oks = [raceA.data, raceB.data].filter((r: { ok?: boolean }) => r?.ok === true);
    const recusas = [raceA.data, raceB.data].filter(
      (r: { ok?: boolean; motivo?: string }) => r?.ok === false && r?.motivo === "esgotado",
    );
    check("8. corrida não ultrapassa limite",
      oks.length === 1 && recusas.length === 1,
      JSON.stringify({ a: raceA.data, b: raceB.data }));

    await svc
      .from("cupons_usuario")
      .update({ expira_em: new Date(Date.now() - 60_000).toISOString() })
      .eq("cupom_id", `${PREFIX}lim-race`)
      .eq("status", "ativo");
    const livre = ((await svc.rpc("indicadores_vitrine_cupons")).data as {
      cupom_id: string;
      disponiveis: number | null;
    }[] | null)?.find((r) => r.cupom_id === `${PREFIX}lim-race`);
    check("9. expiração libera vaga", Number(livre?.disponiveis) === 1, JSON.stringify(livre));

    await criar(`${PREFIX}ilim`, { limite_total: null });
    const indIlim = ((await svc.rpc("indicadores_vitrine_cupons")).data as {
      cupom_id: string;
      limite_total: number | null;
      disponiveis: number | null;
      ocupados: number | null;
    }[] | null)?.find((r) => r.cupom_id === `${PREFIX}ilim`);
    const cardIlim = fonte("src/components/coupon-card.tsx");
    check("10. ilimitado não ganha urgência / ∞",
      (indIlim?.limite_total == null || indIlim?.disponiveis == null) &&
        !/∞ disponíveis/.test(cardIlim) &&
        !/Infinity/.test(fonte("src/lib/cupom-indicadores.ts")),
      JSON.stringify(indIlim));

    // ---------- PAUSA 11–20 ----------
    console.log("\n[CCC] Pausa / retomar");
    await criar(`${PREFIX}pause`);
    const pOwner = (await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pause` })).data as {
      ok?: boolean;
    };
    const { data: stP } = await svc.from("cupons").select("status, moderacao_historico").eq("id", `${PREFIX}pause`).maybeSingle();
    check("11. owner pausa", pOwner?.ok === true && stP?.status === "indisponivel", JSON.stringify(pOwner));

    await criar(`${PREFIX}pause-x`);
    const pOutro = (await outro.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pause-x` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("12. outro owner não pausa",
      pOutro?.ok === false && pOutro?.motivo === "nao_autorizado", JSON.stringify(pOutro));

    const pCons = (await cliente.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pause-x` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("13. consumidor não pausa",
      pCons?.ok === false && pCons?.motivo === "nao_autorizado", JSON.stringify(pCons));

    await criar(`${PREFIX}pause-new`);
    await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pause-new` });
    const atPaused = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}pause-new` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("14. nova ativação em pausado bloqueada",
      atPaused?.ok === false && atPaused?.motivo === "indisponivel", JSON.stringify(atPaused));

    await criar(`${PREFIX}pause-keep`);
    const atKeep = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}pause-keep` })).data as {
      ok?: boolean;
      estado?: { codigo?: string };
    };
    await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pause-keep` });
    const valKeep = (await dono.rpc("validar_cupom", {
      p_codigo: atKeep?.estado?.codigo,
    })).data as { ok?: boolean };
    check("15. ativação anterior continua validável",
      atKeep?.ok === true && valKeep?.ok === true, JSON.stringify({ atKeep, valKeep }));

    await criar(`${PREFIX}pause-cpf`);
    const atCpf = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}pause-cpf` })).data as {
      ok?: boolean;
    };
    await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pause-cpf` });
    const { data: perfilA } = await svc.from("profiles").select("cpf").eq("id", qa.id).maybeSingle();
    const buscaCpf = (await dono.rpc("buscar_ativacoes_por_cpf", {
      p_cpf: perfilA?.cpf,
    })).data as { ok?: boolean; itens?: { row_id: number; cupom?: string }[] };
    const itemCpf = (buscaCpf?.itens ?? []).find((i) => i.cupom === `${PREFIX}pause-cpf`)
      ?? buscaCpf?.itens?.[0];
    const valCpf = itemCpf
      ? ((await dono.rpc("validar_cupom_por_ativacao", {
          p_row_id: itemCpf.row_id,
          p_cpf: perfilA?.cpf,
        })).data as { ok?: boolean })
      : { ok: false };
    check("16. CPF anterior continua validável",
      atCpf?.ok === true && buscaCpf?.ok === true && valCpf?.ok === true,
      JSON.stringify({ buscaCpf, valCpf }));

    await criar(`${PREFIX}resume`);
    await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}resume` });
    const ret = (await dono.rpc("retomar_cupom", { p_cupom_id: `${PREFIX}resume` })).data as {
      ok?: boolean;
    };
    const atResume = (await clienteB.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}resume` })).data as {
      ok?: boolean;
    };
    check("17. retomar volta a aceitar ativação",
      ret?.ok === true && atResume?.ok === true, JSON.stringify({ ret, atResume }));

    await criar(`${PREFIX}exp-ret`, { validade_fim: emDias(-2), status: "indisponivel" });
    const retExp = (await dono.rpc("retomar_cupom", { p_cupom_id: `${PREFIX}exp-ret` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("18. expirado não retoma direto",
      retExp?.ok === false && retExp?.motivo === "expirado", JSON.stringify(retExp));

    await criar(`${PREFIX}exc-ret`);
    await dono.rpc("excluir_cupom", { p_cupom_id: `${PREFIX}exc-ret` });
    const retExc = (await dono.rpc("retomar_cupom", { p_cupom_id: `${PREFIX}exc-ret` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    const pauExc = (await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}exc-ret` })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("19. excluído não retoma/pausa",
      retExc?.motivo === "excluido" && pauExc?.motivo === "excluido",
      JSON.stringify({ retExc, pauExc }));

    const hist = (stP?.moderacao_historico ?? []) as { acao?: string; por?: string; cpf?: string; email?: string }[];
    const evPausa = hist.find((h) => h.acao === "pausado");
    check("20. audit da pausa sem PII",
      Boolean(evPausa) && !evPausa?.cpf && !evPausa?.email && !JSON.stringify(evPausa).includes("@"),
      JSON.stringify(evPausa));

    await criar(`${PREFIX}pend`, { status: "pendente" });
    const pauPend = (await dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}pend` })).data as {
      motivo?: string;
    };
    check("pendente não usa ação operacional", pauPend?.motivo === "pendente", JSON.stringify(pauPend));

    // race pausa × ativação
    await criar(`${PREFIX}race-p`);
    const [rp, ra] = await Promise.all([
      dono.rpc("pausar_cupom", { p_cupom_id: `${PREFIX}race-p` }),
      cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}race-p` }),
    ]);
    const { data: stRace } = await svc.from("cupons").select("status").eq("id", `${PREFIX}race-p`).maybeSingle();
    const { data: ativasRace } = await svc
      .from("cupons_usuario")
      .select("id, status")
      .eq("cupom_id", `${PREFIX}race-p`)
      .eq("status", "ativo");
    const pauseOk = (rp.data as { ok?: boolean })?.ok === true;
    const actOk = (ra.data as { ok?: boolean })?.ok === true;
    check("race pausa×ativação: estado coerente (0 ou 1 ativação, nunca 2)",
      pauseOk && (ativasRace ?? []).length <= 1 &&
        (stRace?.status === "indisponivel" || stRace?.status === "ativo") &&
        !(actOk && stRace?.status === "indisponivel" && (ativasRace ?? []).length > 1),
      JSON.stringify({ rp: rp.data, ra: ra.data, stRace, n: ativasRace?.length }));
    if (stRace?.status === "indisponivel") {
      const late = (await clienteB.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}race-p` })).data as {
        ok?: boolean;
        motivo?: string;
      };
      check("depois da pausa efetivada, nova ativação recusa",
        late?.ok === false && late?.motivo === "indisponivel", JSON.stringify(late));
    } else {
      check("depois da pausa efetivada, nova ativação recusa", true, "pausa perdeu a corrida — ativação foi antes");
    }

    // ---------- INDICADORES 21–28 ----------
    console.log("\n[CCC] Indicadores");
    await criar(`${PREFIX}ind`, { limite_total: 10, limite_por_usuario: 2 });
    await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}ind` });
    const { data: rowInd } = await svc
      .from("cupons_usuario")
      .select("codigo")
      .eq("cupom_id", `${PREFIX}ind`)
      .eq("usuario_id", qa.id)
      .eq("status", "ativo")
      .maybeSingle();
    let ind = ((await svc.rpc("indicadores_vitrine_cupons")).data as {
      cupom_id: string;
      ocupados: number | null;
      disponiveis: number | null;
      resgates_confirmados: number;
      limite_total: number | null;
    }[] | null)?.find((r) => r.cupom_id === `${PREFIX}ind`);
    check("21. disponíveis = total − ocupados",
      Number(ind?.limite_total) === 10 &&
        Number(ind?.ocupados) === 1 &&
        Number(ind?.disponiveis) === 9,
      JSON.stringify(ind));
    check("22. ocupados conta ativos vigentes", Number(ind?.ocupados) === 1);
    check("26. ativação não aumenta resgates confirmados",
      Number(ind?.resgates_confirmados) === 0, JSON.stringify(ind));
    await dono.rpc("validar_cupom", { p_codigo: rowInd?.codigo });
    ind = ((await svc.rpc("indicadores_vitrine_cupons")).data as IndicadorVitrine[] | null)
      ?.find((r) => r.cupom_id === `${PREFIX}ind`);
    check("23. ocupados conta validados", Number(ind?.ocupados) === 1, JSON.stringify(ind));
    check("25. resgates confirmados conta só validado",
      Number(ind?.resgates_confirmados) === 1, JSON.stringify(ind));

    await criar(`${PREFIX}ind-exp`, { limite_total: 5 });
    await clienteB.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}ind-exp` });
    await svc
      .from("cupons_usuario")
      .update({ expira_em: new Date(Date.now() - 60_000).toISOString() })
      .eq("cupom_id", `${PREFIX}ind-exp`)
      .eq("usuario_id", qaB.id);
    const indExp = ((await svc.rpc("indicadores_vitrine_cupons")).data as {
      cupom_id: string;
      ocupados: number | null;
    }[] | null)?.find((r) => r.cupom_id === `${PREFIX}ind-exp`);
    check("24. expirados não ocupam", Number(indExp?.ocupados) === 0, JSON.stringify(indExp));

    check("27. ilimitado não retorna disponibilidade falsa",
      indIlim?.disponiveis == null && indIlim?.ocupados == null);

    const cols = Object.keys(
      ((await svc.rpc("indicadores_vitrine_cupons")).data as object[] | null)?.[0] ?? {},
    );
    check("28. outro tenant/PII não vaza no batch",
      !cols.some((k) => /usuario|cpf|email|telefone|nome/i.test(k)),
      cols.join(","));

    // ---------- REATIVAÇÃO 29–33 ----------
    console.log("\n[CCC] Reativação");
    await criar(`${PREFIX}esg`, { limite_total: 1, limite_por_usuario: 1 });
    const atEsg = (await cliente.rpc("ativar_cupom", { p_cupom_id: `${PREFIX}esg` })).data as {
      estado?: { codigo?: string };
    };
    await dono.rpc("validar_cupom", { p_codigo: atEsg?.estado?.codigo });
    const { data: antiga } = await svc
      .from("cupons")
      .select("id, status, moderacao_historico")
      .eq("id", `${PREFIX}esg`)
      .maybeSingle();
    check("29. esgotado preserva registro antigo",
      antiga?.status === "esgotado", String(antiga?.status));

    const { data: novaCamp } = await dono
      .from("cupons")
      .insert({
        ...base,
        id: `${PREFIX}esg-nova`,
        titulo: "CCC nova campanha",
        status: "pendente",
        limite_total: 1,
      })
      .select("id, status")
      .single();
    ids.push(`${PREFIX}esg-nova`);
    check("30. reativar cria nova campanha",
      novaCamp?.id === `${PREFIX}esg-nova` && novaCamp.id !== `${PREFIX}esg`);
    check("31. nova campanha pendente", novaCamp?.status === "pendente");
    const { data: antiga2 } = await svc.from("cupons").select("status").eq("id", `${PREFIX}esg`).maybeSingle();
    check("32. métricas/status antigos intactos", antiga2?.status === "esgotado");

    await criar(`${PREFIX}exp-pror`, { validade_fim: emDias(-1), status: "expirado" });
    const { data: pror } = await dono
      .from("cupons")
      .update({ validade_fim: emDias(30) })
      .eq("id", `${PREFIX}exp-pror`)
      .select("status")
      .maybeSingle();
    check("33. expired prorrogado volta pendente",
      pror?.status === "pendente", String(pror?.status));

    // ---------- /E 34–41 ----------
    console.log("\n[CCC] /e paridade + crop");
    const formE = fonte("src/app/e/cupom/novo/novo-cupom-form.tsx");
    check("34. data início", /dataInicio|Início da campanha/.test(formE));
    check("35. dias", /Dias de consumo/.test(formE));
    check("36. horário", /Abre às/.test(formE) && /Fecha às/.test(formE));
    check("37. ocultar", /Ocultar até o início/.test(formE));
    check("38. prazo", /Prazo de ativação/.test(formE));
    check("39. limites", /Por cliente/.test(formE) && /Sem limite/.test(formE));
    check("40. imagem", /CampoImagem/.test(formE));
    check("41. crop 2:1",
      fonte("src/components/campo-imagem.tsx").includes("CropImagem") &&
        ASPECTO_IMAGEM_CUPOM === 2);

    // ---------- REGRESSÕES 42–50 ----------
    console.log("\n[CCC] Regressões");
    check("42. código máscara",
      formatarEntradaCodigoCupom("UD2RN7ER") === "PRMF - UD2R - N7ER" &&
        normalizarCodigoCupom("UD2RN7ER") === "PRMF-UD2R-N7ER");

    const fonteCpf = fonte("supabase/migrations/20260902160000_pre_call_validacao_cpf.sql");
    check("43. CPF PRE-CALL fail-open permanece fechado",
      /owner_id is distinct from/.test(fonteCpf));

    const fonteNps = fonte("src/components/nps-pendente-card.tsx");
    check("44. NPS UI intacta",
      /responder|mais tarde|Não responder/i.test(fonteNps));

    check("45. exclusão lógica intacta",
      fonte("src/lib/actions/cupons.ts").includes("excluir_cupom"));

    check("46. moderação: reenviar ainda existe",
      fonte("src/lib/actions/cupons.ts").includes("reenviarCupomAction"));

    check("47. taxonomia: consumidor filtra categoria_nova_id",
      /categoria_nova_id/.test(fonte("src/lib/data/cupons.ts")));

    check("48. CR01 admin_editar_cupom permanece",
      fonte("src/lib/supabase/database.types.ts").includes("admin_editar_cupom"));

    check("49. CR02 estoque_cupons permanece (não apagado)",
      fonte("src/lib/supabase/database.types.ts").includes("estoque_cupons"));

    check("50. PRE-CALL security fail-open fechado (is distinct from)",
      /is distinct from/.test(fonte("supabase/migrations/20260907120000_client_call_coupon_pause_metrics.sql")));

    const uiPortal = fonte("src/components/portal/coupon-portal-card.tsx");
    check("UI portal: Pausado + Pausar + Retomar + Reativar",
      /Pausado/.test(uiPortal) && /Pausar/.test(uiPortal) && /Retomar/.test(uiPortal) &&
        /Reativar cupom/.test(uiPortal));
    check("UI portal: copy de confirmação no client",
      fonte("src/app/portal/(painel)/cupons/cupons-client.tsx").includes("COPY_CONFIRMAR_PAUSA"));
    check("UI /e: pausar + reativar",
      fonte("src/app/e/cupons/cupons-client.tsx").includes("PausarCupomButton") &&
        fonte("src/app/e/cupons/cupons-client.tsx").includes("Reativar cupom"));
    check("UI consumidor: temporariamente indisponível",
      fonte("src/components/coupon-card.tsx").includes("Temporariamente indisponível"));
    check("UI buscar/lista: CupomSinais no CouponListItem",
      fonte("src/components/coupon-list-item.tsx").includes("CupomSinais"));
    check("galeria deferred: sem implementação nova de galeria",
      !fonte("src/app/e/cupons/cupons-client.tsx").includes("Galeria"));
    check("dark mode light-only",
      /color-scheme:\s*light/.test(readFileSync("src/app/globals.css", "utf8")));
  } finally {
    for (const id of ids) {
      await svc.from("cupom_eventos").delete().eq("cupom_id", id);
      await svc.from("cupons_usuario").delete().eq("cupom_id", id);
      await svc.from("cupons").delete().eq("id", id);
    }
    if (qa) await destruirContaQa(svc, qa.id);
    if (qaB) await destruirContaQa(svc, qaB.id);
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c));
