/**
 * Testes da Fase 6.5 — editar cupom (C2), rejeição com motivo (C5) e a
 * correção do benefício duplicado (EXTRA).
 *
 * O que esta suíte existe para provar, em ordem de importância:
 *
 *  1. A MATRIZ DE IMUTABILIDADE É DO BANCO, não da Server Action. O lojista
 *     tem `grant update` em 24 colunas de `cupons` desde a Fase 6 — uma
 *     regra escrita só na action seria contornável com um PATCH direto no
 *     PostgREST. Por isso TODAS as asserções da matriz aqui usam o cliente
 *     do lojista falando direto com a tabela, sem passar pela action.
 *
 *  2. O CONTRATO DE EDIÇÃO É PARCIAL. O form do `/e` é um subconjunto
 *     declarado; se a edição aceitasse o input completo, corrigir um typo
 *     apagaria janela, agendamento, prazo, regras e imagem — e, como três
 *     desses são materiais, ainda rebaixaria o cupom para 'pendente'. A
 *     asserção de "payload de uma chave" é a que pega esse bug.
 *
 *  3. O CICLO DE MODERAÇÃO FECHA: rejeitar exige motivo, o lojista lê,
 *     corrige, reenvia, o admin aprova — e o histórico conta a história.
 *
 * Fixtures `f65-*`, conta `qa-f65` efêmera, `finally` apagando só o que
 * criou, `main()` devolvendo o código (`process.exit` não roda `finally`).
 */
import { config } from "dotenv";
const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { regrasParaExibir } from "../src/lib/cupom-campos";
import { montarPatchCupom } from "../src/lib/cupom-patch";
import { historicoDeJson, motivoAtual } from "../src/lib/moderacao";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  console.error(`Faltam variáveis em ${envFile}.`);
  process.exit(1);
}
console.log(
  `\n[test-fase65] alvo: ${hosted ? "HOSPEDADO (muta dados!)" : "local"} (${new URL(url).host})\n`,
);

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

// fixtures desta fase
const BASE = "f65-base";
const CICLO = "f65-ciclo";
const LEGADO = "f65-legado";
const TODOS = [BASE, CICLO, LEGADO];

let qa: ContaQa | null = null;

/** Estado completo de um cupom, direto da tabela (service_role, sem RLS). */
async function ler(id: string) {
  const { data } = await svc.from("cupons").select("*").eq("id", id).single();
  return data!;
}

