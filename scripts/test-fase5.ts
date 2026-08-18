/**
 * Testes da Fase 5. Roda contra o stack seedado (`npm run db:reset` antes).
 *
 * Prova:
 *  - JANELA DE CONSUMO no servidor: `ativar_cupom` recusa com motivo
 *    'fora_da_janela' fora do dia/horário do cupom, e NÃO cria linha;
 *  - tolerância a `horarios` malformado — string vazia, lixo, `dias`
 *    não-array: tudo vira "sem restrição", NUNCA exceção (senão um cupom
 *    aprovado viraria tijolo permanente, sem diagnóstico);
 *  - guarda anti-regressão dos cupons legados do seed (só `{descricao}`);
 *  - idempotência preservada: quem já ativou dentro da janela reabre o
 *    mesmo código mesmo depois de a janela fechar;
 *  - PARIDADE SQL↔TS: `dentro_da_janela` (banco) e `dentroDaJanela`
 *    (src/lib/janela.ts) concordam caso a caso, inclusive nos malformados;
 *  - `usos` em meu_estado_consumidor (consumidos/limite/restantes) —
 *    o insumo do selo "utilizado";
 *  - pontos REAIS no retorno: `responder_nps.pontos` e
 *    `estados[].pontos_resgate` — a animação "+N" nunca é número fixo;
 *  - `normalizarCodigoCupom` (puro) e a validação sem hífens ponta a ponta.
 *
 * Fixtures próprios com prefixo `f5-*` — o seed NÃO é tocado (quem precisa
 * mexer na janela do seed é o helper das suítes legadas, _janela-fixture.ts).
 * O `finally` apaga só o que este arquivo criou.
 */
import { config } from "dotenv";
const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dentroDaJanela, type JanelaConsumo } from "../src/lib/janela";
import { normalizarCodigoCupom } from "../src/lib/codigo-cupom";
import { DIAS_SEMANA, diaSemanaBrt } from "../src/lib/dias";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  console.error(`Faltam variáveis em ${envFile}.`);
  process.exit(1);
}
console.log(`\n[test-fase5] alvo: ${hosted ? "HOSPEDADO (muta dados!)" : "local"} (${new URL(url).host})\n`);

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

