/**
 * Suíte CLIENT-RETURNS-01 — fechamento dos retornos do cliente em
 * /e, /portal e /admin.
 *
 * Prova comportamento real: módulos puros (filtro, recorte), leitura de
 * fonte (UI honesta) e PostgREST com sessão real (posse, CPF, exclusão
 * lógica, reenvio, edição admin). Conta `qa-*` efêmera para o consumidor;
 * `consumidor@` e `convidado@` NUNCA são tocados.
 *
 * Cobertura mínima do WP (itens 1–10):
 *  1. lojista não altera estabelecimento alheio
 *  2. logo/perfil persiste
 *  3. validação CPF respeita estabelecimento
 *  4. edição de cupom preserva regras (contrato parcial)
 *  5. exclusão continua lógica
 *  6. reativação/reenvio correto
 *  7. admin edit não permite tenant escape
 *  8. filtros não alteram dados
 *  9. config não finge persistência
 * 10. lifecycle não sofre regressão
 */
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolverAlvo } from "./_alvo";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import { montarPatchCupom } from "../src/lib/cupom-patch";
import {
  FILTROS_ATRIBUTO_VAZIOS,
  filtrarAtributosLojista,
  filtrarListagemLojista,
  filtrosAtributoAtivos,
} from "../src/lib/lojista-filtros";
import {
  ASPECTO_IMAGEM_CUPOM,
  escalaCover,
  limitarPan,
  retanguloFonte,
} from "../src/lib/recorte-imagem";
import { PATH_IMAGEM_RE } from "../src/lib/imagem-cupom";

const alvo = resolverAlvo("test-client-returns-estab-admin");

const SENHA = "promofy123";
const CUPOM_EXCL = "cr01-excluir";
const CUPOM_ADMIN = "cr01-admin-edit";
const CUPOM_REENV = "cr01-reenviar";

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
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
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

function testarModulosPuros() {
  console.log("\n[puro] Filtros do lojista não mutam a fonte (item 8)");

  const fonte = [
    {
      id: "a",
      statusPortal: "ativo",
      categoriaId: "cat-1",
      dias: ["Sex"],
      formasConsumo: ["local"],
    },
    {
      id: "b",
      statusPortal: "pendente",
      categoriaId: "cat-2",
      dias: ["Seg"],
      formasConsumo: ["delivery"],
    },
    {
      id: "x",
      statusPortal: "excluido",
      categoriaId: "cat-1",
      dias: ["Sex"],
      formasConsumo: ["local"],
    },
  ];
  const snapshot = JSON.stringify(fonte);

  const soAtivos = filtrarListagemLojista(fonte, "ativo", FILTROS_ATRIBUTO_VAZIOS);
  check("filtro por aba 'ativo' devolve só o ativo operacional", soAtivos.length === 1 && soAtivos[0].id === "a");
  check("…e 'Todos' esconde o excluído", filtrarListagemLojista(fonte, "todos", FILTROS_ATRIBUTO_VAZIOS).length === 2);

  const porCat = filtrarAtributosLojista(fonte, {
    ...FILTROS_ATRIBUTO_VAZIOS,
    categoriaId: "cat-1",
  });
  check("filtro por categoria não pega a outra folha", porCat.every((i) => i.categoriaId === "cat-1") && porCat.length === 2);

  const porDia = filtrarListagemLojista(fonte, "todos", {
    ...FILTROS_ATRIBUTO_VAZIOS,
    dia: "Sex",
  });
  check("filtro por dia (operacional) pega só o de sexta", porDia.length === 1 && porDia[0].id === "a");

  const porForma = filtrarListagemLojista(fonte, "todos", {
    ...FILTROS_ATRIBUTO_VAZIOS,
    formaConsumo: "delivery",
  });
  check("filtro por forma de consumo pega o de delivery", porForma.length === 1 && porForma[0].id === "b");

  check("a lista de origem continua idêntica após filtrar", JSON.stringify(fonte) === snapshot);
  check("filtros vazios não contam como ativos", !filtrosAtributoAtivos(FILTROS_ATRIBUTO_VAZIOS));
  check("um atributo preenchido conta como ativo", filtrosAtributoAtivos({ ...FILTROS_ATRIBUTO_VAZIOS, dia: "Sex" }));

  console.log("\n[puro] Recorte da imagem (aspecto do card)");

  check("aspecto do card é 2:1", ASPECTO_IMAGEM_CUPOM === 2);

  const coverQuadrado = escalaCover(2000, 2000, 400, 200);
  check("cover de quadrado em faixa 2:1 usa a largura", coverQuadrado === 0.2, String(coverQuadrado));

  const centro = retanguloFonte({
    viewW: 400,
    viewH: 200,
    naturalW: 2000,
    naturalH: 2000,
    panX: 0,
    panY: 0,
    zoom: 1,
  });
  check(
    "quadrado centrado recorta a faixa do meio",
    Math.abs(centro.sx) < 1 &&
      Math.abs(centro.sy - 500) < 1 &&
      Math.abs(centro.sw - 2000) < 1 &&
      Math.abs(centro.sh - 1000) < 1,
    JSON.stringify(centro),
  );

  check("pan além do limite é clamado", limitarPan(9999, 800, 400) === 200, String(limitarPan(9999, 800, 400)));

  console.log("\n[puro] Edição parcial preserva o que o form não enviou (item 4)");

  const soTitulo = montarPatchCupom({ titulo: "Novo título" });
  check("patch só com título não toca regras/horários/imagem", soTitulo.ok && soTitulo.ok && !("regras" in soTitulo.patch) && !("horarios" in soTitulo.patch) && !("imagem" in soTitulo.patch));

  const comRegras = montarPatchCupom({
    titulo: "X",
    regras: ["  traga documento  ", "", "uma unidade"],
  });
  check(
    "regras entram saneadas quando o form as envia",
    comRegras.ok && JSON.stringify(comRegras.patch.regras) === JSON.stringify(["traga documento", "uma unidade"]),
    comRegras.ok ? JSON.stringify(comRegras.patch.regras) : comRegras.erro,
  );
}

