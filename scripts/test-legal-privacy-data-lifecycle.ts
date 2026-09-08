/**
 * Suíte LEGAL-PRIVACY-01 — aceites versionados, encerramento/anonimização
 * de conta do consumidor e higiene de PII/geolocalização.
 *
 * `consumidor@` e `convidado@` NUNCA são tocados — contas `qa-*` efêmeras,
 * criadas e destruídas pela própria suíte (`_qa-conta.ts`).
 *
 * O que roda aqui é o que dá para provar sem o Next no ar (RLS/RPC direto
 * no Postgres via supabase-js). Itens que dependem de rota HTTP/UI
 * (bloqueio de `/m` em encerramento, export via Route Handler, páginas
 * `/legal/*` no ar) foram verificados manualmente com o dev server e
 * Playwright — ver retorno do WP — e não duplicados aqui como asserção
 * automática.
 */
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolverAlvo } from "./_alvo";
import { criarContaQa, destruirContaQa, encerrar, emailQa, SENHA_QA } from "./_qa-conta";
import {
  DOCUMENTOS_REQUERIDOS_CONSUMIDOR,
  DOCUMENTOS_REQUERIDOS_PARCEIRO,
  DOC_PRIVACIDADE,
  DOC_TERMOS_CONSUMIDOR,
  DOC_TERMOS_PARCEIRO,
} from "../src/lib/documentos-legais";

const alvo = resolverAlvo("test-legal-privacy-data-lifecycle");

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

function fonteSemComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function logar(email: string, senha: string): Promise<SupabaseClient> {
  const c = createClient(alvo.url, alvo.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function pendenciasDe(c: SupabaseClient, uid: string, requeridos: { documento: string; versao: string }[]) {
  const { data } = await c
    .from("aceites_documento")
    .select("documento, versao")
    .eq("usuario_id", uid);
  const aceitos = new Set((data ?? []).map((a) => `${a.documento}@${a.versao}`));
  return requeridos.filter((d) => !aceitos.has(`${d.documento}@${d.versao}`));
}

async function main() {
  const contas: { id: string; email: string }[] = [];

  try {
    // ---- Setup: consumidor A, consumidor B, lojista QA (sem aceite nenhum:
    // criarContaQa não passa raw_user_meta_data.aceito_termos) ----
    const a = await criarContaQa(svc, "legal-cons-a");
    contas.push({ id: a.id, email: a.email });
    const b = await criarContaQa(svc, "legal-cons-b");
    contas.push({ id: b.id, email: b.email });

    const emailLojista = emailQa("legal-lojista");
    const { data: lojistaData, error: erroLojista } = await svc.auth.admin.createUser({
      email: emailLojista,
      password: SENHA_QA,
      email_confirm: true,
      app_metadata: { role: "lojista" },
      user_metadata: { nome: "QA Legal Lojista" },
    });
    if (erroLojista || !lojistaData.user) throw new Error(`lojista QA: ${erroLojista?.message}`);
    const lojistaId = lojistaData.user.id;
    contas.push({ id: lojistaId, email: emailLojista });

    const cA = await logar(a.email, a.senha);
    const cB = await logar(b.email, b.senha);
    const cLojista = await logar(emailLojista, SENHA_QA);

    // ---- 1/2. Aceite consumidor + versão registrada ----
    const pendA0 = await pendenciasDe(cA, a.id, DOCUMENTOS_REQUERIDOS_CONSUMIDOR);
    check(
      "consumidor recém-criado tem pendências (nenhum aceite ainda)",
      pendA0.length === DOCUMENTOS_REQUERIDOS_CONSUMIDOR.length,
      `pendentes=${pendA0.length}`,
    );

    const insTermos = await cA
      .from("aceites_documento")
      .insert({ usuario_id: a.id, documento: DOC_TERMOS_CONSUMIDOR.documento, versao: DOC_TERMOS_CONSUMIDOR.versao });
    check("consumidor registra aceite de termos_consumidor", !insTermos.error, insTermos.error?.message);

    const insPriv = await cA
      .from("aceites_documento")
      .insert({ usuario_id: a.id, documento: DOC_PRIVACIDADE.documento, versao: DOC_PRIVACIDADE.versao });
    check("consumidor registra aceite de privacidade", !insPriv.error, insPriv.error?.message);

    const { data: aceiteLido } = await svc
      .from("aceites_documento")
      .select("versao, aceito_em")
      .eq("usuario_id", a.id)
      .eq("documento", DOC_TERMOS_CONSUMIDOR.documento)
      .maybeSingle();
    check(
      "versão gravada é exatamente a vigente",
      aceiteLido?.versao === DOC_TERMOS_CONSUMIDOR.versao,
      aceiteLido?.versao,
    );
    check("timestamp de aceite existe", Boolean(aceiteLido?.aceito_em));

    const pendA1 = await pendenciasDe(cA, a.id, DOCUMENTOS_REQUERIDOS_CONSUMIDOR);
    check("após aceitar os 2 documentos, zero pendências", pendA1.length === 0, `pendentes=${pendA1.length}`);

    // ---- 3. Aceite parceiro ----
    const pendLojista0 = await pendenciasDe(cLojista, lojistaId, DOCUMENTOS_REQUERIDOS_PARCEIRO);
    check(
      "lojista QA (nunca aceitou) tem as 2 pendências do parceiro",
      pendLojista0.length === DOCUMENTOS_REQUERIDOS_PARCEIRO.length,
    );
    const insParceiro = await cLojista
      .from("aceites_documento")
      .insert([
        { usuario_id: lojistaId, documento: DOC_TERMOS_PARCEIRO.documento, versao: DOC_TERMOS_PARCEIRO.versao },
        { usuario_id: lojistaId, documento: DOC_PRIVACIDADE.documento, versao: DOC_PRIVACIDADE.versao },
      ]);
    check("lojista registra aceite Termos Parceiro + Privacidade", !insParceiro.error, insParceiro.error?.message);
    const pendLojista1 = await pendenciasDe(cLojista, lojistaId, DOCUMENTOS_REQUERIDOS_PARCEIRO);
    check("lojista sem pendências após aceitar", pendLojista1.length === 0);

    // ---- 4. Reaceite versão nova ----
    // Simula um usuário que aceitou uma versão ANTIGA (não a vigente).
    await svc.from("aceites_documento").insert({
      usuario_id: b.id,
      documento: DOC_TERMOS_CONSUMIDOR.documento,
      versao: "1.0",
    });
    const pendB = await pendenciasDe(cB, b.id, DOCUMENTOS_REQUERIDOS_CONSUMIDOR);
    check(
      "versão antiga aceita NÃO satisfaz o gate — reaceite pendente",
      pendB.some((d) => d.documento === DOC_TERMOS_CONSUMIDOR.documento),
    );

    // ---- 5. Sem sessão não falsifica aceite ----
    const anon = createClient(alvo.url, alvo.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const insAnon = await anon
      .from("aceites_documento")
      .insert({ usuario_id: a.id, documento: DOC_PRIVACIDADE.documento, versao: "9.9" });
    check("anon não consegue inserir aceite (RLS)", Boolean(insAnon.error), insAnon.error?.message);

    // ---- 6. Consumidor não aceita por outro usuário ----
    const insCruzado = await cA
      .from("aceites_documento")
      .insert({ usuario_id: b.id, documento: DOC_PRIVACIDADE.documento, versao: "9.9" });
    check(
      "consumidor A não consegue gravar aceite em nome de B (RLS)",
      Boolean(insCruzado.error),
      insCruzado.error?.message,
    );

    // ---- 7. Parceiro não aceita por outro usuário ----
    const insCruzadoParceiro = await cLojista
      .from("aceites_documento")
      .insert({ usuario_id: a.id, documento: DOC_TERMOS_PARCEIRO.documento, versao: "9.9" });
    check(
      "lojista não consegue gravar aceite em nome de outro usuário (RLS)",
      Boolean(insCruzadoParceiro.error),
    );

    // ---- 8. Pedido de encerramento é owner-only ----
    const encA = await cA.rpc("solicitar_encerramento_conta");
    check("A solicita o próprio encerramento", encA.data?.ok === true, JSON.stringify(encA.data ?? encA.error));

    const { data: perfilA } = await svc.from("profiles").select("status").eq("id", a.id).maybeSingle();
    check("status de A vira encerramento_solicitado", perfilA?.status === "encerramento_solicitado");

    // ---- 9. B não é afetado pelo pedido de A ----
    const { data: perfilB } = await svc.from("profiles").select("status").eq("id", b.id).maybeSingle();
    check("status de B continua ativo (owner-only, sem parâmetro de alvo)", perfilB?.status === "ativo");

    // ---- 10. Cancelamento antes da anonimização ----
    const cancelA = await cA.rpc("cancelar_encerramento_conta");
    check("A cancela o próprio encerramento", cancelA.data?.ok === true);
    const { data: perfilACancel } = await svc.from("profiles").select("status").eq("id", a.id).maybeSingle();
    check("status de A volta a ativo após cancelar", perfilACancel?.status === "ativo");

    // ---- 11. Anonimização remove PII, preserva histórico e audit ----
    // Semeia histórico (pontos + cupom_usuario) para provar que sobrevive.
    await svc.from("pontos_transacoes").insert({
      usuario_id: b.id,
      acao: "bonus",
      pontos: 10,
      referencia_id: `legal-wp:${b.id}`,
    });
    const encB = await cB.rpc("solicitar_encerramento_conta");
    check("B solicita o próprio encerramento", encB.data?.ok === true);

    const concluir = await svc.rpc("concluir_anonimizacao_conta", { p_usuario_id: b.id });
    check("concluir_anonimizacao_conta roda (service_role)", concluir.data?.ok === true, JSON.stringify(concluir.error));

    const { data: perfilBAnon } = await svc
      .from("profiles")
      .select("nome, cpf, telefone, nascimento, cidade, status")
      .eq("id", b.id)
      .maybeSingle();
    check("nome anonimizado", perfilBAnon?.nome === "Usuário anonimizado");
    check("cpf removido", perfilBAnon?.cpf === null);
    check("telefone removido", perfilBAnon?.telefone === null);
    check("nascimento removido", perfilBAnon?.nascimento === null);
    check("status final = anonimizado", perfilBAnon?.status === "anonimizado");

    const { data: pontosB } = await svc.from("pontos_transacoes").select("id").eq("usuario_id", b.id);
    check("histórico de pontos preservado (linha não apagada)", (pontosB?.length ?? 0) >= 1);

    const { data: aceitesB } = await svc.from("aceites_documento").select("id").eq("usuario_id", b.id);
    check("trilha de aceite preservada após anonimização", (aceitesB?.length ?? 0) >= 1);

    // ---- 12. anon/authenticated não conseguem chamar a conclusão diretamente ----
    const concluirComoA = await cA.rpc("concluir_anonimizacao_conta", { p_usuario_id: b.id });
    check(
      "authenticated não executa concluir_anonimizacao_conta (grant só service_role)",
      Boolean(concluirComoA.error),
      concluirComoA.error?.message,
    );

    // ---- 13. Cancelamento não é mais permitido após anonimizado ----
    const cancelBDepois = await svc.rpc("cancelar_encerramento_conta");
    // Executado sem sessão (svc não tem auth.uid()) — confirma que a RPC
    // exige sessão própria, não aceita alvo por parâmetro.
    check(
      "cancelar sem sessão de usuário não afeta ninguém (sem_sessao)",
      cancelBDepois.data?.motivo === "sem_sessao",
      JSON.stringify(cancelBDepois.data),
    );

    // ---- 14/15. Checagens estáticas: PII em log, geolocalização, export sem segredo ----
    const rota = fonteSemComentarios("src/app/m/perfil/privacidade/exportar/route.ts");
    check(
      "rota de export não referencia token/senha/service_role",
      !/token|senha|password|service_role|secret/i.test(rota),
    );

    const geoHook = fonteSemComentarios("src/components/localizacao-dispositivo.tsx");
    check(
      "hook de geolocalização não importa supabase/DB (memória só)",
      !/supabase|\.insert\(|\.update\(/.test(geoHook),
    );
    const buscarClient = fonteSemComentarios("src/app/m/buscar/buscar-client.tsx");
    check(
      "tela de busca não persiste lat/lng (sem chamada a ação/RPC com origem)",
      !/salvarLocaliza|persistirGeo|\.from\(["']profiles["']\).*lat/i.test(buscarClient),
    );

    check(
      "sem GA/GTM/Meta Pixel/Hotjar/Clarity no app hoje",
      !/googletagmanager|gtag\(|fbq\(|hotjar|clarity\.ms/i.test(
        fonteSemComentarios("src/app/layout.tsx"),
      ),
    );
  } finally {
    for (const c of contas) await destruirContaQa(svc, c.id);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main()
  .then(() => process.exitCode = encerrar(passed, failed))
  .catch((err) => {
    console.error("\nERRO FATAL:", err);
    process.exitCode = 1;
  });