const svc = createClient(url!, serviceRole!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = () =>
  createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function logar(email: string, senha = SENHA): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

type Jsonb = Record<string, unknown> | null;
const motivo = (r: Jsonb) => (r as { motivo?: string })?.motivo;
const okr = (r: Jsonb) => (r as { ok?: boolean })?.ok === true;
const estadoDe = (r: Jsonb) =>
  (r as { estado?: { codigo?: string; ativado_em?: string; row_id?: number } })?.estado;

// fixtures desta fase
const LEGADO = "f5-legado";
const DENTRO = "f5-dentro";
const FORA_DIA = "f5-fora-dia";
const FORA_HORA = "f5-fora-hora";
const LIMITE2 = "f5-limite2";
const TODOS = [LEGADO, DENTRO, FORA_DIA, FORA_HORA, LIMITE2];

async function limparCiclo(uid: string) {
  await svc.from("cupons_usuario").delete().eq("usuario_id", uid);
  await svc.from("cupom_eventos").delete().eq("usuario_id", uid);
  await svc.from("pontos_transacoes").delete().eq("usuario_id", uid).neq("acao", "bonus");
}

/** "HH:MM" no fuso America/Sao_Paulo de um instante qualquer. */
function horaBrt(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const h = p.find((x) => x.type === "hour")!.value;
  const m = p.find((x) => x.type === "minute")!.value;
  return `${h}:${m}`;
}

/** Desloca "HH:MM" por N horas, com wraparound de 24h. */
function deslocarHoras(hhmm: string, horas: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h + horas) % 24) + 24) % 24;
  return `${String(total).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

let qa: ContaQa | null = null;

async function main(): Promise<number> {
  // Fase 6/H4: conta de consumo criada e destruida por esta suite.
  qa = await criarContaQa(svc, "f5", { nome: "QA Fase5" });
  console.log(`[conta efemera] ${qa.email}`);
  const consumidor = await logar(qa.email, qa.senha);
  const uid = (await consumidor.auth.getUser()).data.user!.id;
  const lojista = await logar("lojista@promofy.test"); // dono de e1

  // categoria de e1 (o trigger checar_categoria_cupom exige coerência)
  const { data: e1 } = await svc
    .from("estabelecimentos")
    .select("categoria_id")
    .eq("id", "e1")
    .single();
  const catE1 = e1!.categoria_id as string;

  const base = {
    estabelecimento_id: "e1",
    categoria_id: catE1,
    economia: 10,
    validade_fim: "2035-12-31",
    status: "ativo" as const,
  };

  await svc.from("cupons").delete().in("id", TODOS);
  await limparCiclo(uid);

  try {
    // ==========================================================
    console.log("[funções puras — dentroDaJanela (sem banco)]");
    {
      const hoje = diaSemanaBrt();
      const outro = hoje === "Seg" ? "Ter" : "Seg";
      check("sem janela (undefined) → sem restrição", dentroDaJanela(undefined));
      check("objeto vazio → sem restrição", dentroDaJanela({}));
      check("dias vazio → sem restrição", dentroDaJanela({ dias: [] }));
      check("dias com hoje → dentro", dentroDaJanela({ dias: [hoje] }));
      check("dias sem hoje → fora", !dentroDaJanela({ dias: [outro] }));
      check("00:00–23:59 → dentro", dentroDaJanela({ inicio: "00:00", fim: "23:59" }));
      check(
        "os 7 dias + dia inteiro → dentro",
        dentroDaJanela({ dias: [...DIAS_SEMANA], inicio: "00:00", fim: "23:59" }),
      );
      // fronteira de minuto: 23:59:30 tem de continuar dentro de 00:00–23:59
      check(
        "23:59:30 ainda está dentro de 00:00–23:59 (truncagem ao minuto)",
        dentroDaJanela(
          { inicio: "00:00", fim: "23:59" },
          new Date("2026-07-31T02:59:30Z"), // 23:59:30 BRT do dia 30
        ),
      );
      // janela que cruza a meia-noite
      const j = { inicio: "22:00", fim: "02:00" };
      check("cruza meia-noite: 23:30 BRT → dentro", dentroDaJanela(j, new Date("2026-07-31T02:30:00Z")));
      check("cruza meia-noite: 01:00 BRT → dentro", dentroDaJanela(j, new Date("2026-07-31T04:00:00Z")));
      check("cruza meia-noite: 12:00 BRT → fora", !dentroDaJanela(j, new Date("2026-07-31T15:00:00Z")));
      // hora com 1 dígito, como o Postgres aceita em '8:00'::time
      check(
        "'8:00' é hora válida (comparação numérica, não lexicográfica)",
        dentroDaJanela({ inicio: "8:00", fim: "10:00" }, new Date("2026-07-31T12:30:00Z")), // 09:30 BRT
      );
    }

    console.log("\n[funções puras — malformado é SEM RESTRIÇÃO, nunca 'fora']");
    {
      // é isto que impede um cupom aprovado de virar tijolo: o form do
      // portal grava inicio/fim vazios quando o lojista limpa os campos
      const casos: Array<[string, unknown]> = [
        ["null", null],
        ['inicio ""', { inicio: "", fim: "" }],
        ['fim "" com inicio válido', { inicio: "08:00", fim: "" }],
        ['inicio "abc"', { inicio: "abc", fim: "xyz" }],
        ["inicio 99:99 (fora de faixa)", { inicio: "99:99", fim: "10:00" }],
        ['dias escalar ("Seg")', { dias: "Seg" }],
        ["dias objeto", { dias: {} }],
        ["só descricao (legado)", { descricao: "Seg a Sáb, 10h às 22h" }],
      ];
      for (const [nome, valor] of casos) {
        check(`${nome} → sem restrição`, dentroDaJanela(valor as JanelaConsumo));
      }
    }

    console.log("\n[funções puras — normalizarCodigoCupom]");
    {
      check("já canônico passa igual", normalizarCodigoCupom("PRMF-KK8P-8U6Q") === "PRMF-KK8P-8U6Q");
      check("sem hífens vira canônico", normalizarCodigoCupom("PRMFKK8P8U6Q") === "PRMF-KK8P-8U6Q");
      check("só os 8 significativos vira canônico", normalizarCodigoCupom("KK8P8U6Q") === "PRMF-KK8P-8U6Q");
      check("minúsculo vira canônico", normalizarCodigoCupom("prmf-kk8p-8u6q") === "PRMF-KK8P-8U6Q");
      check("com espaços vira canônico", normalizarCodigoCupom(" prmf kk8p 8u6q ") === "PRMF-KK8P-8U6Q");
      check("hífens extras → canônico", normalizarCodigoCupom("--KK8P--8U6Q--") === "PRMF-KK8P-8U6Q");
      check("string vazia → vazia", normalizarCodigoCupom("") === "");
      check(
        "comprimento errado NÃO inventa formato",
        normalizarCodigoCupom("KK8P8U6") === "KK8P8U6",
        normalizarCodigoCupom("KK8P8U6"),
      );
      check("só pontuação → vazia", normalizarCodigoCupom("---") === "");
    }

    // ==========================================================
    console.log("\n[janela — barreira no SERVIDOR]");

    // cupom legado (só descricao): guarda anti-regressão do seed.
    // A ativação também entrega o RELÓGIO DO BANCO (ativado_em), que é
    // quem dá o veredito — nenhum fixture de hora é derivado do host.
    await svc.from("cupons").insert({
      ...base,
      id: LEGADO,
      titulo: "F5 legado (só descricao)",
      horarios: { descricao: "Seg a Sáb, 10h às 22h" },
    });
    let relogioDb = new Date();
    {
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: LEGADO })).data as Jsonb;
      check("cupom legado (só descricao) continua ativável", okr(r), JSON.stringify(r));
      const ativadoEm = estadoDe(r)?.ativado_em;
      if (ativadoEm) relogioDb = new Date(ativadoEm);
      check("ativação devolve ativado_em (relógio do banco)", Boolean(ativadoEm));
    }
    const hojeDb = diaSemanaBrt(relogioDb);
    const horaDb = horaBrt(relogioDb);
    console.log(`  ..  relógio do banco: ${hojeDb} ${horaDb} BRT`);
    await limparCiclo(uid);

    // dentro: hoje (dia do BANCO) + dia inteiro
    await svc.from("cupons").insert({
      ...base,
      id: DENTRO,
      titulo: "F5 dentro da janela",
      horarios: { descricao: "hoje", dias: [hojeDb], inicio: "00:00", fim: "23:59" },
    });
    {
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: DENTRO })).data as Jsonb;
      check("dentro da janela (hoje, dia inteiro) → ok", okr(r), JSON.stringify(r));
    }
    await limparCiclo(uid);

    // fora por DIA: um dia que não seja hoje NEM AMANHÃ no banco.
    //
    // Excluir amanhã passou a ser obrigatório na Fase 9/QA (migration 30):
    // a admissão deixou de perguntar "estou dentro da janela agora?" e
    // passou a perguntar "o prazo de ativação alcança a janela?". Um cupom
    // de amanhã com janela 00:00–23:59 É alcançável quando a suíte roda
    // depois das 19:00 — e não é, quando roda de manhã. Manter `amanhã`
    // aqui deixaria o teste dependente da HORA em que ele roda, que é o
    // tipo de flakiness que esta casa não aceita.
    const idxHoje = DIAS_SEMANA.indexOf(hojeDb);
    const amanhaDb = DIAS_SEMANA[(idxHoje + 1) % DIAS_SEMANA.length];
    const outroDia = DIAS_SEMANA.filter((d) => d !== hojeDb && d !== amanhaDb);
    await svc.from("cupons").insert({
      ...base,
      id: FORA_DIA,
      titulo: "F5 fora do dia",
      horarios: { descricao: "outro dia", dias: [outroDia[0]], inicio: "00:00", fim: "23:59" },
    });
    {
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: FORA_DIA })).data as Jsonb;
      check("fora do DIA → motivo 'fora_da_janela'", motivo(r) === "fora_da_janela", JSON.stringify(r));
      const { data } = await svc
        .from("cupons_usuario")
        .select("id")
        .eq("usuario_id", uid)
        .eq("cupom_id", FORA_DIA);
      check("recusa por dia NÃO cria linha em cupons_usuario", (data?.length ?? 0) === 0);
    }

    // fora por HORA: janela de 2h que terminou 1h atrás, ancorada no
    // relógio do BANCO. Margem de 1h — a de 1 minuto seria margem zero
    // contra qualquer dessincronia de relógio.
    await svc.from("cupons").insert({
      ...base,
      id: FORA_HORA,
      titulo: "F5 fora da hora",
      horarios: {
        descricao: "janela passada",
        dias: [],
        inicio: deslocarHoras(horaDb, -3),
        fim: deslocarHoras(horaDb, -1),
      },
    });
    {
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: FORA_HORA })).data as Jsonb;
      check(
        "fora da HORA → motivo 'fora_da_janela'",
        motivo(r) === "fora_da_janela",
        `janela ${deslocarHoras(horaDb, -3)}–${deslocarHoras(horaDb, -1)} vs ${horaDb} · ${JSON.stringify(r)}`,
      );
      const { data } = await svc
        .from("cupons_usuario")
        .select("id")
        .eq("usuario_id", uid)
        .eq("cupom_id", FORA_HORA);
      check("recusa por hora NÃO cria linha em cupons_usuario", (data?.length ?? 0) === 0);
    }

    // malformado no BANCO não pode levantar exceção dentro da RPC
    {
      await svc
        .from("cupons")
        .update({ horarios: { descricao: "x", dias: ["Sex"], inicio: "", fim: "" } })
        .eq("id", DENTRO);
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: DENTRO })).data as Jsonb;
      // dias:["Sex"] pode ou não ser hoje; o que importa é NÃO explodir
      const respondeu = okr(r) || motivo(r) === "fora_da_janela";
      check(
        "horarios com inicio/fim vazios NÃO derruba ativar_cupom (responde jsonb)",
        respondeu,
        JSON.stringify(r),
      );
      await limparCiclo(uid);
      await svc
        .from("cupons")
        .update({ horarios: { descricao: "hoje", dias: [hojeDb], inicio: "00:00", fim: "23:59" } })
        .eq("id", DENTRO);
    }

    console.log("\n[janela — idempotência não perde o cupom já ativado]");
    {
      const r1 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: DENTRO })).data as Jsonb;
      const codigo1 = estadoDe(r1)?.codigo ?? "";
      check("ativa dentro da janela", okr(r1) && codigo1.length > 0);
      // a janela fecha enquanto o cupom já está ativo
      await svc
        .from("cupons")
        .update({
          horarios: { descricao: "fechou", dias: [outroDia[0]], inicio: "00:00", fim: "23:59" },
        })
        .eq("id", DENTRO);
      const r2 = (await consumidor.rpc("ativar_cupom", { p_cupom_id: DENTRO })).data as Jsonb;
      check(
        "janela fechou depois: reabre o MESMO código (ja_ativo), não recusa",
        okr(r2) &&
          (r2 as { ja_ativo?: boolean }).ja_ativo === true &&
          estadoDe(r2)?.codigo === codigo1,
        JSON.stringify(r2),
      );
      await svc
        .from("cupons")
        .update({ horarios: { descricao: "hoje", dias: [hojeDb], inicio: "00:00", fim: "23:59" } })
        .eq("id", DENTRO);
    }
    await limparCiclo(uid);

    // ==========================================================
    console.log("\n[paridade SQL ↔ TS — dentro_da_janela]");
    {
      // Só casos NÃO marginais no relógio: o SQL e o TS leem "agora"
      // independentemente, então um caso de fronteira poderia divergir
      // legitimamente entre as duas leituras.
      const casos: Array<[string, unknown]> = [
        ["null", null],
        ["objeto vazio", {}],
        ["array (não-objeto)", []],
        ["só descricao", { descricao: "Seg a Sáb, 10h às 22h" }],
        ["dias vazio + dia inteiro", { dias: [], inicio: "00:00", fim: "23:59" }],
        ["os 7 dias", { dias: [...DIAS_SEMANA] }],
        ["dia impossível", { dias: ["Xxx"] }],
        ["hoje (do banco)", { dias: [hojeDb] }],
        ["outro dia", { dias: [outroDia[0]] }],
        ['inicio ""', { inicio: "", fim: "" }],
        ['inicio "abc"', { inicio: "abc", fim: "xyz" }],
        ["dias escalar", { dias: "Seg" }],
        ["dias objeto", { dias: {} }],
        ["hora 00:00–23:59", { inicio: "00:00", fim: "23:59" }],
      ];
      for (const [nome, valor] of casos) {
        const { data, error } = await consumidor.rpc("dentro_da_janela", { p_horarios: valor });
        const ts = dentroDaJanela(valor as JanelaConsumo);
        check(
          `paridade: ${nome} (sql=${data} ts=${ts})`,
          error === null && data === ts,
          error?.message ?? "",
        );
      }
    }

    // ==========================================================
    console.log("\n[usos — insumo do selo 'utilizado']");
    await limparCiclo(uid);
    await svc.from("cupons").insert({
      ...base,
      id: LIMITE2,
      titulo: "F5 limite 2 por usuário",
      limite_por_usuario: 2,
      horarios: { descricao: "sempre" },
    });

    interface Uso {
      cupom_id: string;
      consumidos: number;
      limite: number;
      restantes: number;
    }
    const usosDe = async (c: SupabaseClient): Promise<Uso[]> => {
      const { data } = await c.rpc("meu_estado_consumidor");
      return ((data as unknown as { usos?: Uso[] })?.usos ?? []) as Uso[];
    };

    {
      const usos = await usosDe(consumidor);
      check("sem nenhum uso: cupom não aparece em `usos`", !usos.some((u) => u.cupom_id === LIMITE2));
    }
    {
      // 1 ativação vigente já consome vaga (mesma regra de ativar_cupom)
      await consumidor.rpc("ativar_cupom", { p_cupom_id: LIMITE2 });
      const u = (await usosDe(consumidor)).find((x) => x.cupom_id === LIMITE2);
      check(
        "limite 2, 1 ativa vigente → consumidos=1, restantes=1 (SEM selo)",
        u?.consumidos === 1 && u?.limite === 2 && u?.restantes === 1,
        JSON.stringify(u),
      );
    }
    {
      // valida a 1ª e ativa+valida a 2ª → esgota a cota do usuário
      const { data: linha1 } = await svc
        .from("cupons_usuario")
        .select("codigo")
        .eq("usuario_id", uid)
        .eq("cupom_id", LIMITE2)
        .eq("status", "ativo")
        .single();
      await lojista.rpc("validar_cupom", { p_codigo: linha1!.codigo });
      await consumidor.rpc("ativar_cupom", { p_cupom_id: LIMITE2 });
      const { data: linha2 } = await svc
        .from("cupons_usuario")
        .select("codigo")
        .eq("usuario_id", uid)
        .eq("cupom_id", LIMITE2)
        .eq("status", "ativo")
        .single();
      await lojista.rpc("validar_cupom", { p_codigo: linha2!.codigo });

      const u = (await usosDe(consumidor)).find((x) => x.cupom_id === LIMITE2);
      check(
        "limite 2, 2 validadas → restantes=0 (AGORA o selo aparece)",
        u?.consumidos === 2 && u?.restantes === 0,
        JSON.stringify(u),
      );
      check(
        "cota esgotada → ativar de novo dá limite_usuario",
        motivo((await consumidor.rpc("ativar_cupom", { p_cupom_id: LIMITE2 })).data as Jsonb) ===
          "limite_usuario",
      );
    }

    // ==========================================================
    console.log("\n[pontos reais no retorno — a animação nunca é número fixo]");
    await limparCiclo(uid);
    {
      const { data: cfgResgate } = await svc
        .from("config_pontos")
        .select("pontos")
        .eq("acao", "resgate")
        .single();
      const { data: cfgNps } = await svc
        .from("config_pontos")
        .select("pontos")
        .eq("acao", "nps")
        .single();

      const rAtiv = (await consumidor.rpc("ativar_cupom", { p_cupom_id: LEGADO })).data as Jsonb;
      const codigo = estadoDe(rAtiv)?.codigo ?? "";
      await lojista.rpc("validar_cupom", { p_codigo: codigo });

      // pontos_resgate volta em estados[] — é o que dispara o "+N" no polling
      {
        const { data } = await consumidor.rpc("meu_estado_consumidor");
        const estados = (data as unknown as { estados?: Array<Record<string, unknown>> })?.estados ?? [];
        const e = estados.find((x) => x.cupom_id === LEGADO);
        check(
          "estados[].pontos_resgate = config_pontos.resgate",
          Number(e?.pontos_resgate) === (cfgResgate!.pontos as number),
          `${e?.pontos_resgate} vs ${cfgResgate!.pontos}`,
        );
      }

      const { data: rowVal } = await svc
        .from("cupons_usuario")
        .select("id")
        .eq("codigo", codigo)
        .single();
      const rowId = rowVal!.id as number;
      {
        const r = (await consumidor.rpc("responder_nps", { p_row_id: rowId, p_nota: 9 }))
          .data as Jsonb;
        check(
          "responder_nps devolve `pontos` = config_pontos.nps",
          okr(r) && (r as { pontos?: number }).pontos === (cfgNps!.pontos as number),
          JSON.stringify(r),
        );
      }
      {
        const r = (await consumidor.rpc("responder_nps", { p_row_id: rowId, p_nota: 3 }))
          .data as Jsonb;
        check(
          "responder_nps repetido → ja_respondido e pontos = 0 (não anima de novo)",
          okr(r) &&
            (r as { ja_respondido?: boolean }).ja_respondido === true &&
            (r as { pontos?: number }).pontos === 0,
          JSON.stringify(r),
        );
      }
    }

    // ==========================================================
    console.log("\n[validação sem hífens — ponta a ponta]");
    await limparCiclo(uid);
    {
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: LEGADO })).data as Jsonb;
      const codigo = estadoDe(r)?.codigo ?? "";
      const semHifen = codigo.replace(/-/g, ""); // "PRMFXXXXYYYY"
      check("código gerado está no formato canônico", /^PRMF-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(codigo), codigo);
      check(
        "normalizar(sem hífens) reconstitui o código exato",
        normalizarCodigoCupom(semHifen) === codigo,
        `${semHifen} → ${normalizarCodigoCupom(semHifen)}`,
      );
      const v = (await lojista.rpc("validar_cupom", { p_codigo: normalizarCodigoCupom(semHifen) }))
        .data as Jsonb;
      check("lojista valida o código digitado SEM hífens", okr(v), JSON.stringify(v));
    }
    {
      // e o caminho de colagem (com hífens) continua funcionando
      await limparCiclo(uid);
      const r = (await consumidor.rpc("ativar_cupom", { p_cupom_id: LEGADO })).data as Jsonb;
      const codigo = estadoDe(r)?.codigo ?? "";
      const v = (await lojista.rpc("validar_cupom", { p_codigo: normalizarCodigoCupom(codigo) }))
        .data as Jsonb;
      check("colagem COM hífens continua validando", okr(v), JSON.stringify(v));
    }
  } finally {
    // restauração — só o que este arquivo criou
    await limparCiclo(uid);
    await svc.from("cupons").delete().in("id", TODOS);
  }

  return encerrar(passed, failed);
}

/** `process.exit` NÃO executa `finally` — ver scripts/_qa-conta.ts. */
main()
  .then(async (code) => {
    await destruirContaQa(svc, qa?.id);
    process.exit(code);
  })
  .catch(async (err) => {
    console.error("test-fase5 falhou:", err);
    await destruirContaQa(svc, qa?.id);
    process.exit(1);
  });
