/**
 * PRE-CALL-FIX-02 — regressão: validação por CPF encontra a mesma ativação
 * que validar_cupom, e órfão (owner_id NULL) deixa de divergir.
 */
import { resolverAlvo } from "./_alvo";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { completarCpfComDv, formatarCpf } from "../src/lib/cpf";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

const alvo = resolverAlvo("test-pre-call-cpf");
const SENHA = "promofy123";

let passed = 0, failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: SENHA });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function snapshotValidacao(rowId: number) {
  const cu = await svc
    .from("cupons_usuario")
    .select("id, status, validado_em, nps, nps_recusado_em, usuario_id, cupom_id")
    .eq("id", rowId)
    .single();
  const ev = await svc
    .from("cupom_eventos")
    .select("id", { count: "exact", head: true })
    .eq("cupom_id", cu.data!.cupom_id)
    .eq("usuario_id", cu.data!.usuario_id)
    .eq("tipo", "validacao");
  const pts = await svc
    .from("pontos_transacoes")
    .select("pontos, acao")
    .eq("referencia_id", String(rowId))
    .eq("acao", "resgate");
  return {
    status: cu.data?.status,
    validado_em: cu.data?.validado_em != null,
    nps_null: cu.data?.nps == null,
    nps_recusado_null: cu.data?.nps_recusado_em == null,
    pontos_resgate: pts.data?.[0]?.pontos ?? null,
    eventos_validacao: ev.count ?? 0,
  };
}

