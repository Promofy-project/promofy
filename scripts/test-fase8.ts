/**
 * Suíte da Fase 8 — lado do estabelecimento.
 *
 * Asserções por PostgREST DIRETO, com sessão real de cada papel. O motivo é o
 * mesmo da migration 20: uma regra que só existe na Server Action é
 * contornável por quem fala HTTP, e o lojista fala.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-fase8");

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { cpfValido, completarCpfComDv } from "../src/lib/cpf";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";

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

async function main(): Promise<number> {
  const admin = await logar("admin@promofy.test");
  const dono = await logar("lojista@promofy.test");   // e1
  const outro = await logar("lojista2@promofy.test"); // e2

  const criados: string[] = [];
  let qa: ContaQa | null = null;

  try {
    // ============================================================
    console.log("\n[M1] Mural — publicação e alcance");
    // ============================================================
    const pubTodos = await admin
      .from("avisos")
      .insert({ titulo: "Aviso geral f8", corpo: "Vale para todos.", para_todos: true })
      .select("id")
      .single();
    check("admin publica aviso para TODOS", !pubTodos.error, pubTodos.error?.message);
    const idTodos = pubTodos.data?.id as string | undefined;
    if (idTodos) criados.push(idTodos);

    const pubE1 = await admin
      .from("avisos")
      .insert({ titulo: "Aviso só do e1 f8", corpo: "Direcionado.", para_todos: false })
      .select("id")
      .single();
    const idE1 = pubE1.data?.id as string | undefined;
    if (idE1) criados.push(idE1);
    if (idE1) {
      const d = await admin
        .from("avisos_destinatarios")
        .insert({ aviso_id: idE1, estabelecimento_id: "e1" });
      check("admin direciona o aviso ao e1", !d.error, d.error?.message);
    }

    const lojistaPublica = await dono
      .from("avisos")
      .insert({ titulo: "forjado", corpo: "x", para_todos: true })
      .select("id");
    check(
      "lojista NÃO publica aviso",
      Boolean(lojistaPublica.error) || (lojistaPublica.data ?? []).length === 0,
      "conseguiu publicar!",
    );

    const vistosDono = (await dono.from("avisos").select("id, titulo")).data ?? [];
    const vistosOutro = (await outro.from("avisos").select("id, titulo")).data ?? [];
    check("lojista do e1 vê o aviso GERAL", vistosDono.some((a) => a.id === idTodos));
    check("lojista do e1 vê o aviso DIRECIONADO a ele", vistosDono.some((a) => a.id === idE1));
    check("lojista2 vê o aviso geral", vistosOutro.some((a) => a.id === idTodos));
    check(
      "lojista2 NÃO vê o aviso direcionado só ao e1",
      !vistosOutro.some((a) => a.id === idE1),
      "vazou aviso de outro estabelecimento",
    );

    // A junção não pode virar um diretório de quem recebe o quê.
    const juncaoOutro = (await outro.from("avisos_destinatarios").select("*")).data ?? [];
    check(
      "lojista2 não enxerga a junção de destinatários do e1",
      !juncaoOutro.some((d: any) => d.estabelecimento_id === "e1"),
      `${juncaoOutro.length} linhas`,
    );

    // ============================================================
    console.log("\n[M1] Marcação de lido — só por RPC, só o próprio");
    // ============================================================
    const naoLidosAntes = (await dono.rpc("avisos_nao_lidos")).data as number;
    check("contagem de não-lidos vem > 0 antes de ler", (naoLidosAntes ?? 0) >= 2, String(naoLidosAntes));

    const escritaDireta = await dono
      .from("avisos_lidos")
      .insert({ aviso_id: idTodos, estabelecimento_id: "e1", lido_em: "2020-01-01T00:00:00Z" })
      .select("aviso_id");
    check(
      "lojista NÃO escreve direto em avisos_lidos (não forja lido_em)",
      Boolean(escritaDireta.error),
      escritaDireta.error?.message ?? "escreveu!",
    );

    const marcou = (await dono.rpc("marcar_aviso_lido", { p_aviso_id: idTodos })).data as any;
    check("RPC marca como lido", marcou?.ok === true, JSON.stringify(marcou));
    const remarcou = (await dono.rpc("marcar_aviso_lido", { p_aviso_id: idTodos })).data as any;
    check("marcar de novo é idempotente", remarcou?.ok === true, JSON.stringify(remarcou));

    const naoLidosDepois = (await dono.rpc("avisos_nao_lidos")).data as number;
    check(
      "contagem cai depois de ler",
      naoLidosDepois === naoLidosAntes - 1,
      `${naoLidosAntes} → ${naoLidosDepois}`,
    );

    const marcouAlheio = (await outro.rpc("marcar_aviso_lido", { p_aviso_id: idE1 })).data as any;
    check(
      "lojista2 NÃO marca como lido aviso que não é dele",
      marcouAlheio?.ok === false && marcouAlheio?.motivo === "nao_encontrado",
      JSON.stringify(marcouAlheio),
    );

    const lidosDoOutro = (await outro.from("avisos_lidos").select("*")).data ?? [];
    check(
      "lojista2 não lê as marcações do e1",
      !lidosDoOutro.some((l: any) => l.estabelecimento_id === "e1"),
      `${lidosDoOutro.length} linhas`,
    );

    const contagemAdmin = (await admin.from("avisos_lidos").select("*")).data ?? [];
    check("admin enxerga as leituras (para contar quem leu)", contagemAdmin.length >= 1, String(contagemAdmin.length));
    // ============================================================
    console.log("\n[M2] Indicadores — NPS do próprio estabelecimento");
    // ============================================================
    const indDono = (await dono.rpc("indicadores_estabelecimento")).data as any;
    const indOutro = (await outro.rpc("indicadores_estabelecimento")).data as any;
    check("RPC responde ok para o lojista", indDono?.ok === true, JSON.stringify(indDono)?.slice(0, 120));

    // `tem_dados` existe para a UI não ter de decidir se 0 respostas são
    // "score zero" ou "ainda sem avaliações".
    check(
      "zero respostas → tem_dados=false e score NULL (não score 0)",
      indDono.respostas === 0 ? indDono.tem_dados === false && indDono.score === null : true,
      `respostas=${indDono?.respostas} score=${indDono?.score}`,
    );

    // Fixture própria: o seed não cria `cupons_usuario` (essas linhas nascem
    // do uso). Conta qa-* efêmera para que a suíte seja segura também com
    // --hosted, onde tocar linha de conta do cliente é proibido.
    qa = await criarContaQa(svc, "f8", { nome: "Fulano Sobrenome Teste" });
    const cupomE1 = (await svc.from("cupons").select("id").eq("estabelecimento_id", "e1").limit(1)).data?.[0];
    const notas = [10, 9, 7, 3];
    const fixtures: number[] = [];
    if (cupomE1 && qa) {
      for (let i = 0; i < notas.length; i++) {
        const ins = await svc
          .from("cupons_usuario")
          .insert({
            usuario_id: qa.id,
            cupom_id: cupomE1.id,
            status: "validado",
            codigo: `PRMF-F8T${i}-NPS${i}`,
            nps: notas[i],
            ativado_em: new Date(Date.now() - 3600e3).toISOString(),
            validado_em: new Date(Date.now() - 1800e3 + i * 1000).toISOString(),
          })
          .select("id")
          .single();
        if (ins.data) fixtures.push(ins.data.id);
      }
    }
    if (fixtures.length === notas.length) {
      const ind2 = (await dono.rpc("indicadores_estabelecimento")).data as any;
      check("distribuição correta (2 prom · 1 neutro · 1 detrator)",
        ind2.promotores === 2 && ind2.neutros === 1 && ind2.detratores === 1,
        `${ind2.promotores}/${ind2.neutros}/${ind2.detratores}`);
      check("score = %promotores − %detratores = 25", Number(ind2.score) === 25, String(ind2.score));
      check("tem_dados vira true", ind2.tem_dados === true);
      check("últimas notas trazem só o PRIMEIRO nome (sem sobrenome)",
        (ind2.ultimas ?? []).every((u: any) => typeof u.nome === "string" && !u.nome.includes(" ")),
        JSON.stringify(ind2.ultimas)?.slice(0, 140));
      check("últimas notas NÃO carregam id/cpf/email do consumidor",
        !/usuario_id|cpf|email/i.test(JSON.stringify(ind2.ultimas ?? [])));

      // TESTE NEGATIVO DE POSSE: o lojista2 não pode ver nada disso.
      const ind3 = (await outro.rpc("indicadores_estabelecimento")).data as any;
      check(
        "lojista2 NÃO vê o NPS do e1 (números diferentes, isolados por posse)",
        ind3.promotores !== 2 || ind3.detratores !== 1 || ind3.respostas !== 4,
        `e2 devolveu ${ind3.promotores}/${ind3.neutros}/${ind3.detratores} em ${ind3.respostas}`,
      );

    } else {
      check("fixture de NPS criada (4 linhas)", false, `criou ${fixtures.length}`);
    }

    check("lojista2 também recebe ok (mas com os SEUS números)", indOutro?.ok === true);

    // ============================================================
    console.log("\n[V2] CPF — dígito verificador (a barreira antes do banco)");
    // ============================================================
    // As duas implementações do DV (módulo puro e função do banco) precisam
    // concordar caso a caso — senão o lojista vê "CPF inválido" na tela e o
    // banco aceita, ou o contrário.
    const casosDv = ["52998224725", "11111111111", "12345678900", "5299822472", "00000000000"];
    let divergiu = 0;
    for (const c of casosDv) {
      const noTs = cpfValido(c);
      const noPg = (await svc.rpc("cpf_dv_valido", { p_cpf: c })).data as boolean;
      if (noTs !== noPg) divergiu++;
    }
    check("DV do módulo puro e do banco concordam em todos os casos", divergiu === 0, `${divergiu} divergência(s)`);
    check("CPF válido conhecido passa", cpfValido("529.982.247-25"));
    check("sequência repetida é recusada", !cpfValido("111.111.111-11"));

    const dvRuim = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: "123.456.789-00" })).data as any;
    check("CPF sem DV é barrado ANTES da consulta ('cpf_invalido')",
      dvRuim?.motivo === "cpf_invalido", JSON.stringify(dvRuim));
    const antesRuim = (await svc.from("validacao_tentativas").select("id", { count: "exact", head: true })).count ?? 0;
    await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: "000.000.000-00" });
    const depoisRuim = (await svc.from("validacao_tentativas").select("id", { count: "exact", head: true })).count ?? 0;
    check("CPF inválido NÃO entra na auditoria (não polui a janela de rate limit)",
      depoisRuim === antesRuim, `${antesRuim} → ${depoisRuim}`);

    // ============================================================
    console.log("\n[V2] CPF — ZERO ORÁCULO: os três 'não achei' são idênticos");
    // ============================================================
    // (a) CPF que não existe na base   (b) CPF de cliente de OUTRO
    // estabelecimento   (c) CPF que existe mas sem ativação ativa aqui.
    // Se qualquer um deles for distinguível, a RPC vira um oráculo que diz
    // quem é cliente de quem.
    const cpfInexistente = completarCpfComDv("999888777");
    const rA = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfInexistente })).data as any;

    // (b): a conta qa tem CPF e linhas em cupom do e1 — consultada pelo e2.
    const cpfDoQa = (await svc.from("profiles").select("cpf").eq("id", qa!.id).single()).data?.cpf ?? "";
    const rB = (await outro.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfDoQa })).data as any;

    // (c): mesmo CPF, no estabelecimento certo, mas as linhas são 'validado'
    // (não 'ativo') — existe cliente, não existe ativação viva.
    const rC = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfDoQa })).data as any;

    const sA = JSON.stringify(rA), sB = JSON.stringify(rB), sC = JSON.stringify(rC);
    check("(a) CPF inexistente → sem_ativacao_aqui", rA?.motivo === "sem_ativacao_aqui", sA);
    check("(b) CPF de cliente de OUTRO estabelecimento → resposta idêntica", sB === sA, `${sB} vs ${sA}`);
    check("(c) CPF sem ativação ativa aqui → resposta idêntica", sC === sA, `${sC} vs ${sA}`);
    check("os três 'não achei' são byte a byte idênticos", sA === sB && sB === sC);

    // ============================================================
    console.log("\n[V2] CPF — auditoria sem PII");
    // ============================================================
    const digitosQa = cpfDoQa.replace(/\D/g, "");
    // Migration 27: a tabela saiu de `public` — nem o service_role a alcança
    // por PostgREST, porque o schema `private` não está exposto na API.
    const audServiceRole = await svc.from("validacao_tentativas" as never).select("*");
    check(
      "auditoria FORA do alcance do PostgREST, mesmo com service_role",
      Boolean(audServiceRole.error),
      `${(audServiceRole.data as unknown[] | null)?.length ?? 0} linhas legíveis`,
    );
    const lerAud = await dono.from("validacao_tentativas" as never).select("*");
    check("lojista NÃO lê a tabela de auditoria", Boolean(lerAud.error));
    const lerPepper = await dono.rpc("hmac_cpf" as never, { p_cpf: "1" } as never);
    check("private.hmac_cpf não é exposta ao lojista", Boolean(lerPepper.error));
    const lerSegredos = await svc.from("segredos" as never).select("*");
    check("private.segredos não existe mais (pepper foi para o Vault)", Boolean(lerSegredos.error));

    // ============================================================
    console.log("\n[V1] CPF — caminho feliz e confirmação");
    // ============================================================
    const cupomAtivoE1 = (await svc.from("cupons").select("id").eq("estabelecimento_id", "e1").limit(1)).data?.[0];
    const ativacao = await svc.from("cupons_usuario").insert({
      usuario_id: qa!.id,
      cupom_id: cupomAtivoE1!.id,
      status: "ativo",
      codigo: "PRMF-F8CP-FBUS",
      ativado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + 3600e3).toISOString(),
    }).select("id").single();

    const busca = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfDoQa })).data as any;
    check("com ativação viva, a busca encontra", busca?.ok === true, JSON.stringify(busca)?.slice(0, 100));
    const item = busca?.itens?.[0];
    check("retorno traz row_id", typeof item?.row_id === "number");
    check("retorno NÃO traz o código da ativação (credencial ao portador)",
      !JSON.stringify(busca).includes("PRMF-F8CP-FBUS"), "o código vazou na resposta");
    check("CPF volta MASCARADO", /^\d{3}\.\*{3}\.\*{3}-\d{2}$/.test(item?.cpf_mascarado ?? ""), item?.cpf_mascarado);
    check("nome é só o primeiro", typeof item?.nome === "string" && !item.nome.includes(" "), item?.nome);

    const semCpf = (await dono.rpc("validar_cupom_por_ativacao", { p_row_id: item?.row_id, p_cpf: "123.456.789-00" })).data as any;
    check("confirmar com CPF que NÃO é o da ativação é recusado (row_id não basta)",
      semCpf?.ok === false && semCpf?.motivo === "cpf_invalido", JSON.stringify(semCpf));
    const cpfOutroValido = completarCpfComDv("111222333");
    const cpfErrado = (await dono.rpc("validar_cupom_por_ativacao", { p_row_id: item?.row_id, p_cpf: cpfOutroValido })).data as any;
    check("confirmar com CPF válido MAS de outra pessoa → resposta única",
      cpfErrado?.motivo === "sem_ativacao_aqui", JSON.stringify(cpfErrado));

    const confirmaAlheio = (await outro.rpc("validar_cupom_por_ativacao", { p_row_id: item?.row_id, p_cpf: cpfDoQa })).data as any;
    check("lojista2 NÃO confirma ativação do e1 (row_id é adivinhável)",
      confirmaAlheio?.ok === false && confirmaAlheio?.motivo === "sem_ativacao_aqui",
      JSON.stringify(confirmaAlheio));

    const confirma = (await dono.rpc("validar_cupom_por_ativacao", { p_row_id: item?.row_id, p_cpf: cpfDoQa })).data as any;
    check("o dono confirma e a validação acontece", confirma?.ok === true, JSON.stringify(confirma)?.slice(0, 120));
    check("o retorno da confirmação NÃO traz o código (a busca recusa; o confirm não pode desfazer)",
      !JSON.stringify(confirma).includes("PRMF-F8CP-FBUS"), "o código voltou no confirm");
    const reconfirma = (await dono.rpc("validar_cupom_por_ativacao", { p_row_id: item?.row_id, p_cpf: cpfDoQa })).data as any;
    check("reconfirmar não valida de novo", reconfirma?.ok === false, JSON.stringify(reconfirma));

    // ============================================================
    console.log("\n[V2] CPF — rate limit");
    // ============================================================
    let bloqueou = false;
    for (let i = 0; i < 25 && !bloqueou; i++) {
      const r = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfInexistente })).data as any;
      if (r?.motivo === "muitas_tentativas") bloqueou = true;
    }
    check("rate limit dispara dentro da janela", bloqueou, "não bloqueou em 25 tentativas");

    // Sessão nova do MESMO lojista não contorna: a contagem é por
    // estabelecimento no banco, não por sessão nem por processo.
    const donoOutraSessao = await logar("lojista@promofy.test");
    const rNovaSessao = (await donoOutraSessao.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfInexistente })).data as any;
    check("sessão NOVA do mesmo lojista continua bloqueada",
      rNovaSessao?.motivo === "muitas_tentativas", JSON.stringify(rNovaSessao));

    // E o bloqueio é do lojista que abusou, não do vizinho.
    const rVizinho = (await outro.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfInexistente })).data as any;
    check("o bloqueio NÃO respinga em outro estabelecimento",
      rVizinho?.motivo === "sem_ativacao_aqui", JSON.stringify(rVizinho));

    // Destrava ao esvaziar a janela (simulada envelhecendo as linhas).
    // A janela é temporal: destravar exige envelhecer as linhas. A auditoria
    // vive em `private` e NÃO é alcançável por PostgREST (é o ponto da
    // migration 27), então isto só se faz por psql — local. No alvo hospedado
    // a asserção não roda, e isso fica DITO em vez de virar um verde falso.
    if (alvo.nome === "local") {
      const { execSync } = await import("node:child_process");
      execSync(
        `docker exec supabase_db_promofy psql -U postgres -c "update private.validacao_tentativas set criado_em = now() - interval '5 minutes'"`,
        { stdio: "ignore" },
      );
      const rDestravou = (await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfInexistente })).data as any;
      check("destrava quando a janela esvazia", rDestravou?.motivo === "sem_ativacao_aqui", JSON.stringify(rDestravou));
    } else {
      console.log("  ----  destrava quando a janela esvazia — NÃO EXECUTADO fora do alvo local (exige psql)");
    }
  } finally {
    // a auditoria vive em `private` e nao e alcancavel por PostgREST; ela e
    // recriada a cada db:reset e nao guarda PII, entao nao ha o que limpar.
    if (criados.length) {
      await svc.from("avisos").delete().in("id", criados);
      console.log(`\n[limpeza] ${criados.length} aviso(s) removido(s)`);
    }
    // A conta qa-* leva junto as linhas de `cupons_usuario` (cascade a partir
    // de profiles). Sem isto, uma rodada `--hosted` deixaria conta órfã.
    if (qa) {
      await destruirContaQa(svc, qa.id);
      console.log("[limpeza] conta qa-f8 destruída");
    }
  }

  return encerrar(passed, failed);
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
