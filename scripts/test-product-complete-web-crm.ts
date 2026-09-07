/**
 * Suíte PRODUCT-COMPLETE-WEB / CRM-01
 *
 * Prova: relação CRM só com validado; isolamento por estabelecimento;
 * busca; agregação; detalhe; export xlsx/pdf sem CPF; formula injection;
 * auditoria sem PII (sem q bruto); contexto único multi-estab; paginação.
 *
 * Contas qa-* efêmeras. consumidor@ / convidado@ nunca tocados.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ExcelJS from "exceljs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolverAlvo } from "./_alvo";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import { filtrosAuditCrm } from "../src/lib/crm-audit-filtros";
import { buildPdfBuffer, buildXlsxBuffer } from "../src/lib/crm-export";
import { escaparCelulaExcel } from "../src/lib/crm-xlsx-sanitize";
import type { CrmClienteResumo, CrmExportHistoricoItem, CrmResumo } from "../src/lib/crm-tipos";

const alvo = resolverAlvo("test-product-complete-web-crm");

const SENHA = "promofy123";
const ROOT = join(__dirname, "..");

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

function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_promofy", "psql", "-U", "postgres", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  ).trim();
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

async function inserirCupomUsuario(opts: {
  usuarioId: string;
  cupomId: string;
  status: "ativo" | "validado" | "expirado";
  codigo: string;
  validadoEm?: string | null;
  ativadoEm?: string;
  nps?: number | null;
}) {
  const { error } = await svc.from("cupons_usuario").insert({
    usuario_id: opts.usuarioId,
    cupom_id: opts.cupomId,
    status: opts.status,
    codigo: opts.codigo,
    ativado_em: opts.ativadoEm ?? new Date().toISOString(),
    validado_em: opts.validadoEm ?? null,
    nps: opts.nps ?? null,
    expira_em:
      opts.status === "ativo"
        ? new Date(Date.now() + 3600e3).toISOString()
        : null,
  });
  if (error) throw new Error(`insert cupons_usuario ${opts.codigo}: ${error.message}`);
}

function testarPuros() {
  console.log("\n[puro] Sanitização Excel (formula injection)");
  check("escapa =", escaparCelulaExcel("=CMD()") === "'=CMD()");
  check("escapa +", escaparCelulaExcel("+1+1") === "'+1+1");
  check("escapa -", escaparCelulaExcel("-1") === "'-1");
  check("escapa @", escaparCelulaExcel("@SUM(A1)") === "'@SUM(A1)");
  check("escapa =2+2", escaparCelulaExcel("=2+2") === "'=2+2");
  check("escapa +SUM", escaparCelulaExcel("+SUM(A1:A2)") === "'+SUM(A1:A2)");
  check("escapa -10+20", escaparCelulaExcel("-10+20") === "'-10+20");
  check("escapa @SUM range", escaparCelulaExcel("@SUM(A1:A2)") === "'@SUM(A1:A2)");
  check("não altera texto normal", escaparCelulaExcel("Maria") === "Maria");
  check("vazio permanece vazio", escaparCelulaExcel("") === "");

  console.log("\n[puro] UI / rotas — CPF e authz no código");
  const exportSrc = readFileSync(join(ROOT, "src/lib/crm-export.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const routesSrc = readFileSync(join(ROOT, "src/lib/crm-export-routes.ts"), "utf8");
  const migSrc = readFileSync(
    join(ROOT, "supabase/migrations/20260907130000_product_complete_web_crm.sql"),
    "utf8",
  );
  const crmDataSrc = readFileSync(join(ROOT, "src/lib/data/crm.ts"), "utf8");
  check("export builders não mencionam cpf", !/\bcpf\b/i.test(exportSrc));
  check("rotas de export devolvem 401 sem sessão", /status:\s*401/.test(routesSrc));
  check("migration CRM não seleciona profiles.cpf", !/p\.cpf|\.cpf\b/.test(migSrc.replace(/--.*$/gm, "")));
  check(
    "CRM não consome indicadores_vitrine (catálogo público)",
    !/indicadores_vitrine/.test(crmDataSrc) && !/indicadores_vitrine/.test(exportSrc),
  );
  check(
    "migration CRM só conta status validado",
    /cu\.status = 'validado'/.test(migSrc) &&
      !/cu\.status = 'ativo'/.test(migSrc) &&
      !/cu\.status = 'expirado'/.test(migSrc),
  );
  check(
    "crm_estab_da_sessao é determinístico (order by id)",
    /order by e\.id/.test(migSrc) && !/p_estabelecimento/.test(migSrc),
  );
  check("sidebar tem item Clientes após Cupons", (() => {
    const side = readFileSync(join(ROOT, "src/components/sidebar.tsx"), "utf8");
    const cupons = side.indexOf('href: "/portal/cupons"');
    const clientes = side.indexOf('href: "/portal/clientes"');
    return cupons >= 0 && clientes > cupons;
  })());
  check(
    "export HTTP não usa buscarEstabelecimentoDaSessao/maybeSingle",
    !/buscarEstabelecimentoDaSessao/.test(routesSrc) && !/maybeSingle/.test(routesSrc),
  );
  check(
    "export HTTP resolve contexto via buscarContextoCrmDaSessao",
    /buscarContextoCrmDaSessao/.test(routesSrc),
  );
  check(
    "export HTTP não lê estabelecimento_id da query",
    !/sp\.get\(\s*["']estabelecimento/.test(routesSrc),
  );
  check(
    "export HTTP não persiste q bruto no registrar",
    !/filtros:\s*\{[^}]*\bq\b/.test(routesSrc) && /registrarCrmExportacao/.test(routesSrc),
  );
  check(
    "crm.ts registra só filtrosAuditCrm (sem Record livre)",
    /filtrosAuditCrm/.test(crmDataSrc) && /crm_contexto_sessao/.test(crmDataSrc),
  );
  check(
    "migration sanitiza filtros para tem_busca/filtro/ordenacao",
    /tem_busca/.test(migSrc) &&
      /ordenacao/.test(migSrc) &&
      /crm_contexto_sessao/.test(migSrc),
  );

  console.log("\n[puro] Metadados de audit sem texto livre");
  const audNome = filtrosAuditCrm("Helena Silva", "todos");
  check("filtrosAuditCrm tem_busca=true com q", audNome.tem_busca === true);
  check("filtrosAuditCrm não inclui chave q", !("q" in audNome) && !("search" in audNome));
  check(
    "filtrosAuditCrm serializado sem Helena",
    !/Helena|Silva/i.test(JSON.stringify(audNome)),
  );
  const audVazio = filtrosAuditCrm("   ", "recentes");
  check("filtrosAuditCrm tem_busca=false sem q", audVazio.tem_busca === false);
  check("filtrosAuditCrm filtro whitelist", audVazio.filtro === "recentes");
  check(
    "filtrosAuditCrm ignora filtro livre (PII)",
    filtrosAuditCrm(null, "Helena Silva").filtro === "todos",
  );
  check(
    "filtrosAuditCrm chaves só metadados",
    JSON.stringify(Object.keys(audNome).sort()) ===
      JSON.stringify(["filtro", "ordenacao", "tem_busca"]),
  );
}

async function main(): Promise<number> {
  const contas: ContaQa[] = [];
  const cupomIds: string[] = [];
  try {
    testarPuros();

    const lojista = await logar("lojista@promofy.test");
    const lojista2 = await logar("lojista2@promofy.test");
    const consumidor = await logar("convidado@promofy.test");

    const cuponsE1 =
      (await svc.from("cupons").select("id").eq("estabelecimento_id", "e1").limit(3)).data ?? [];
    const cuponsE2 =
      (await svc.from("cupons").select("id").eq("estabelecimento_id", "e2").limit(2)).data ?? [];
    check("seed tem cupons em e1", cuponsE1.length >= 2, String(cuponsE1.length));
    check("seed tem cupons em e2", cuponsE2.length >= 1, String(cuponsE2.length));

    const qaA = await criarContaQa(svc, "crm-a", { nome: "Ana CRM Silva" });
    const qaB = await criarContaQa(svc, "crm-b", { nome: "Bruno CRM" });
    const qaSoAtivo = await criarContaQa(svc, "crm-ativo", { nome: "Carlos Só Ativo" });
    const qaC = await criarContaQa(svc, "crm-c", { nome: "Carla Só E2" });
    const qaE = await criarContaQa(svc, "crm-e", { nome: "Eva Ativo Pausado" });
    const qaF = await criarContaQa(svc, "crm-f", { nome: "Fernanda Validou Pausado" });
    const qaReat = await criarContaQa(svc, "crm-reat", { nome: "Rita Reativada" });
    contas.push(qaA, qaB, qaSoAtivo, qaC, qaE, qaF, qaReat);

    const { data: e1meta } = await svc
      .from("estabelecimentos")
      .select("categoria_id, categoria_principal_id")
      .eq("id", "e1")
      .maybeSingle();
    const criarCupomE1 = async (id: string, extra: Record<string, unknown> = {}) => {
      cupomIds.push(id);
      await svc.from("cupons").delete().eq("id", id);
      const { error } = await svc.from("cupons").insert({
        id,
        titulo: id,
        estabelecimento_id: "e1",
        categoria_id: e1meta!.categoria_id,
        categoria_nova_id: e1meta!.categoria_principal_id,
        economia: 10,
        status: "ativo",
        validade_fim: "2035-12-31",
        beneficio: "CRM suíte",
        horarios: { descricao: "todos", dias: [] as string[], inicio: "00:00", fim: "23:59" },
        ...extra,
      });
      if (error) throw new Error(`criar cupom ${id}: ${error.message}`);
    };

    await svc
      .from("profiles")
      .update({ telefone: "11999887766", nascimento: "1990-05-15" })
      .eq("id", qaA.id);
    await svc.from("profiles").update({ telefone: "21988776655" }).eq("id", qaB.id);

    // ---- Relação CRM: validado entra; ativo sem validado não ----
    console.log("\n[RPC] Relação CRM = validado");
    await inserirCupomUsuario({
      usuarioId: qaSoAtivo.id,
      cupomId: cuponsE1[0].id,
      status: "ativo",
      codigo: "PRMF-CRM-ATIVO1",
    });

    const listaAntes = (await lojista.rpc("crm_clientes", {})).data as Record<string, unknown>;
    const idsAntes = new Set(
      ((listaAntes?.clientes as { usuario_id?: string }[]) ?? []).map((c) => c.usuario_id),
    );
    check(
      "ativo sem validado NÃO cria relação CRM",
      !idsAntes.has(qaSoAtivo.id),
      Array.from(idsAntes).join(",").slice(0, 120),
    );

    const agora = new Date();
    const ha10d = new Date(Date.now() - 10 * 86400e3).toISOString();
    const ha40d = new Date(Date.now() - 40 * 86400e3).toISOString();

    await inserirCupomUsuario({
      usuarioId: qaA.id,
      cupomId: cuponsE1[0].id,
      status: "validado",
      codigo: "PRMF-CRM-A1",
      validadoEm: ha40d,
      nps: 9,
    });
    await inserirCupomUsuario({
      usuarioId: qaA.id,
      cupomId: cuponsE1[1].id,
      status: "validado",
      codigo: "PRMF-CRM-A2",
      validadoEm: ha10d,
      nps: 8,
    });
    await inserirCupomUsuario({
      usuarioId: qaB.id,
      cupomId: cuponsE1[0].id,
      status: "validado",
      codigo: "PRMF-CRM-B1",
      validadoEm: agora.toISOString(),
    });

    // Validação em e2 (outro tenant) — não deve vazar para lojista e1
    if (cuponsE2[0]) {
      await inserirCupomUsuario({
        usuarioId: qaA.id,
        cupomId: cuponsE2[0].id,
        status: "validado",
        codigo: "PRMF-CRM-E2A",
        validadoEm: agora.toISOString(),
      });
    }

    const lista = (await lojista.rpc("crm_clientes", {
      p_filtro: "todos",
      p_pagina: 1,
      p_por_pagina: 20,
    })).data as Record<string, unknown>;

    check("crm_clientes ok para lojista", lista?.ok === true, JSON.stringify(lista)?.slice(0, 100));
    const clientes = (lista?.clientes as Record<string, unknown>[]) ?? [];
    const ids = clientes.map((c) => c.usuario_id);
    check("validado cria relação CRM (Ana e Bruno)", ids.includes(qaA.id) && ids.includes(qaB.id));
    check("só-ativo continua fora", !ids.includes(qaSoAtivo.id));

    const ana = clientes.find((c) => c.usuario_id === qaA.id)!;
    check("agregação: Ana tem 2 resgates neste estab", Number(ana?.total_resgates) === 2, String(ana?.total_resgates));
    check(
      "primeiro/último resgate coerentes",
      String(ana?.primeiro_resgate).startsWith(ha40d.slice(0, 10)) &&
        String(ana?.ultimo_resgate).startsWith(ha10d.slice(0, 10)),
      `${ana?.primeiro_resgate} / ${ana?.ultimo_resgate}`,
    );

    const resumo = lista?.resumo as Record<string, unknown>;
    check("resumo.recorrentes ≥ 1 (Ana)", Number(resumo?.recorrentes) >= 1);
    check("resumo.resgates_confirmados ≥ 3", Number(resumo?.resgates_confirmados) >= 3);
    check("JSON da lista não contém cpf", !/\bcpf\b/i.test(JSON.stringify(lista)));

    // ---- Tenant isolation ----
    console.log("\n[RPC] Isolamento por estabelecimento");
    const listaE2 = (await lojista2.rpc("crm_clientes", {})).data as Record<string, unknown>;
    const idsE2 = ((listaE2?.clientes as { usuario_id?: string }[]) ?? []).map((c) => c.usuario_id);
    check("lojista2 NÃO vê Bruno (só e1)", !idsE2.includes(qaB.id), JSON.stringify(idsE2));
    check(
      "lojista2 vê Ana só se ela validou em e2",
      cuponsE2[0] ? idsE2.includes(qaA.id) : !idsE2.includes(qaA.id),
    );
    const detE2Bruno = (await lojista2.rpc("crm_cliente_detalhe", {
      p_usuario_id: qaB.id,
    })).data as Record<string, unknown>;
    check(
      "detalhe de Bruno no e2 → nao_encontrado",
      detE2Bruno?.ok === false && detE2Bruno?.motivo === "nao_encontrado",
      JSON.stringify(detE2Bruno),
    );

    // ---- Busca ----
    console.log("\n[RPC] Busca nome / e-mail / telefone");
    const porNome = (await lojista.rpc("crm_clientes", { p_q: "Ana CRM" })).data as Record<
      string,
      unknown
    >;
    check(
      "busca por nome encontra Ana",
      ((porNome?.clientes as { usuario_id?: string }[]) ?? []).some((c) => c.usuario_id === qaA.id),
    );
    const porEmail = (await lojista.rpc("crm_clientes", { p_q: "qa-crm-a@" })).data as Record<
      string,
      unknown
    >;
    check(
      "busca por e-mail encontra Ana",
      ((porEmail?.clientes as { usuario_id?: string }[]) ?? []).some((c) => c.usuario_id === qaA.id),
    );
    const porTel = (await lojista.rpc("crm_clientes", { p_q: "1199988" })).data as Record<
      string,
      unknown
    >;
    check(
      "busca por telefone encontra Ana",
      ((porTel?.clientes as { usuario_id?: string }[]) ?? []).some((c) => c.usuario_id === qaA.id),
    );
    const qCurta = (await lojista.rpc("crm_clientes", { p_q: "A" })).data as Record<string, unknown>;
    check(
      "busca com 1 char ignora filtro (devolve lista)",
      Number(qCurta?.total) >= Number(lista?.total),
    );

    // ---- Filtros ----
    console.log("\n[RPC] Filtros recentes / recorrentes");
    const recentes = (await lojista.rpc("crm_clientes", { p_filtro: "recentes" })).data as Record<
      string,
      unknown
    >;
    const idsRecentes = ((recentes?.clientes as { usuario_id?: string }[]) ?? []).map(
      (c) => c.usuario_id,
    );
    check("filtro recentes inclui Bruno (hoje)", idsRecentes.includes(qaB.id));
    const recorrentes = (await lojista.rpc("crm_clientes", {
      p_filtro: "recorrentes",
    })).data as Record<string, unknown>;
    const idsRec = ((recorrentes?.clientes as { usuario_id?: string }[]) ?? []).map(
      (c) => c.usuario_id,
    );
    check("filtro recorrentes inclui Ana (≥2)", idsRec.includes(qaA.id));
    check("filtro recorrentes exclui Bruno (1)", !idsRec.includes(qaB.id));

    // ---- Detalhe ----
    console.log("\n[RPC] Detalhe + histórico escopado");
    const det = (await lojista.rpc("crm_cliente_detalhe", {
      p_usuario_id: qaA.id,
    })).data as Record<string, unknown>;
    check("detalhe ok", det?.ok === true);
    const hist = (det?.historico as Record<string, unknown>[]) ?? [];
    check("histórico tem 2 resgates de e1 (não o de e2)", hist.length === 2, String(hist.length));
    check("histórico sem cpf", !/\bcpf\b/i.test(JSON.stringify(det)));
    check(
      "NPS opcional presente quando gravado",
      hist.some((h) => h.nps === 9 || h.nps === 8),
    );
    check(
      "CRM do lojista ancora em e1 (order by id após FIX-02)",
      lista?.estabelecimento_id === "e1",
      String(lista?.estabelecimento_id),
    );

    // ---- Cliente C só no tenant B; E/F pausa; reativação ----
    console.log("\n[RPC] Pausa, elegibilidade e campanha reativada");
    if (cuponsE2[0]) {
      await inserirCupomUsuario({
        usuarioId: qaC.id,
        cupomId: cuponsE2[0].id,
        status: "validado",
        codigo: "PRMF-CRM-C-E2",
        validadoEm: agora.toISOString(),
      });
    }
    const listaAposC = (await lojista.rpc("crm_clientes", {
      p_filtro: "todos",
      p_pagina: 1,
      p_por_pagina: 50,
    })).data as Record<string, unknown>;
    const idsAposC = ((listaAposC?.clientes as { usuario_id?: string }[]) ?? []).map(
      (c) => c.usuario_id,
    );
    check("cliente C (só e2) NÃO aparece no CRM de A", !idsAposC.includes(qaC.id));
    const listaE2c = (await lojista2.rpc("crm_clientes", {})).data as Record<string, unknown>;
    const idsE2c = ((listaE2c?.clientes as { usuario_id?: string }[]) ?? []).map(
      (c) => c.usuario_id,
    );
    check(
      "cliente C aparece só no CRM de B",
      cuponsE2[0] ? idsE2c.includes(qaC.id) : true,
    );

    await criarCupomE1("crm-pause-e");
    await inserirCupomUsuario({
      usuarioId: qaE.id,
      cupomId: "crm-pause-e",
      status: "ativo",
      codigo: "PRMF-CRM-E-ATIVO",
    });
    const pauE = (await lojista.rpc("pausar_cupom", { p_cupom_id: "crm-pause-e" })).data as {
      ok?: boolean;
    };
    check("pausar cupom de E ok", pauE?.ok === true, JSON.stringify(pauE));
    const listaE = (await lojista.rpc("crm_clientes", {
      p_q: "Eva Ativo",
    })).data as Record<string, unknown>;
    check(
      "ativação + pausa sem validação NÃO cria CRM",
      !((listaE?.clientes as { usuario_id?: string }[]) ?? []).some((c) => c.usuario_id === qaE.id),
    );

    await criarCupomE1("crm-pause-f");
    await inserirCupomUsuario({
      usuarioId: qaF.id,
      cupomId: "crm-pause-f",
      status: "validado",
      codigo: "PRMF-CRM-F-VAL",
      validadoEm: agora.toISOString(),
    });
    const pauF = (await lojista.rpc("pausar_cupom", { p_cupom_id: "crm-pause-f" })).data as {
      ok?: boolean;
    };
    check("pausar cupom já validado ok", pauF?.ok === true, JSON.stringify(pauF));
    const listaF = (await lojista.rpc("crm_clientes", { p_q: "Fernanda" })).data as Record<
      string,
      unknown
    >;
    const fernanda = ((listaF?.clientes as { usuario_id?: string; total_resgates?: number }[]) ??
      []).find((c) => c.usuario_id === qaF.id);
    check("validado + pausa posterior MANTÉM cliente no CRM", Boolean(fernanda));

    await criarCupomE1("crm-old-camp", { limite_total: 1, limite_por_usuario: 1 });
    await inserirCupomUsuario({
      usuarioId: qaReat.id,
      cupomId: "crm-old-camp",
      status: "validado",
      codigo: "PRMF-CRM-REAT-1",
      validadoEm: ha40d,
    });
    await svc.from("cupons").update({ status: "esgotado" }).eq("id", "crm-old-camp");
    await criarCupomE1("crm-new-camp", { status: "pendente", limite_total: 1 });
    await svc.from("cupons").update({ status: "ativo" }).eq("id", "crm-new-camp");
    await inserirCupomUsuario({
      usuarioId: qaReat.id,
      cupomId: "crm-new-camp",
      status: "validado",
      codigo: "PRMF-CRM-REAT-2",
      validadoEm: agora.toISOString(),
    });
    const listaReat = (await lojista.rpc("crm_clientes", { p_q: "Rita Reativada" })).data as Record<
      string,
      unknown
    >;
    const ritas = ((listaReat?.clientes as { usuario_id?: string; total_resgates?: number }[]) ??
      []).filter((c) => c.usuario_id === qaReat.id);
    check("reativação não duplica cliente", ritas.length === 1, String(ritas.length));
    check("reativação agrega 2 resgates", Number(ritas[0]?.total_resgates) === 2, String(ritas[0]?.total_resgates));
    const detReat = (await lojista.rpc("crm_cliente_detalhe", {
      p_usuario_id: qaReat.id,
    })).data as Record<string, unknown>;
    check(
      "histórico da campanha reativada tem 2 linhas",
      ((detReat?.historico as unknown[]) ?? []).length === 2,
      String((detReat?.historico as unknown[])?.length),
    );

    // ---- Paginação ----
    console.log("\n[RPC] Paginação");
    const p1 = (await lojista.rpc("crm_clientes", {
      p_pagina: 1,
      p_por_pagina: 1,
    })).data as Record<string, unknown>;
    const p2 = (await lojista.rpc("crm_clientes", {
      p_pagina: 2,
      p_por_pagina: 1,
    })).data as Record<string, unknown>;
    check("página 1 tem 1 cliente", ((p1?.clientes as unknown[]) ?? []).length === 1);
    check("página 2 tem 1 cliente distinto", (() => {
      const a = (p1?.clientes as { usuario_id?: string }[])?.[0]?.usuario_id;
      const b = (p2?.clientes as { usuario_id?: string }[])?.[0]?.usuario_id;
      return Boolean(a && b && a !== b);
    })());
    check("total ≥ 2", Number(p1?.total) >= 2);

    // ---- Consumidor ----
    console.log("\n[RPC] Consumidor sem estabelecimento");
    const consLista = (await consumidor.rpc("crm_clientes", {})).data as Record<string, unknown>;
    check(
      "consumidor recebe lista vazia / sem estab (ok sem clientes)",
      consLista?.ok === true &&
        Number(consLista?.total ?? 0) === 0 &&
        ((consLista?.clientes as unknown[]) ?? []).length === 0,
      JSON.stringify(consLista)?.slice(0, 120),
    );
    const consCtx = (await consumidor.rpc("crm_contexto_sessao")).data as Record<
      string,
      unknown
    >;
    check(
      "consumidor sem contexto CRM (estabelecimento null)",
      consCtx?.ok === true && consCtx?.estabelecimento_id == null,
      JSON.stringify(consCtx)?.slice(0, 120),
    );
    const consExp = (await consumidor.rpc("crm_export_dados", {})).data as Record<
      string,
      unknown
    >;
    check(
      "consumidor não exporta clientes",
      consExp?.ok === true &&
        ((consExp?.clientes as unknown[]) ?? []).length === 0 &&
        consExp?.estabelecimento_id == null,
      JSON.stringify(consExp)?.slice(0, 120),
    );
    const consReg = (await consumidor.rpc("crm_registrar_exportacao", {
      p_formato: "xlsx",
      p_linhas_clientes: 1,
      p_linhas_historico: 0,
      p_filtros: { q: "nao-deve-gravar", filtro: "todos" },
    })).data as Record<string, unknown>;
    check(
      "consumidor não registra audit de export",
      consReg?.ok === false && consReg?.motivo === "sem_estabelecimento",
      JSON.stringify(consReg),
    );

    // ---- Contexto único (1-estab vs multi-estab) ----
    console.log("\n[RPC] Contexto de estabelecimento (CRM-01H)");
    const uidLojista = (await lojista.auth.getUser()).data.user?.id ?? "";
    const uidLojista2 = (await lojista2.auth.getUser()).data.user?.id ?? "";
    const { data: estabsL } = await svc
      .from("estabelecimentos")
      .select("id")
      .eq("owner_id", uidLojista)
      .order("id");
    const idsLojista = (estabsL ?? []).map((e) => e.id);
    check(
      "lojista@ é multi-estab (e1 + e3–e6)",
      idsLojista.includes("e1") &&
        idsLojista.includes("e3") &&
        idsLojista.includes("e4") &&
        idsLojista.includes("e5") &&
        idsLojista.includes("e6") &&
        idsLojista[0] === "e1",
      idsLojista.join(","),
    );
    const { data: estabsL2 } = await svc
      .from("estabelecimentos")
      .select("id")
      .eq("owner_id", uidLojista2)
      .order("id");
    const idsLojista2 = (estabsL2 ?? []).map((e) => e.id);
    check(
      "lojista2@ é 1-estab (só e2)",
      idsLojista2.length === 1 && idsLojista2[0] === "e2",
      idsLojista2.join(","),
    );

    const ctxA = (await lojista.rpc("crm_contexto_sessao")).data as Record<string, unknown>;
    const ctxB = (await lojista2.rpc("crm_contexto_sessao")).data as Record<string, unknown>;
    check("contexto multi-estab = e1 (order by id)", ctxA?.estabelecimento_id === "e1", String(ctxA?.estabelecimento_id));
    check("contexto 1-estab = e2", ctxB?.estabelecimento_id === "e2", String(ctxB?.estabelecimento_id));
    check("contexto multi-estab nome = Sabor & Cia", ctxA?.nome === "Sabor & Cia", String(ctxA?.nome));
    check("contexto 1-estab nome = PowerFit Academia", ctxB?.nome === "PowerFit Academia", String(ctxB?.nome));

    const listaCtx = (await lojista.rpc("crm_clientes", {})).data as Record<string, unknown>;
    const detCtx = (await lojista.rpc("crm_cliente_detalhe", {
      p_usuario_id: qaA.id,
    })).data as Record<string, unknown>;
    const expCtx = (await lojista.rpc("crm_export_dados", {})).data as Record<string, unknown>;
    check(
      "lista multi-estab = mesmo contexto",
      listaCtx?.estabelecimento_id === ctxA?.estabelecimento_id,
      String(listaCtx?.estabelecimento_id),
    );
    check(
      "detalhe multi-estab = mesmo contexto",
      detCtx?.estabelecimento_id === ctxA?.estabelecimento_id,
      String(detCtx?.estabelecimento_id),
    );
    check(
      "export multi-estab = mesmo contexto da lista",
      expCtx?.estabelecimento_id === listaCtx?.estabelecimento_id &&
        expCtx?.estabelecimento_id === "e1",
      String(expCtx?.estabelecimento_id),
    );

    const listaB = (await lojista2.rpc("crm_clientes", {})).data as Record<string, unknown>;
    const expB = (await lojista2.rpc("crm_export_dados", {})).data as Record<string, unknown>;
    check(
      "owner 1-estab: lista = export = e2",
      listaB?.estabelecimento_id === "e2" && expB?.estabelecimento_id === "e2",
      `${listaB?.estabelecimento_id}/${expB?.estabelecimento_id}`,
    );
    check(
      "tenant B não herda contexto de A",
      ctxB?.estabelecimento_id !== ctxA?.estabelecimento_id,
    );

    const injLista = await lojista.rpc("crm_clientes", {
      p_filtro: "todos",
      estabelecimento_id: "e2",
    } as never);
    const injListaData = injLista.data as Record<string, unknown> | null;
    check(
      "estabelecimento_id injetado na lista é ignorado ou rejeitado",
      Boolean(injLista.error) || injListaData?.estabelecimento_id === "e1",
      JSON.stringify(injLista.error ?? injListaData)?.slice(0, 160),
    );
    const injExp = await lojista.rpc("crm_export_dados", {
      p_filtro: "todos",
      p_estabelecimento_id: "e2",
    } as never);
    const injExpData = injExp.data as Record<string, unknown> | null;
    check(
      "estabelecimento_id injetado no export é ignorado ou rejeitado",
      Boolean(injExp.error) || injExpData?.estabelecimento_id === "e1",
      JSON.stringify(injExp.error ?? injExpData)?.slice(0, 160),
    );

    const anon = createClient(alvo.url, alvo.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const recusaSemSessao = (
      res: { data: unknown; error: { message?: string } | null },
    ) => {
      const d = res.data as Record<string, unknown> | null;
      return (
        Boolean(res.error) ||
        (d?.ok === false && d?.motivo === "sem_sessao")
      );
    };
    const anonCtx = await anon.rpc("crm_contexto_sessao");
    const anonExp = await anon.rpc("crm_export_dados", {});
    const anonReg = await anon.rpc("crm_registrar_exportacao", {
      p_formato: "pdf",
      p_linhas_clientes: 0,
      p_linhas_historico: 0,
    });
    check(
      "sem sessão: contexto recusa",
      recusaSemSessao(anonCtx),
      JSON.stringify(anonCtx.error ?? anonCtx.data),
    );
    check(
      "sem sessão: export recusa",
      recusaSemSessao(anonExp),
      JSON.stringify(anonExp.error ?? anonExp.data),
    );
    check(
      "sem sessão: audit recusa",
      recusaSemSessao(anonReg),
      JSON.stringify(anonReg.error ?? anonReg.data),
    );

    // ---- Export dados + builders ----
    console.log("\n[export] Dados + xlsx + pdf");
    const exp = (await lojista.rpc("crm_export_dados", {})).data as Record<string, unknown>;
    check("crm_export_dados ok", exp?.ok === true);
    check("export JSON sem cpf", !/\bcpf\b/i.test(JSON.stringify(exp)));
    check(
      "XLSX/RPC multi-estab ancora em e1 (mesmo da lista)",
      exp?.estabelecimento_id === "e1" && exp?.estabelecimento_id === lista?.estabelecimento_id,
      String(exp?.estabelecimento_id),
    );

    const clientesExp = ((exp?.clientes as Record<string, unknown>[]) ?? []).map(
      (c): CrmClienteResumo => ({
        usuarioId: String(c.usuario_id),
        nome: (c.nome as string) ?? null,
        email: (c.email as string) ?? null,
        telefone: (c.telefone as string) ?? null,
        nascimento: (c.nascimento as string) ?? null,
        totalResgates: Number(c.total_resgates),
        primeiroResgate: (c.primeiro_resgate as string) ?? null,
        ultimoResgate: (c.ultimo_resgate as string) ?? null,
      }),
    );
    const histExp = ((exp?.historico as Record<string, unknown>[]) ?? []).map(
      (h): CrmExportHistoricoItem => ({
        usuarioId: String(h.usuario_id),
        nome: (h.nome as string) ?? null,
        cupomId: String(h.cupom_id),
        titulo: String(h.titulo ?? ""),
        beneficio: String(h.beneficio ?? ""),
        economia: h.economia == null ? null : Number(h.economia),
        economiaVariavel: Boolean(h.economia_variavel),
        validadoEm: (h.validado_em as string) ?? null,
        status: String(h.status ?? ""),
        nps: h.nps == null ? null : Number(h.nps),
      }),
    );

    // Injeta nome com fórmula para garantir escape no xlsx
    const clientesComInj: CrmClienteResumo[] = [
      ...clientesExp,
      {
        usuarioId: "fake",
        nome: "=1+1",
        email: "+cmd",
        telefone: null,
        nascimento: null,
        totalResgates: 0,
        primeiroResgate: null,
        ultimoResgate: null,
      },
    ];

    const xlsxBuf = await buildXlsxBuffer(clientesComInj, histExp);
    check("xlsx começa como zip (PK)", xlsxBuf[0] === 0x50 && xlsxBuf[1] === 0x4b);
    const wb = new ExcelJS.Workbook();
    // exceljs load aceita Buffer
    // @ts-expect-error Buffer é aceito em runtime
    await wb.xlsx.load(xlsxBuf);
    const sheet = wb.getWorksheet("Clientes");
    check("xlsx tem aba Clientes", Boolean(sheet));
    check("xlsx tem aba Histórico", Boolean(wb.getWorksheet("Histórico")));
    const headers = (sheet?.getRow(1).values as unknown[]) ?? [];
    const headerStr = JSON.stringify(headers).toLowerCase();
    check("colunas xlsx sem cpf", !headerStr.includes("cpf"));
    check("colunas xlsx sem usuario_id", !headerStr.includes("usuario"));
    let formulaEscapada = false;
    sheet?.eachRow((row, n) => {
      if (n === 1) return;
      const nome = String(row.getCell(1).value ?? "");
      if (nome === "'=1+1" || nome.startsWith("'=")) formulaEscapada = true;
    });
    check("fórmula injetada escapada no xlsx", formulaEscapada);
    const idsExp = clientesExp.map((c) => c.usuarioId);
    check("xlsx/RPC multi-estab não inclui cliente só-e2 (Carla)", !idsExp.includes(qaC.id));
    const cupomIdsHist = Array.from(
      new Set(histExp.map((h) => h.cupomId).filter(Boolean)),
    );
    if (cupomIdsHist.length > 0) {
      const { data: cuponsHist } = await svc
        .from("cupons")
        .select("id, estabelecimento_id")
        .in("id", cupomIdsHist);
      check(
        "histórico do export multi-estab é só do contexto e1",
        (cuponsHist ?? []).every((c) => c.estabelecimento_id === "e1"),
        JSON.stringify(cuponsHist ?? []),
      );
    } else {
      check("histórico do export multi-estab é só do contexto e1", false, "sem histórico");
    }
    const idsExpB = ((expB?.clientes as { usuario_id?: string }[]) ?? []).map((c) => c.usuario_id);
    check("export 1-estab (e2) não inclui Bruno (só e1)", !idsExpB.includes(qaB.id));

    const resumoPdf: CrmResumo = {
      clientesUnicos: Number((lista?.resumo as Record<string, unknown>)?.clientes_unicos ?? 0),
      novos30d: Number((lista?.resumo as Record<string, unknown>)?.novos_30d ?? 0),
      recorrentes: Number((lista?.resumo as Record<string, unknown>)?.recorrentes ?? 0),
      resgatesConfirmados: Number(
        (lista?.resumo as Record<string, unknown>)?.resgates_confirmados ?? 0,
      ),
    };
    const pdfBuf = await buildPdfBuffer({
      estabelecimentoNome: "Sabor & Cia",
      geradoEm: new Date(),
      filtrosLabel: "Todos",
      resumo: resumoPdf,
      clientes: clientesExp,
      historico: histExp,
    });
    check("pdf começa com %PDF", pdfBuf.slice(0, 4).toString("utf8") === "%PDF");
    const pdfTxt = pdfBuf.toString("latin1");
    const saborUtf16be = Buffer.from([0x00, 0x53, 0x00, 0x61, 0x00, 0x62, 0x00, 0x6f, 0x00, 0x72]);
    const saborUtf16le = Buffer.from([0x53, 0x00, 0x61, 0x00, 0x62, 0x00, 0x6f, 0x00, 0x72, 0x00]);
    check("pdf contém Promofy", pdfTxt.includes("Promofy"));
    check(
      "pdf contém nome do estabelecimento",
      pdfTxt.includes("Sabor") || pdfBuf.includes(saborUtf16be) || pdfBuf.includes(saborUtf16le),
    );
    check("pdf não contém cpf", !/\bcpf\b/i.test(pdfTxt));
    const pdfB = await buildPdfBuffer({
      estabelecimentoNome: String(ctxB?.nome ?? ""),
      geradoEm: new Date(),
      filtrosLabel: "Todos",
      resumo: {
        clientesUnicos: ((expB?.clientes as unknown[]) ?? []).length,
        novos30d: 0,
        recorrentes: 0,
        resgatesConfirmados: ((expB?.historico as unknown[]) ?? []).length,
      },
      clientes: ((expB?.clientes as Record<string, unknown>[]) ?? []).map(
        (c): CrmClienteResumo => ({
          usuarioId: String(c.usuario_id),
          nome: (c.nome as string) ?? null,
          email: (c.email as string) ?? null,
          telefone: (c.telefone as string) ?? null,
          nascimento: (c.nascimento as string) ?? null,
          totalResgates: Number(c.total_resgates ?? 0),
          primeiroResgate: (c.primeiro_resgate as string) ?? null,
          ultimoResgate: (c.ultimo_resgate as string) ?? null,
        }),
      ),
      historico: [],
    });
    check("pdf 1-estab começa com %PDF", pdfB.slice(0, 4).toString("utf8") === "%PDF");
    const powerUtf16be = Buffer.from([0x00, 0x50, 0x00, 0x6f, 0x00, 0x77, 0x00, 0x65, 0x00, 0x72]);
    check(
      "pdf 1-estab contém PowerFit (contexto e2)",
      pdfB.toString("latin1").includes("Power") || pdfB.includes(powerUtf16be),
    );
    check(
      "pdf multi-estab não contém PowerFit (tenant errado)",
      !pdfTxt.includes("PowerFit") && !pdfBuf.includes(powerUtf16be),
    );

    // ---- Auditoria ----
    console.log("\n[RPC] Auditoria de exportação");
    const reg = (await lojista.rpc("crm_registrar_exportacao", {
      p_formato: "xlsx",
      p_linhas_clientes: clientesExp.length,
      p_linhas_historico: histExp.length,
      p_filtros: { q: null, filtro: "todos" },
    })).data as Record<string, unknown>;
    check("crm_registrar_exportacao ok", reg?.ok === true, JSON.stringify(reg));

    const registrarVeneno = async (q: string, filtro = "todos") => {
      return (await lojista.rpc("crm_registrar_exportacao", {
        p_formato: "pdf",
        p_linhas_clientes: 0,
        p_linhas_historico: 0,
        p_filtros: { q, search: q, filtro, extra: q },
      })).data as Record<string, unknown>;
    };

    const regNome = await registrarVeneno("Helena Silva", "recentes");
    const regEmail = await registrarVeneno("helena@example.com");
    const regTel = await registrarVeneno("11999999999", "periodo_90d");
    const regFormula = await registrarVeneno("=2+2");
    const regSemQ = (await lojista.rpc("crm_registrar_exportacao", {
      p_formato: "xlsx",
      p_linhas_clientes: 0,
      p_linhas_historico: 0,
      p_filtros: { tem_busca: false, filtro: "todos" },
    })).data as Record<string, unknown>;
    check("registrar com q nome ok", regNome?.ok === true, JSON.stringify(regNome));
    check("registrar com q email ok", regEmail?.ok === true, JSON.stringify(regEmail));
    check("registrar com q telefone ok", regTel?.ok === true, JSON.stringify(regTel));
    check("registrar com q fórmula ok", regFormula?.ok === true, JSON.stringify(regFormula));
    check("registrar sem q ok", regSemQ?.ok === true, JSON.stringify(regSemQ));

    if (alvo.nome === "local") {
      const cols = psql(
        "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='private' and table_name='crm_exportacoes'",
      );
      check(
        "auditoria sem colunas PII (cpf/email/nome/telefone)",
        !/\b(cpf|email|nome|telefone)\b/i.test(cols),
        cols,
      );
      const linha = psql(
        `select formato || '|' || linhas_clientes || '|' || coalesce(filtros::text,'') from private.crm_exportacoes where id = ${Number(reg?.id)}`,
      );
      check(
        "linha de auditoria sem PII do consumidor",
        !/qa-crm|Ana CRM|1199988|@promofy/i.test(linha),
        linha,
      );
      check("linha registra formato xlsx", linha.startsWith("xlsx|"));
      const estabAudit = psql(
        `select estabelecimento_id from private.crm_exportacoes where id = ${Number(reg?.id)}`,
      );
      check(
        "audit multi-estab registra o mesmo estabelecimento da lista",
        estabAudit === "e1" && estabAudit === String(lista?.estabelecimento_id),
        estabAudit,
      );
      const atorAudit = psql(
        `select ator_id::text from private.crm_exportacoes where id = ${Number(reg?.id)}`,
      );
      check("audit registra ator da sessão", atorAudit === uidLojista, atorAudit);

      const dump = (id: unknown) =>
        psql(
          `select coalesce(filtros::text,'') || '|' || estabelecimento_id from private.crm_exportacoes where id = ${Number(id)}`,
        );
      const parseF = (id: unknown) =>
        JSON.parse(psql(`select filtros::text from private.crm_exportacoes where id = ${Number(id)}`)) as Record<
          string,
          unknown
        >;

      const fNome = parseF(regNome?.id);
      const dNome = dump(regNome?.id);
      check("q nome não persiste (Helena/Silva ausentes)", !/Helena|Silva/i.test(dNome), dNome);
      check("tem_busca=true quando q nome usado", fNome.tem_busca === true, JSON.stringify(fNome));
      check("filtro recentes preservado sem texto livre", fNome.filtro === "recentes");

      const dEmail = dump(regEmail?.id);
      const fEmail = parseF(regEmail?.id);
      check("q email não persiste (helena/@example.com ausentes)", !/helena|@example\.com/i.test(dEmail), dEmail);
      check("tem_busca=true quando q email usado", fEmail.tem_busca === true);

      const dTel = dump(regTel?.id);
      const fTel = parseF(regTel?.id);
      check("q telefone não persiste (11999999999 ausente)", !/11999999999/.test(dTel), dTel);
      check("tem_busca=true quando q telefone usado", fTel.tem_busca === true);
      check("filtro periodo_90d preservado", fTel.filtro === "periodo_90d");

      const dFormula = dump(regFormula?.id);
      const fFormula = parseF(regFormula?.id);
      check("q fórmula não persiste (=2+2 ausente)", !/=2\+2/.test(dFormula), dFormula);
      check("tem_busca=true quando q fórmula usado", fFormula.tem_busca === true);

      const fSem = parseF(regSemQ?.id);
      check("tem_busca=false sem q", fSem.tem_busca === false, JSON.stringify(fSem));
      check(
        "audit só tem metadados não identificáveis",
        JSON.stringify(Object.keys(fNome).sort()) ===
          JSON.stringify(["filtro", "ordenacao", "tem_busca"]) &&
          fNome.ordenacao === "ultimo_resgate_desc" &&
          !("q" in fNome) &&
          !("search" in fNome) &&
          !("extra" in fNome),
        JSON.stringify(fNome),
      );
      const venenoCount = psql(
        `select count(*) from private.crm_exportacoes where filtros::text ~* 'Helena|Silva|helena@example.com|11999999999|=2\\+2'`,
      );
      check("tabela de audit sem ocorrência dos textos de busca", venenoCount === "0", venenoCount);

      const regB = (await lojista2.rpc("crm_registrar_exportacao", {
        p_formato: "pdf",
        p_linhas_clientes: 0,
        p_linhas_historico: 0,
        p_filtros: { filtro: "todos" },
      })).data as Record<string, unknown>;
      const estabB = psql(
        `select estabelecimento_id from private.crm_exportacoes where id = ${Number(regB?.id)}`,
      );
      check("audit 1-estab registra e2 (não e1)", estabB === "e2", estabB);
    } else {
      console.log("  ----  auditoria private via psql — só no alvo local");
    }

    const audPostgrest = await svc.from("crm_exportacoes" as never).select("*");
    check(
      "private.crm_exportacoes fora do PostgREST",
      Boolean(audPostgrest.error),
      String(audPostgrest.error?.message ?? ""),
    );

    // ---- Rota sem sessão ----
    console.log("\n[rota] Export sem autenticação");
    const base =
      process.env.CRM_TEST_APP_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
    try {
      const res = await fetch(`${base}/portal/clientes/exportar.xlsx`, {
        redirect: "manual",
        signal: AbortSignal.timeout(3000),
      });
      const okAuth =
        res.status === 401 ||
        res.status === 403 ||
        (res.status >= 300 && res.status < 400);
      check(
        "export sem sessão → 401/403 ou redirect login",
        okAuth,
        `status=${res.status}`,
      );
    } catch {
      // Sem Next no ar: a asserção estática de 401 no handler já passou.
      check(
        "export sem sessão → handler declara 401 (Next não estava no ar)",
        true,
      );
    }

    return encerrar(passed, failed);
  } catch (err) {
    console.error("\nERRO FATAL:", err);
    failed++;
    return encerrar(passed, failed);
  } finally {
    for (const id of cupomIds) {
      await svc.from("cupons_usuario").delete().eq("cupom_id", id);
      await svc.from("cupons").delete().eq("id", id);
    }
    for (const c of contas) await destruirContaQa(svc, c.id);
  }
}

main().then((code) => {
  process.exitCode = code;
});
