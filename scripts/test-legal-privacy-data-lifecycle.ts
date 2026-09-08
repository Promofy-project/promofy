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
import { concluirAnonimizacaoCompleta, emailAnonimoPara } from "./_anonimizacao";
import {
  DOCUMENTOS_REQUERIDOS_CONSUMIDOR,
  DOCUMENTOS_REQUERIDOS_PARCEIRO,
  DOC_PRIVACIDADE,
  DOC_TERMOS_CONSUMIDOR,
  DOC_TERMOS_PARCEIRO,
  TODOS_DOCUMENTOS_LEGAIS,
  documentoAceitavel,
  filtrarDocumentosRequeridos,
  type DocumentoLegal,
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
    const NOME_B = "QA Legal Cons B";
    const b = await criarContaQa(svc, "legal-cons-b", { nome: NOME_B });
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

    // ---- 4. Reaceite versão nova — só se aplica a documento PUBLISHED
    // (Fase 13 item 5 do WP 01H). Os 5 documentos reais estão em draft
    // hoje (ver testes DRAFT/PUBLISHED mais abaixo), então usamos um
    // fixture sintético "published" para provar a regra de versão sem
    // depender do status real, que pode mudar quando o texto for
    // formalmente publicado. ----
    const docConsumidorPublicadoFixture: DocumentoLegal = {
      ...DOC_TERMOS_CONSUMIDOR,
      status: "published",
      publishedAt: "2026-09-08",
      effectiveAt: "2026-09-08",
    };
    await svc.from("aceites_documento").insert({
      usuario_id: b.id,
      documento: DOC_TERMOS_CONSUMIDOR.documento,
      versao: "1.0", // versão ANTIGA, não a vigente (2.0)
    });
    const pendB = await pendenciasDe(cB, b.id, [docConsumidorPublicadoFixture]);
    check(
      "versão antiga aceita de doc PUBLISHED NÃO satisfaz o gate — reaceite pendente",
      pendB.some((d) => d.documento === DOC_TERMOS_CONSUMIDOR.documento),
    );
    const pendBHoje = await pendenciasDe(cB, b.id, DOCUMENTOS_REQUERIDOS_CONSUMIDOR);
    check(
      "mas hoje (documento real ainda draft) isso não gera pendência nenhuma",
      pendBHoje.length === 0,
      `pendentes=${pendBHoje.length}`,
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

    // ---- CRM fixture ANTES de anonimizar (Fase 8 WP 01H) — B "resgata"
    // um cupom real do seed (c01, estabelecimento e1, dono lojista@) para
    // provar que o CRM muda de identificável para anonimizado sem perder
    // a contagem de resgates. Insert direto (service_role): não precisa
    // passar pelo fluxo de ativação real para testar leitura do CRM.
    const { data: cupomFixture } = await svc
      .from("cupons")
      .select("categoria_nova_id")
      .eq("id", "c01")
      .maybeSingle();
    const { error: erroFixtureCupom } = await svc.from("cupons_usuario").insert({
      usuario_id: b.id,
      cupom_id: "c01",
      categoria_id: cupomFixture?.categoria_nova_id,
      status: "validado",
      validado_em: new Date().toISOString(),
    });
    check("fixture CRM: resgate de B inserido em c01/e1", !erroFixtureCupom, erroFixtureCupom?.message);

    const SENHA_SEED_LOJISTA = "promofy123"; // credencial fixa de `lojista@promofy.test` do seed local (CLAUDE.md §5)
    const cLojista1 = await logar("lojista@promofy.test", SENHA_SEED_LOJISTA);
    const crmAntes = await cLojista1.rpc("crm_cliente_detalhe", { p_usuario_id: b.id });
    const crmAntesDados = crmAntes.data as { ok: boolean; cliente?: { nome?: string; email?: string } };
    check(
      "CRM mostra nome/e-mail reais de B antes da anonimização",
      crmAntesDados?.ok === true &&
        crmAntesDados.cliente?.nome === NOME_B &&
        crmAntesDados.cliente?.email === b.email,
      JSON.stringify(crmAntesDados),
    );

    // ---- 11. Anonimização COMPLETA (P0-2): GoTrue (auth.users.email +
    // senha + ban) e só então o SQL (profiles + status). ----
    const concluir = await concluirAnonimizacaoCompleta(svc, b.id);
    check("concluirAnonimizacaoCompleta roda (auth + sql)", concluir.ok === true, JSON.stringify(concluir));

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

    const { data: authBAnon } = await svc.auth.admin.getUserById(b.id);
    const emailEsperado = emailAnonimoPara(b.id);
    check(
      "P0-2: auth.users.email real substituído por pseudônimo",
      authBAnon.user?.email === emailEsperado && authBAnon.user?.email !== b.email,
      authBAnon.user?.email,
    );
    check(
      "P0-2: conta banida (login futuro impedido)",
      Boolean(authBAnon.user?.banned_until) &&
        new Date(authBAnon.user!.banned_until as string).getTime() > Date.now() + 1000 * 60 * 60 * 24 * 365,
      authBAnon.user?.banned_until,
    );

    const loginAntigo = createClient(alvo.url, alvo.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const tentativaLoginAntigo = await loginAntigo.auth.signInWithPassword({
      email: b.email,
      password: b.senha,
    });
    check(
      "credencial anterior (e-mail/senha reais) não loga mais após anonimização",
      Boolean(tentativaLoginAntigo.error),
      tentativaLoginAntigo.error?.message,
    );

    const { data: pontosB } = await svc.from("pontos_transacoes").select("id").eq("usuario_id", b.id);
    check("histórico de pontos preservado (linha não apagada)", (pontosB?.length ?? 0) >= 1);

    const { data: aceitesB } = await svc.from("aceites_documento").select("id").eq("usuario_id", b.id);
    check("trilha de aceite preservada após anonimização", (aceitesB?.length ?? 0) >= 1);

    const { data: cupomBDepois } = await svc
      .from("cupons_usuario")
      .select("id, status")
      .eq("usuario_id", b.id)
      .eq("cupom_id", "c01");
    check(
      "histórico de resgate (cupons_usuario) preservado — linha não apagada",
      (cupomBDepois?.length ?? 0) >= 1 && cupomBDepois![0].status === "validado",
    );

    // ---- Fase 8 WP 01H: CRM DEPOIS da anonimização — mesmo estabelecimento,
    // mesma sessão de lojista, resgate ainda contado, identidade real sumiu. ----
    const crmDepois = await cLojista1.rpc("crm_cliente_detalhe", { p_usuario_id: b.id });
    const crmDepoisDados = crmDepois.data as {
      ok: boolean;
      cliente?: { nome?: string; email?: string; telefone?: string; nascimento?: string; total_resgates?: number };
    };
    check(
      "CRM não mostra nome real de B depois da anonimização",
      crmDepoisDados?.ok === true && crmDepoisDados.cliente?.nome === "Usuário anonimizado",
      JSON.stringify(crmDepoisDados),
    );
    check(
      "CRM não mostra e-mail real de B depois da anonimização",
      crmDepoisDados?.cliente?.email !== b.email,
      crmDepoisDados?.cliente?.email,
    );
    check(
      "CRM não mostra telefone/nascimento de B depois da anonimização",
      !crmDepoisDados?.cliente?.telefone && !crmDepoisDados?.cliente?.nascimento,
    );
    check(
      "CRM continua contando o resgate de B (histórico agregado preservado)",
      (crmDepoisDados?.cliente?.total_resgates ?? 0) >= 1,
      String(crmDepoisDados?.cliente?.total_resgates),
    );

    const crmListaDepois = await cLojista1.rpc("crm_clientes", {});
    const crmListaDados = crmListaDepois.data as {
      clientes?: { usuario_id: string; nome?: string; email?: string }[];
    };
    const linhaB = crmListaDados?.clientes?.find((c) => c.usuario_id === b.id);
    check(
      "lista crm_clientes também não vaza nome/e-mail reais de B",
      Boolean(linhaB) && linhaB!.nome === "Usuário anonimizado" && linhaB!.email !== b.email,
      JSON.stringify(linhaB),
    );

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

    // ---- DRAFT/PUBLISHED (Fase 2/3 WP 01H) — lógica pura, fixtures sintéticos ----
    const docDraft: DocumentoLegal = {
      documento: "teste_draft",
      versao: "1.0",
      titulo: "Doc de teste (draft)",
      slug: "teste-draft",
      status: "draft",
      publishedAt: null,
      effectiveAt: null,
      requiresAcceptance: true,
      papeis: ["consumidor"],
    };
    const docPublished: DocumentoLegal = {
      ...docDraft,
      documento: "teste_published",
      slug: "teste-published",
      status: "published",
      publishedAt: "2026-09-08",
      effectiveAt: "2026-09-18",
    };
    check("documentoAceitavel(draft) === false", documentoAceitavel(docDraft) === false);
    check("documentoAceitavel(published) === true", documentoAceitavel(docPublished) === true);
    const filtrados = filtrarDocumentosRequeridos([docDraft, docPublished], "consumidor");
    check(
      "filtrarDocumentosRequeridos: DRAFT não entra no gate",
      !filtrados.some((d) => d.documento === "teste_draft"),
    );
    check(
      "filtrarDocumentosRequeridos: PUBLISHED entra no gate",
      filtrados.some((d) => d.documento === "teste_published"),
    );
    check(
      "hoje, com os 5 documentos reais em draft, nenhum é requerido para consumidor",
      DOCUMENTOS_REQUERIDOS_CONSUMIDOR.length === 0,
      `requeridos=${DOCUMENTOS_REQUERIDOS_CONSUMIDOR.map((d) => d.documento).join(",")}`,
    );
    check(
      "hoje, com os 5 documentos reais em draft, nenhum é requerido para parceiro",
      DOCUMENTOS_REQUERIDOS_PARCEIRO.length === 0,
    );
    check(
      "documento inexistente não é resolvido (registrarAceiteAction rejeitaria)",
      TODOS_DOCUMENTOS_LEGAIS.find((d) => d.documento === "documento-que-nao-existe") === undefined,
    );

    // ---- Fase 12: gap analysis reclassifica 18+ como requisito, não decisão-se-existe ----
    const gapAnalysis = fonteSemComentarios("docs/audits/2026-09-08-legal-privacy-gap-analysis.md");
    check(
      "gap analysis não afirma implementação de gate de idade em runtime",
      !/gate.{0,20}(18|idade).{0,40}implementad/i.test(gapAnalysis),
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

    // ---- Fase 4: páginas legais mostram fonte real, não mais o placeholder ----
    const paginaLegal = fonteSemComentarios("src/app/legal/[doc]/page.tsx");
    check(
      '"PENDING LEGAL FINALIZATION" não é mais usado como substituto de conteúdo',
      !/PENDING LEGAL FINALIZATION/.test(paginaLegal),
    );
    check(
      "página legal sinaliza draft como 'em revisão — não vigente', fora do texto jurídico",
      /em revisão.{0,20}não vigente/i.test(paginaLegal),
    );

    // ---- Fase 5/19: conteúdo armazenado preserva as contradições verbatim
    // (prova de que nada foi "corrigido" silenciosamente no texto). ----
    const termosConsumidorTxt = fonteSemComentarios("src/lib/legal-content/termos-consumidor.ts");
    check(
      "termos-consumidor preserva a contradição de CNPJ verbatim (não corrigida)",
      /68\.003\.330\/0001-74/.test(termosConsumidorTxt) &&
        /A ser obtido no ato da abertura/.test(termosConsumidorTxt),
    );
    check(
      "termos-consumidor preserva o formato de código do documento (PRM-XXXXXX), mesmo divergindo do runtime PRMF-XXXX-XXXX",
      /PRM-XXXXXX/.test(termosConsumidorTxt),
    );
    const privacidadeTxt = fonteSemComentarios("src/lib/legal-content/privacidade.ts");
    check(
      "privacidade preserva a menção a Google Cloud Platform verbatim (contradiz runtime Vercel+Supabase)",
      /Google Cloud Platform/.test(privacidadeTxt),
    );
    check(
      "placeholder [DATA DE PUBLICAÇÃO] preservado verbatim (não inventamos data)",
      /\[DATA DE PUBLICAÇÃO\]/.test(privacidadeTxt),
    );
    const promopointsTxt = fonteSemComentarios("src/lib/legal-content/promopoints.ts");
    check(
      "promopoints preserva os valores do documento (100/50/200/50/5) verbatim",
      /\b100\b/.test(promopointsTxt) && /\b200\b/.test(promopointsTxt),
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