function testarFonte() {
  console.log("\n[fonte] CTAs, crop, CPF, exclusão, config, perfil, admin (itens 2, 5, 6, 9)");

  const dashE = fonteSemComentarios("src/app/e/page.tsx");
  check("dashboard /e tem CTA de criação", /\/e\/cupom\/novo/.test(dashE));

  const dashPortal = fonteSemComentarios("src/app/portal/(painel)/page.tsx");
  check("dashboard portal tem CTA de criação", /\/portal\/cupons\?novo=1/.test(dashPortal));

  const campoImg = fonteSemComentarios("src/components/campo-imagem.tsx");
  check(
    "upload de imagem passa pelo recorte antes de enviar",
    /CropImagem|crop-imagem/.test(campoImg),
    "campo-imagem ainda sobe o arquivo cru",
  );

  const dialogPortal = fonteSemComentarios("src/components/portal/validar-cupom-dialog.tsx");
  check(
    "portal valida por CPF com o mesmo componente do /e",
    /ValidarPorCpf/.test(dialogPortal),
  );

  const cuponsE = fonteSemComentarios("src/app/e/cupons/cupons-client.tsx")
    + fonteSemComentarios("src/app/e/cupons/page.tsx")
    + fonteSemComentarios("src/components/estab/excluir-cupom-button.tsx");
  check(
    "/e expõe exclusão lógica (excluirCupomAction)",
    /excluirCupomAction/.test(cuponsE),
  );
  check(
    "/e NÃO chama .delete() em cupons",
    !/\.from\(\s*"cupons"\s*\)[\s\S]{0,80}\.delete\(/.test(cuponsE),
  );

  const portalFiltros = fonteSemComentarios("src/app/portal/(painel)/cupons/cupons-client.tsx");
  check(
    "portal filtra por categoria/dia/forma além do status",
    /filtrarListagemLojista|filtrarAtributosLojista/.test(portalFiltros),
  );

  const eFiltros = fonteSemComentarios("src/app/e/cupons/cupons-client.tsx");
  check(
    "/e filtra por status/categoria/dia/forma",
    /filtrarListagemLojista|filtrarAtributosLojista/.test(eFiltros),
  );

  const portalCfg = fonteSemComentarios("src/app/portal/(painel)/configuracoes/page.tsx");
  check(
    "portal/configuracoes não tem switch operacional só-React",
    !/onCheckedChange/.test(portalCfg) && /em breve/i.test(portalCfg),
  );

  const adminCfg = fonteSemComentarios("src/app/admin/(painel)/configuracoes/configuracoes-client.tsx");
  check(
    "admin/configuracoes não finge salvar pontos no clique",
    /salvarConfigPontosAction/.test(adminCfg) &&
      !/onClick=\{\(\) => setSalvo\(true\)\}/.test(adminCfg),
  );
  check(
    "tabela de pontos chama action de persistência",
    /salvarConfigPontosAction/.test(adminCfg),
  );
  check(
    "toggles de plataforma do admin não são operacionais",
    !/onCheckedChange/.test(adminCfg) && /em breve/i.test(adminCfg),
  );

  const estabPage = fonteSemComentarios("src/app/portal/(painel)/estabelecimento/page.tsx");
  const estabForm = fonteSemComentarios("src/app/portal/(painel)/estabelecimento/estabelecimento-form.tsx");
  check(
    "perfil do estabelecimento persiste via action (não só React)",
    /salvarPerfilEstabAction/.test(estabForm) && /buscarEstabelecimentoDaSessao/.test(estabPage),
  );
  check(
    "perfil não aceita estabelecimento_id do client como autoridade",
    !/estabelecimentoId/.test(estabForm) || /owner_id/.test(fonteSemComentarios("src/lib/actions/estab.ts")),
  );

  const adminCupons = fonteSemComentarios("src/app/admin/(painel)/cupons/cupons-client.tsx");
  check(
    "admin consegue editar cupom (não só aprovar/rejeitar)",
    /adminEditarCupomAction/.test(adminCupons),
  );

  const globais = fonteSemComentarios("src/app/globals.css");
  check(
    "produto é light-only de forma explícita (color-scheme: light)",
    /color-scheme:\s*light/.test(globais),
  );

  const eForm = fonteSemComentarios("src/app/e/cupom/novo/novo-cupom-form.tsx");
  const portalForm = fonteSemComentarios("src/components/portal/novo-cupom-form.tsx");
  check("form do portal edita regras (não só benefício)", /regras/.test(portalForm) && /setRegrasTexto/.test(portalForm));
  check("form do /e também envia regras quando preenchidas", /regras/.test(eForm));
}

async function testarBanco(): Promise<void> {
  console.log("\n[banco] Posse, perfil, CPF, exclusão, reenvio, admin, lifecycle");

  const dono = await logar("lojista@promofy.test");
  const outro = await logar("lojista2@promofy.test");
  const admin = await logar("admin@promofy.test");

  const { data: e1antes } = await svc
    .from("estabelecimentos")
    .select("nome, cidade, logo, categoria_id, categoria_principal_id")
    .eq("id", "e1")
    .maybeSingle();
  if (!e1antes) throw new Error("e1 não encontrado no seed");
  const nomeOriginal = e1antes.nome;
  const cidadeOriginal = e1antes.cidade;
  const catE1 = e1antes.categoria_id as string;
  const catNovaE1 = e1antes.categoria_principal_id as string;

  const baseCupom = {
    estabelecimento_id: "e1",
    categoria_id: catE1,
    categoria_nova_id: catNovaE1,
    economia: 10,
    validade_fim: "2035-12-31",
    horarios: { descricao: "todos os dias", dias: [] as string[], inicio: "00:00", fim: "23:59" },
  };

  let qa: ContaQa | null = null;

  try {
    // 1. lojista não altera estabelecimento alheio
    const invasao = await outro
      .from("estabelecimentos")
      .update({ nome: "HACKEADO" })
      .eq("id", "e1")
      .select("id");
    check(
      "1. lojista2 NÃO atualiza o e1",
      Boolean(invasao.error) || (invasao.data ?? []).length === 0,
      invasao.error?.message ?? JSON.stringify(invasao.data),
    );
    const { data: e1depoisInvasao } = await svc
      .from("estabelecimentos")
      .select("nome")
      .eq("id", "e1")
      .maybeSingle();
    check("1b. nome do e1 intacto após tentativa alheia", e1depoisInvasao?.nome === nomeOriginal);

    // 2. perfil persiste (nome/cidade/logo) na sessão do dono
    const logoPath = "e1/" + "a".repeat(32) + ".jpg";
    check("2a. caminho de logo respeita o formato do bucket de cupom", PATH_IMAGEM_RE.test(logoPath));

    const persistiu = await dono
      .from("estabelecimentos")
      .update({ nome: "Sabor QA CR01", cidade: "Cidade QA", logo: logoPath })
      .eq("id", "e1")
      .select("nome, cidade, logo")
      .maybeSingle();
    check(
      "2. lojista persiste nome/cidade/logo do PRÓPRIO estabelecimento",
      persistiu.data?.nome === "Sabor QA CR01" &&
        persistiu.data?.cidade === "Cidade QA" &&
        persistiu.data?.logo === logoPath,
      JSON.stringify(persistiu.error ?? persistiu.data),
    );

    const restore = await dono
      .from("estabelecimentos")
      .update({ nome: nomeOriginal, cidade: cidadeOriginal, logo: "" })
      .eq("id", "e1")
      .select("nome")
      .maybeSingle();
    check("2b. restaura o nome do e1 depois da prova", restore.data?.nome === nomeOriginal);

    // 3. CPF respeita estabelecimento — o RPC unifica "não achei"
    qa = await criarContaQa(svc, "cr01", { nome: "Cliente CR01" });
    const cliente = await logar(qa.email, qa.senha);

    await svc.from("cupons").delete().eq("id", "cr01-cpf");
    await svc.from("cupons").insert({
      ...baseCupom,
      id: "cr01-cpf",
      titulo: "CR01 CPF",
      beneficio: "prova",
      status: "ativo",
    });
    const ativ = await cliente.rpc("ativar_cupom", { p_cupom_id: "cr01-cpf" });
    const ativOk = (ativ.data as { ok?: boolean } | null)?.ok === true;
    check("3a. consumidor ativa cupom do e1 (premissa do CPF)", ativOk, JSON.stringify(ativ.data ?? ativ.error));

    const cpfQa = (await svc.from("profiles").select("cpf").eq("id", qa.id).maybeSingle()).data?.cpf as string;
    const buscaDono = await dono.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfQa });
    const buscaOutro = await outro.rpc("buscar_ativacoes_por_cpf", { p_cpf: cpfQa });
    const rDono = buscaDono.data as { ok?: boolean; itens?: unknown[]; motivo?: string } | null;
    const rOutro = buscaOutro.data as { ok?: boolean; motivo?: string } | null;
    check(
      "3. dono do e1 vê a ativação por CPF",
      rDono?.ok === true && Array.isArray(rDono.itens) && rDono.itens.length > 0,
      JSON.stringify(rDono),
    );
    check(
      "3b. lojista2 NÃO distingue CPF de cliente alheio (sem_ativacao_aqui)",
      rOutro?.ok === false && rOutro?.motivo === "sem_ativacao_aqui",
      JSON.stringify(rOutro),
    );

    // 5. exclusão lógica
    await svc.from("cupons").delete().eq("id", CUPOM_EXCL);
    await svc.from("cupons").insert({
      ...baseCupom,
      id: CUPOM_EXCL,
      titulo: "CR01 excluir",
      beneficio: "prova exclusão",
      status: "ativo",
    });
    await svc.from("cupom_eventos").insert({
      cupom_id: CUPOM_EXCL,
      usuario_id: qa.id,
      tipo: "visualizacao",
    });

    const excl = await dono.rpc("excluir_cupom", { p_cupom_id: CUPOM_EXCL });
    const exclData = excl.data as { ok?: boolean; motivo?: string } | null;
    check("5. excluir_cupom devolve ok", exclData?.ok === true, JSON.stringify(excl.data ?? excl.error));

    const { data: linhaExcl } = await svc
      .from("cupons")
      .select("id, status")
      .eq("id", CUPOM_EXCL)
      .maybeSingle();
    check("5b. a linha CONTINUA no banco (não é DELETE físico)", linhaExcl?.id === CUPOM_EXCL);
    check("5c. status virou excluido", linhaExcl?.status === "excluido", String(linhaExcl?.status));

    const { count: evCount } = await svc
      .from("cupom_eventos")
      .select("id", { count: "exact", head: true })
      .eq("cupom_id", CUPOM_EXCL);
    check("5d. eventos do cupom sobrevivem à exclusão", (evCount ?? 0) >= 1, String(evCount));

    const delFisico = await dono.from("cupons").delete().eq("id", CUPOM_EXCL).select("id");
    check(
      "5e. DELETE físico via PostgREST é recusado",
      Boolean(delFisico.error) || (delFisico.data ?? []).length === 0,
      delFisico.error?.message ?? "apagou!",
    );

    // 6. reenvio: rejeitado sim; esgotado não (campanha nova)
    await svc.from("cupons").delete().eq("id", CUPOM_REENV);
    await svc.from("cupons").insert({
      ...baseCupom,
      id: CUPOM_REENV,
      titulo: "CR01 reenviar",
      beneficio: "prova reenvio",
      status: "rejeitado",
    });
    const reenv = await dono.rpc("reenviar_cupom_moderacao", { p_cupom_id: CUPOM_REENV });
    const reenvData = reenv.data as { ok?: boolean; motivo?: string } | null;
    check("6. rejeitado reenvia para análise", reenvData?.ok === true, JSON.stringify(reenv.data ?? reenv.error));

    const { data: aposReenv } = await svc.from("cupons").select("status").eq("id", CUPOM_REENV).maybeSingle();
    check("6b. status após reenvio é pendente", aposReenv?.status === "pendente", String(aposReenv?.status));

    await svc.from("cupons").update({ status: "esgotado" }).eq("id", CUPOM_REENV);
    const reenvEsg = await dono.rpc("reenviar_cupom_moderacao", { p_cupom_id: CUPOM_REENV });
    const reenvEsgData = reenvEsg.data as { ok?: boolean; motivo?: string } | null;
    check(
      "6c. esgotado NÃO reabre a mesma linha (nao_rejeitado)",
      reenvEsgData?.ok === false && reenvEsgData?.motivo === "nao_rejeitado",
      JSON.stringify(reenvEsg.data ?? reenvEsg.error),
    );

    // 7. admin edit — sem tenant escape
    await svc.from("cupons").delete().eq("id", CUPOM_ADMIN);
    await svc.from("cupons").insert({
      ...baseCupom,
      id: CUPOM_ADMIN,
      titulo: "CR01 admin",
      beneficio: "antes",
      status: "ativo",
      regras: ["regra original"],
    });

    const lojistaRpc = await dono.rpc("admin_editar_cupom", {
      p_cupom_id: CUPOM_ADMIN,
      p_patch: { titulo: "hack" },
    });
    const lojistaRpcData = lojistaRpc.data as { ok?: boolean; motivo?: string } | null;
    check(
      "7. lojista NÃO chama admin_editar_cupom",
      lojistaRpcData?.ok === false && lojistaRpcData?.motivo === "sem_permissao",
      JSON.stringify(lojistaRpc.data ?? lojistaRpc.error),
    );

    const proibido = await admin.rpc("admin_editar_cupom", {
      p_cupom_id: CUPOM_ADMIN,
      p_patch: { estabelecimento_id: "e2", titulo: "não deveria" },
    });
    const proibidoData = proibido.data as { ok?: boolean; motivo?: string } | null;
    check(
      "7b. patch com estabelecimento_id é recusado (campo_proibido)",
      proibidoData?.ok === false && proibidoData?.motivo === "campo_proibido",
      JSON.stringify(proibido.data ?? proibido.error),
    );

    const edita = await admin.rpc("admin_editar_cupom", {
      p_cupom_id: CUPOM_ADMIN,
      p_patch: { titulo: "CR01 admin corrigido", beneficio: "depois" },
    });
    const editaData = edita.data as { ok?: boolean } | null;
    check("7c. admin edita título/benefício", editaData?.ok === true, JSON.stringify(edita.data ?? edita.error));

    const { data: aposAdmin } = await svc
      .from("cupons")
      .select("titulo, beneficio, estabelecimento_id, regras, moderacao_historico")
      .eq("id", CUPOM_ADMIN)
      .maybeSingle();
    check("7d. estabelecimento dono NÃO mudou", aposAdmin?.estabelecimento_id === "e1");
    check("7e. título persistiu", aposAdmin?.titulo === "CR01 admin corrigido");
    check(
      "7f. regras originais preservadas (não enviadas no patch)",
      JSON.stringify(aposAdmin?.regras) === JSON.stringify(["regra original"]),
      JSON.stringify(aposAdmin?.regras),
    );
    const hist = aposAdmin?.moderacao_historico;
    check(
      "7g. trilha de auditoria ganhou editado_admin",
      Array.isArray(hist) && hist.some((e: { acao?: string }) => e.acao === "editado_admin"),
      JSON.stringify(hist),
    );

    // 10. lifecycle: ativar cupom ativo do seed ainda funciona
    const ciclo = await cliente.rpc("ativar_cupom", { p_cupom_id: "c01" });
    const cicloData = ciclo.data as { ok?: boolean; motivo?: string } | null;
    check(
      "10. ativar_cupom do seed continua respondendo (ok ou ja_ativo/limite)",
      cicloData?.ok === true ||
        ["ja_ativo", "limite_usuario", "fora_da_janela"].includes(cicloData?.motivo ?? ""),
      JSON.stringify(ciclo.data ?? ciclo.error),
    );
  } finally {
    await svc.from("cupons").delete().eq("id", "cr01-cpf");
    await svc.from("cupons").delete().eq("id", CUPOM_EXCL);
    await svc.from("cupons").delete().eq("id", CUPOM_REENV);
    await svc.from("cupons").delete().eq("id", CUPOM_ADMIN);
    await svc
      .from("estabelecimentos")
      .update({ nome: nomeOriginal, cidade: cidadeOriginal, logo: "" })
      .eq("id", "e1");
    await destruirContaQa(svc, qa?.id);
  }
}

async function main(): Promise<number> {
  console.log(`\n[test-client-returns-estab-admin] alvo: ${alvo.nome} (${alvo.envFile})\n`);
  testarModulosPuros();
  testarFonte();
  await testarBanco();
  return encerrar(passed, failed);
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