async function main(): Promise<number> {
  const dono = await logar("lojista@promofy.test");
  const outro = await logar("lojista2@promofy.test");
  const contas: ContaQa[] = [];

  try {
    // Garante e3..e6 sob o lojista (migration + seed); reafirma para o teste.
    const { data: e1 } = await svc.from("estabelecimentos").select("owner_id").eq("id", "e1").single();
    if (!e1?.owner_id) throw new Error("e1 sem owner — seed incompleto");
    await svc
      .from("estabelecimentos")
      .update({ owner_id: e1.owner_id })
      .in("id", ["e3", "e4", "e5", "e6"]);

    console.log("\n[PC1] Órfão: código e CPF rejeitam juntos (não divergem)");
    const qaOrf = await criarContaQa(svc, "pc-orf", {
      cpf: completarCpfComDv("111444777"),
      nome: "QA Orfao",
    });
    contas.push(qaOrf);
    await svc.from("estabelecimentos").update({ owner_id: null }).eq("id", "e3");

    const { data: ativOrf, error: eOrf } = await svc
      .from("cupons_usuario")
      .insert({
        usuario_id: qaOrf.id,
        cupom_id: "c06",
        status: "ativo",
        codigo: "PRMF-PCOR-0001",
        ativado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 3600e3).toISOString(),
      })
      .select("id")
      .single();
    check("ativa em e3 órfão", !eOrf && !!ativOrf?.id, eOrf?.message);

    const buscaOrf = (await dono.rpc("buscar_ativacoes_por_cpf", {
      p_cpf: completarCpfComDv("111444777"),
    })).data as { ok?: boolean; motivo?: string };
    const codOrf = (await dono.rpc("validar_cupom", { p_codigo: "PRMF-PCOR-0001" })).data as {
      ok?: boolean;
      motivo?: string;
    };
    check("CPF em órfão → sem_ativacao_aqui", buscaOrf?.motivo === "sem_ativacao_aqui", JSON.stringify(buscaOrf));
    check(
      "código em órfão → outro_estabelecimento (não fail-open)",
      codOrf?.ok === false && codOrf?.motivo === "outro_estabelecimento",
      JSON.stringify(codOrf),
    );

    // Restaura dono de e3
    await svc.from("estabelecimentos").update({ owner_id: e1.owner_id }).eq("id", "e3");
    await svc.from("cupons_usuario").delete().eq("id", ativOrf!.id);

    console.log("\n[PC2] Bug real: ativar em e3 → buscar CPF → validar por ativação");
    const cpfQa = completarCpfComDv("529982247");
    const qa = await criarContaQa(svc, "pc-cpf", {
      cpf: formatarCpf(cpfQa),
      nome: "Maria QA PreCall",
    });
    contas.push(qa);

    const { data: ativ, error: eAt } = await svc
      .from("cupons_usuario")
      .insert({
        usuario_id: qa.id,
        cupom_id: "c06",
        status: "ativo",
        codigo: "PRMF-PCCF-0001",
        ativado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 3600e3).toISOString(),
      })
      .select("id, usuario_id, status, codigo")
      .single();
    check("ativação e3 viva", !eAt && ativ?.status === "ativo", eAt?.message);

    const busca = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfQa })).data as {
      ok?: boolean;
      motivo?: string;
      itens?: { row_id: number; cpf_mascarado?: string }[];
    };
    check("busca CPF encontra a ativação (formato no profile)", busca?.ok === true, JSON.stringify(busca)?.slice(0, 160));
    check("item traz row_id da ativação", busca?.itens?.[0]?.row_id === ativ!.id);
    check(
      "busca NÃO expõe o código",
      !JSON.stringify(busca).includes("PRMF-PCCF-0001"),
      "código vazou",
    );

    const confOutro = (await outro.rpc("validar_cupom_por_ativacao", {
      p_row_id: ativ!.id,
      p_cpf: cpfQa,
    })).data as { motivo?: string };
    check("outro tenant não valida row_id", confOutro?.motivo === "sem_ativacao_aqui", JSON.stringify(confOutro));

    const confCpfErr = (await dono.rpc("validar_cupom_por_ativacao", {
      p_row_id: ativ!.id,
      p_cpf: completarCpfComDv("222333444"),
    })).data as { motivo?: string };
    check("CPF errado + row_id certo → sem_ativacao_aqui", confCpfErr?.motivo === "sem_ativacao_aqui");

    const conf = (await dono.rpc("validar_cupom_por_ativacao", {
      p_row_id: ativ!.id,
      p_cpf: "529.982.247-25",
    })).data as { ok?: boolean };
    check("validar por CPF confirma", conf?.ok === true, JSON.stringify(conf)?.slice(0, 120));

    const snapCpf = await snapshotValidacao(ativ!.id);
    check("status validado após CPF", snapCpf.status === "validado");
    check("validado_em preenchido", snapCpf.validado_em === true);
    check("NPS ainda pendente (null)", snapCpf.nps_null === true);
    check("crédito de resgate lançado", typeof snapCpf.pontos_resgate === "number");

    const buscaPos = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfQa })).data as {
      motivo?: string;
    };
    check("já validada some da busca", buscaPos?.motivo === "sem_ativacao_aqui", JSON.stringify(buscaPos));

    console.log("\n[PC3] Paridade: validar por código vs por CPF");
    const cpfA = completarCpfComDv("390533447");
    const cpfB = completarCpfComDv("153509460");
    const qaA = await criarContaQa(svc, "pc-par-a", { cpf: cpfA, nome: "Par A" });
    const qaB = await criarContaQa(svc, "pc-par-b", { cpf: cpfB, nome: "Par B" });
    contas.push(qaA, qaB);

    const insA = await svc
      .from("cupons_usuario")
      .insert({
        usuario_id: qaA.id,
        cupom_id: "c05",
        status: "ativo",
        codigo: "PRMF-PARA-0001",
        ativado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 3600e3).toISOString(),
      })
      .select("id")
      .single();
    const insB = await svc
      .from("cupons_usuario")
      .insert({
        usuario_id: qaB.id,
        cupom_id: "c05",
        status: "ativo",
        codigo: "PRMF-PARB-0001",
        ativado_em: new Date().toISOString(),
        expira_em: new Date(Date.now() + 3600e3).toISOString(),
      })
      .select("id")
      .single();

    const rCod = (await dono.rpc("validar_cupom", { p_codigo: "PRMF-PARA-0001" })).data as { ok?: boolean };
    check("cenário A: validar por código", rCod?.ok === true, JSON.stringify(rCod));

    const bB = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfB })).data as {
      ok?: boolean;
      itens?: { row_id: number }[];
    };
    const rCpf = (await dono.rpc("validar_cupom_por_ativacao", {
      p_row_id: bB?.itens?.[0]?.row_id,
      p_cpf: cpfB,
    })).data as { ok?: boolean };
    check("cenário B: buscar+validar por CPF", rCpf?.ok === true, JSON.stringify({ bB, rCpf }).slice(0, 160));

    const snapA = await snapshotValidacao(insA.data!.id);
    const snapB = await snapshotValidacao(insB.data!.id);
    check(
      "paridade status/validado_em/nps/pontos/evento",
      snapA.status === snapB.status &&
        snapA.validado_em === snapB.validado_em &&
        snapA.nps_null === snapB.nps_null &&
        snapA.pontos_resgate === snapB.pontos_resgate &&
        snapA.eventos_validacao === snapB.eventos_validacao &&
        snapA.eventos_validacao >= 1,
      JSON.stringify({ snapA, snapB }),
    );

    console.log("\n[PC4] Negativos");
    const cpfOutro = completarCpfComDv("864875260");
    const qaOut = await criarContaQa(svc, "pc-out", { cpf: cpfOutro });
    contas.push(qaOut);
    await svc.from("cupons_usuario").insert({
      usuario_id: qaOut.id,
      cupom_id: "c03", // e2 PowerFit
      status: "ativo",
      codigo: "PRMF-PCOT-0001",
      ativado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 3600e3).toISOString(),
    });
    const cruzado = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfOutro })).data as {
      motivo?: string;
    };
    check("CPF de cliente do e2 não aparece no e1/e3", cruzado?.motivo === "sem_ativacao_aqui");

    const inexist = (await dono.rpc("buscar_ativacoes_por_cpf", {
      p_cpf: completarCpfComDv("000111222"),
    })).data as { motivo?: string };
    check("CPF sem ativação → sem_ativacao_aqui", inexist?.motivo === "sem_ativacao_aqui");

    const exp = await svc
      .from("cupons_usuario")
      .insert({
        usuario_id: qa.id,
        cupom_id: "c05",
        status: "ativo",
        codigo: "PRMF-PCEX-0001",
        ativado_em: new Date(Date.now() - 7200e3).toISOString(),
        expira_em: new Date(Date.now() - 60e3).toISOString(),
      })
      .select("id")
      .single();
    const buscaExp = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfQa })).data as {
      itens?: { row_id: number }[];
      motivo?: string;
      ok?: boolean;
    };
    const achouExp = (buscaExp?.itens ?? []).some((i) => i.row_id === exp.data?.id);
    check("ativação expirada não aparece", !achouExp, JSON.stringify(buscaExp));

    const dvRuim = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: "123.456.789-00" })).data as {
      motivo?: string;
    };
    check("CPF inválido rejeitado antes da busca", dvRuim?.motivo === "cpf_invalido");
  } finally {
    for (const c of contas) await destruirContaQa(svc, c.id);
    // e3..e6 de volta ao lojista
    const { data: e1 } = await svc.from("estabelecimentos").select("owner_id").eq("id", "e1").single();
    if (e1?.owner_id) {
      await svc.from("estabelecimentos").update({ owner_id: e1.owner_id }).in("id", ["e3", "e4", "e5", "e6"]);
    }
  }

  return encerrar(passed, failed);
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