async function main(): Promise<number> {
  qa = await criarContaQa(svc, "f65", { nome: "QA Fase6.5" });
  console.log(`[conta efêmera] ${qa.email}`);

  const consumidor = await logar(qa.email, qa.senha);
  const lojista = await logar("lojista@promofy.test"); // dono do e1
  const lojista2 = await logar("lojista2@promofy.test"); // dono do e2
  const admin = await logar("admin@promofy.test");

  const janelaRestrita = {
    descricao: "Ter a Dom, 18h às 23h",
    dias: ["Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
    inicio: "18:00",
    fim: "23:00",
  };
  const baseCupom = {
    estabelecimento_id: "e1",
    categoria_id: "alimentacao",
    validade_fim: "2030-12-31",
    status: "ativo" as const,
  };

  try {
    await svc.from("cupons").delete().in("id", TODOS);
    const { error: errFix } = await svc.from("cupons").insert([
      {
        ...baseCupom,
        id: BASE,
        titulo: "F65 base",
        beneficio: "Prato + bebida",
        economia: 20,
        horarios: janelaRestrita,
        prazo_ativacao_horas: 8,
        validade_inicio: "2029-01-01",
        ocultar_ate_inicio: true,
        regras: ["Não acumulável."],
        imagem: "/img/f65.jpg",
        limite_por_usuario: 2,
      },
      {
        ...baseCupom,
        id: CICLO,
        titulo: "F65 ciclo",
        beneficio: "b",
        economia: 10,
        horarios: { descricao: "Todos os dias" },
        prazo_ativacao_horas: 5,
        validade_inicio: null,
        ocultar_ate_inicio: false,
        regras: [],
        imagem: "",
        limite_por_usuario: 1,
        status: "pendente",
      },
      {
        // legado: `regras` é cópia literal do benefício (o que a action
        // fazia desde a Fase 2)
        ...baseCupom,
        id: LEGADO,
        titulo: "F65 legado",
        beneficio: "Um expresso por visita",
        economia: 5,
        horarios: { descricao: "Todos os dias" },
        prazo_ativacao_horas: 5,
        validade_inicio: null,
        ocultar_ate_inicio: false,
        regras: ["Um expresso por visita"],
        imagem: "",
        limite_por_usuario: 1,
      },
    ]);
    if (errFix) throw new Error(`fixtures f65-*: ${errFix.message}`);

    // ---------------------------------------------------------------
    console.log("[C2 — posse: quem NÃO pode editar]");
    {
      const { data, error } = await lojista2
        .from("cupons")
        .update({ titulo: "invadido" })
        .eq("id", BASE)
        .select("id");
      // A policy FILTRA a linha (não é erro de grant): 0 linhas afetadas.
      check(
        "lojista2 NÃO edita cupom do e1 (0 linhas, policy filtra)",
        !error && (data?.length ?? 0) === 0,
        error?.message ?? `linhas=${data?.length}`,
      );
    }
    {
      const { data, error } = await consumidor
        .from("cupons")
        .update({ titulo: "invadido" })
        .eq("id", BASE)
        .select("id");
      check(
        "consumidor NÃO edita cupom nenhum",
        (data?.length ?? 0) === 0 || !!error,
        error?.message ?? `linhas=${data?.length}`,
      );
    }

    // ---------------------------------------------------------------
    // O construtor do patch é puro de propósito (src/lib/cupom-patch.ts):
    // é ELE que pode regredir e reintroduzir a perda silenciosa. Provado
    // aqui direto, sem banco — a prova via banco vem logo abaixo.
    console.log("\n[C2 — construtor do patch: grava só o que veio]");
    {
      const r = montarPatchCupom({ titulo: "Só o título" });
      const chaves = r.ok ? Object.keys(r.patch) : [];
      check(
        "payload de uma chave → patch de UMA chave",
        r.ok && chaves.length === 1 && chaves[0] === "titulo",
        chaves.join(","),
      );
      const vazio = montarPatchCupom({});
      check(
        "payload vazio → patch vazio (nenhum default vaza)",
        vazio.ok && Object.keys(vazio.patch).length === 0,
      );
      const meia = montarPatchCupom({ titulo: "x", dias: ["Seg"] });
      check(
        "janela pela metade é RECUSADA (nunca remonta horarios)",
        !meia.ok && /dias, início e fim juntos/.test(meia.ok ? "" : meia.erro),
        meia.ok ? "aceitou" : meia.erro,
      );
      const meia2 = montarPatchCupom({ horaInicio: "10:00", horaFim: "20:00" });
      check("faixa sem dias também é recusada", !meia2.ok);
      const inteira = montarPatchCupom({
        dias: ["Seg", "Ter"],
        horaInicio: "10:00",
        horaFim: "20:00",
      });
      check(
        "os três juntos remontam a janela",
        inteira.ok &&
          JSON.stringify(inteira.patch.horarios) ===
            JSON.stringify({
              descricao: "Seg, Ter, 10:00 às 20:00",
              dias: ["Seg", "Ter"],
              inicio: "10:00",
              fim: "20:00",
            }),
        inteira.ok ? JSON.stringify(inteira.patch.horarios) : inteira.erro,
      );
      const semPrazo = montarPatchCupom({ titulo: "x" });
      check(
        "prazo ausente NÃO é reescrito para o mínimo",
        semPrazo.ok && !("prazo_ativacao_horas" in semPrazo.patch),
      );
      const ilim = montarPatchCupom({ limiteUsuarioIlimitado: true });
      check(
        "ilimitado sem número vira null (e só essa chave)",
        ilim.ok &&
          ilim.patch.limite_por_usuario === null &&
          Object.keys(ilim.patch).length === 1,
      );
    }

    // ---------------------------------------------------------------
    console.log("\n[C2 — contrato parcial: o bug que o form do /e causaria]");
    {
      const antes = await ler(BASE);
      // Exatamente o que a action monta com um payload de UMA chave.
      const { error } = await lojista
        .from("cupons")
        .update({ titulo: "F65 base (typo corrigido)" })
        .eq("id", BASE)
        .select("id");
      const depois = await ler(BASE);
      const preservados = [
        "horarios",
        "validade_inicio",
        "ocultar_ate_inicio",
        "prazo_ativacao_horas",
        "regras",
        "imagem",
      ] as const;
      const perdidos = preservados.filter(
        (c) => JSON.stringify(antes[c]) !== JSON.stringify(depois[c]),
      );
      check(
        "payload de UMA chave preserva janela/agendamento/prazo/regras/imagem",
        !error && perdidos.length === 0,
        perdidos.join(", "),
      );
      check(
        "…e o cupom ativo NÃO é rebaixado (título não é material)",
        depois.status === "ativo",
        String(depois.status),
      );
    }

    // ---------------------------------------------------------------
    console.log("\n[C2 — matriz, SEM consumo]");
    {
      await lojista.from("cupons").update({ beneficio: "Prato + bebida + doce" }).eq("id", BASE);
      const d = await ler(BASE);
      check("edição material rebaixa ativo → pendente", d.status === "pendente");
      await svc.from("cupons").update({ status: "ativo" }).eq("id", BASE);
    }

    // ---------------------------------------------------------------
    console.log("\n[C2 — matriz, COM validação (V)]");
    {
      await svc.from("cupons_usuario").insert({
        usuario_id: qa.id,
        cupom_id: BASE,
        status: "validado",
        codigo: "PRMF-F650-0001",
      });
      const e1 = await lojista.from("cupons").update({ economia: 99 }).eq("id", BASE).select("id");
      check("economia com validação → bloqueada (P0601)", e1.error?.code === "P0601", e1.error?.code);
      const e2 = await lojista
        .from("cupons")
        .update({ economia_variavel: true })
        .eq("id", BASE)
        .select("id");
      check("economia_variavel com validação → bloqueada", e2.error?.code === "P0601", e2.error?.code);
      const e3 = await lojista.from("cupons").update({ limite_total: 0 }).eq("id", BASE).select("id");
      check("limite_total abaixo das validações → bloqueado (P0604)", e3.error?.code === "P0604", e3.error?.code);
      const ok = await lojista.from("cupons").update({ titulo: "F65 base v3" }).eq("id", BASE).select("id");
      check("título continua livre com validação", !ok.error && ok.data?.length === 1);
      await svc.from("cupons").update({ status: "ativo" }).eq("id", BASE);
    }

    // ---------------------------------------------------------------
    console.log("\n[C2 — matriz, COM ativação viva (A)]");
    {
      await svc.from("cupons_usuario").insert({
        usuario_id: qa.id,
        cupom_id: BASE,
        status: "ativo",
        codigo: "PRMF-F650-0002",
        expira_em: new Date(Date.now() + 5 * 3600e3).toISOString(),
      });
      const e1 = await lojista.from("cupons").update({ beneficio: "outro" }).eq("id", BASE).select("id");
      check("benefício com ativação viva → bloqueado (P0602)", e1.error?.code === "P0602", e1.error?.code);
      check(
        "…e a mensagem diz quantas ativações e quando vence",
        /1 cliente\(s\)/.test(e1.error?.message ?? "") && /vence em/.test(e1.error?.message ?? ""),
        e1.error?.message?.slice(0, 80),
      );
      const e2 = await lojista.from("cupons").update({ taxas: ["entrega"] }).eq("id", BASE).select("id");
      check("taxas com ativação viva → bloqueadas", e2.error?.code === "P0602", e2.error?.code);
      const e3 = await lojista
        .from("cupons")
        .update({ validade_fim: "2027-01-01" })
        .eq("id", BASE)
        .select("id");
      check("encurtar validade com ativação viva → bloqueado (P0605)", e3.error?.code === "P0605", e3.error?.code);
      const e4 = await lojista
        .from("cupons")
        .update({ validade_fim: "2031-12-31" })
        .eq("id", BASE)
        .select("id");
      check("ESTENDER validade é permitido", !e4.error && e4.data?.length === 1, e4.error?.code);
      const e5 = await lojista
        .from("cupons")
        .update({ horarios: { ...janelaRestrita, dias: ["Ter"] } })
        .eq("id", BASE)
        .select("id");
      check("estreitar dias com ativação viva → bloqueado (P0606)", e5.error?.code === "P0606", e5.error?.code);
      const e6 = await lojista
        .from("cupons")
        .update({
          horarios: { ...janelaRestrita, dias: [...janelaRestrita.dias, "Seg"], inicio: "17:00" },
        })
        .eq("id", BASE)
        .select("id");
      check("AMPLIAR dias e horário é permitido", !e6.error && e6.data?.length === 1, e6.error?.code);
      const e7 = await lojista
        .from("cupons")
        .update({ limite_por_usuario: 1 })
        .eq("id", BASE)
        .select("id");
      check(
        "limite por usuário abaixo do consumido → bloqueado (P0603)",
        e7.error?.code === "P0603",
        e7.error?.code,
      );
      const e8 = await lojista
        .from("cupons")
        .update({ limite_por_usuario: null })
        .eq("id", BASE)
        .select("id");
      check("ilimitado (null) é sempre permitido", !e8.error && e8.data?.length === 1, e8.error?.code);
    }

    // ---------------------------------------------------------------
    console.log("\n[C2 — o trigger não barra admin nem service_role]");
    {
      const a = await svc.from("cupons").update({ economia: 42 }).eq("id", BASE).select("id");
      check("service_role (auth.uid null) passa", !a.error && a.data?.length === 1, a.error?.code);
      const b = await admin.from("cupons").update({ beneficio: "ajuste do admin" }).eq("id", BASE).select("id");
      // admin não tem policy de UPDATE em cupons (só as RPCs) → 0 linhas,
      // mas o importante é que o TRIGGER não o barrou com P06xx.
      check(
        "admin não é barrado pelo trigger (nenhum P06xx)",
        !b.error || !String(b.error.code).startsWith("P06"),
        b.error?.code,
      );
      await svc.from("cupons_usuario").delete().eq("cupom_id", BASE);
    }

    // ---------------------------------------------------------------
    console.log("\n[C5 — ciclo completo: rejeitar → ver → corrigir → reenviar → aprovar]");
    {
      let r = (await admin.rpc("rejeitar_cupom", { p_cupom_id: CICLO, p_motivo: "  " })).data as Jsonb;
      check("rejeitar sem motivo → motivo_obrigatorio", motivo(r) === "motivo_obrigatorio", JSON.stringify(r));

      r = (await lojista.rpc("rejeitar_cupom", { p_cupom_id: CICLO, p_motivo: "x" })).data as Jsonb;
      check("lojista NÃO rejeita → sem_permissao", motivo(r) === "sem_permissao");

      const MOTIVO = "O benefício não deixa claro o que está incluso.";
      r = (await admin.rpc("rejeitar_cupom", { p_cupom_id: CICLO, p_motivo: MOTIVO })).data as Jsonb;
      check("admin rejeita com motivo", okr(r));

      const d1 = await ler(CICLO);
      check(
        "motivo visível ao lojista (motivoAtual)",
        motivoAtual(d1.moderacao_historico, d1.status) === MOTIVO,
        String(motivoAtual(d1.moderacao_historico, d1.status)),
      );

      r = (await lojista2.rpc("reenviar_cupom_moderacao", { p_cupom_id: CICLO })).data as Jsonb;
      check("lojista2 NÃO reenvia cupom alheio → sem_permissao", motivo(r) === "sem_permissao");

      await lojista.from("cupons").update({ beneficio: "Prato + bebida + sobremesa" }).eq("id", CICLO);
      const d2 = await ler(CICLO);
      check("editar cupom rejeitado NÃO o manda sozinho para a fila", d2.status === "rejeitado");

      r = (await lojista.rpc("reenviar_cupom_moderacao", { p_cupom_id: CICLO })).data as Jsonb;
      check("dono reenvia → pendente", okr(r));
      r = (await lojista.rpc("reenviar_cupom_moderacao", { p_cupom_id: CICLO })).data as Jsonb;
      check("reenviar de novo → nao_rejeitado", motivo(r) === "nao_rejeitado");

      r = (await admin.rpc("aprovar_cupom", { p_cupom_id: CICLO })).data as Jsonb;
      check("admin aprova → ativo", okr(r));

      const d3 = await ler(CICLO);
      const acoes = historicoDeJson(d3.moderacao_historico).map((h) => h.acao);
      check(
        "histórico conta a história inteira",
        acoes.join(",") === "rejeitado,editado_material,reenviado,aprovado",
        acoes.join(","),
      );
      check(
        "motivo some da UI depois de corrigido (status já não é rejeitado)",
        motivoAtual(d3.moderacao_historico, d3.status) === undefined,
      );
      check("publicado_em preenchido na aprovação", !!d3.publicado_em);
    }

    // ---------------------------------------------------------------
    console.log("\n[C5 — o lojista não reescreve o próprio histórico]");
    {
      const r = await lojista
        .from("cupons")
        .update({ moderacao_historico: [] })
        .eq("id", CICLO)
        .select("id");
      check(
        "moderacao_historico fora do grant → 42501",
        r.error?.code === "42501",
        r.error?.code ?? "sem erro",
      );
    }

    // ---------------------------------------------------------------
    console.log("\n[EXTRA — benefício duplicado]");
    {
      const leg = await ler(LEGADO);
      check(
        "legado: regras == benefício é deduplicado na exibição",
        regrasParaExibir(leg.regras as string[], leg.beneficio).length === 0,
        JSON.stringify(regrasParaExibir(leg.regras as string[], leg.beneficio)),
      );
      const b = await ler(BASE);
      check(
        "regra complementar continua aparecendo",
        regrasParaExibir(b.regras as string[], b.beneficio).length === 1,
        JSON.stringify(b.regras),
      );
      check(
        "dedupe tolera espaços e caixa",
        regrasParaExibir(["  UM EXPRESSO POR VISITA "], "Um expresso por visita").length === 0,
      );
      check(
        "benefício vazio não apaga as regras",
        regrasParaExibir(["Não acumulável."], "").length === 1,
      );
    }
  } finally {
    await svc.from("cupons_usuario").delete().eq("usuario_id", qa?.id ?? "");
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
    console.error("test-fase65 falhou:", err);
    await destruirContaQa(svc, qa?.id);
    process.exit(1);
  });
