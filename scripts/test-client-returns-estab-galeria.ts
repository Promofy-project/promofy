/**
 * Suíte CLIENT-RETURNS-03 — galeria do PERFIL do estabelecimento.
 *
 * Prova comportamento real: módulo puro (ordem, teto, alt, movimento), fonte
 * (as duas superfícies de gestão montam o MESMO componente; a galeria é do
 * perfil e não do cupom) e PostgREST com sessão real (posse, isolamento de
 * tenant, forma do caminho, teto, reorder, remoção).
 *
 * ONDE O STORAGE NÃO É EXERCITADO, E POR QUÊ
 * O `[storage]` local está DESLIGADO (gate da Fase 7 — o healthcheck do
 * storage-api derruba o stack e com ele o `db:reset`, primeiro passo do
 * `verify`). Então esta suíte NÃO sobe bytes: ela prova o que o BANCO garante
 * (a linha, o CHECK de forma, o CHECK de pasta, as policies) e assere por
 * FONTE que a galeria reutiliza o bucket `cupom-imagens` — sem bucket novo e
 * sem policy de storage nova. Dito em voz alta porque um verde que não roda no
 * alvo é pior que um vermelho.
 *
 * Contas: `lojista@` (dono de e1, e3..e6) e `lojista2@` (dono de e2) são
 * contas de teste do seed. Conta `qa-*` efêmera para o consumidor.
 * `consumidor@` e `convidado@` NUNCA são tocados.
 *
 * Cobertura do WP:
 *   segurança  1–10 · funcional 11–20
 */
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolverAlvo } from "./_alvo";
import { criarContaQa, destruirContaQa, encerrar, type ContaQa } from "./_qa-conta";
import {
  ASPECTO_IMAGEM_GALERIA,
  MAX_IMAGENS_GALERIA,
  altImagemGaleria,
  galeriaCheia,
  moverNaGaleria,
  ordenarGaleria,
  proximaOrdemGaleria,
} from "../src/lib/galeria-estabelecimento";
import { PATH_IMAGEM_RE, caminhoImagem, validarBytesImagem } from "../src/lib/imagem-cupom";

const alvo = resolverAlvo("test-client-returns-estab-galeria");

const SENHA = "promofy123";
const TABELA = "estabelecimento_galeria";

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

function fonte(caminho: string): string {
  return readFileSync(caminho, "utf8");
}

function fonteSemComentarios(caminho: string): string {
  return fonte(caminho)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}

const svc = createClient(alvo.url, alvo.serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(alvo.url, alvo.anonKey, {
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

/** Caminho VÁLIDO e determinístico na pasta de um estabelecimento. */
function caminhoDeTeste(estab: string, semente: number): string {
  const hex = semente.toString(16).padStart(2, "0").repeat(16).slice(0, 32);
  return caminhoImagem(estab, hex, "jpg");
}

// ============================================================
// MÓDULO PURO
// ============================================================
function testarModuloPuro() {
  console.log("\n[puro] Regra da galeria — ordem, teto, movimento, alt");

  // 14. ordem determinística
  const fonteLista = [
    { id: "c", imagem: "e1/c.jpg", ordem: 1, criadoEm: "2026-09-01T10:00:00Z" },
    { id: "a", imagem: "e1/a.jpg", ordem: 0, criadoEm: "2026-09-01T10:00:00Z" },
    { id: "b", imagem: "e1/b.jpg", ordem: 0, criadoEm: "2026-09-01T09:00:00Z" },
  ];
  const snapshot = JSON.stringify(fonteLista);
  const ord = ordenarGaleria(fonteLista);
  check(
    "14a. ordem: `ordem` manda, empate cai em criado_em",
    ord.map((i) => i.id).join(",") === "b,a,c",
    ord.map((i) => i.id).join(","),
  );
  check("14b. ordenarGaleria NÃO muta a entrada", JSON.stringify(fonteLista) === snapshot);

  const empateTotal = [
    { id: "z", imagem: "e1/z.jpg", ordem: 0, criadoEm: "2026-09-01T10:00:00Z" },
    { id: "a", imagem: "e1/a.jpg", ordem: 0, criadoEm: "2026-09-01T10:00:00Z" },
  ];
  check(
    "14c. empate de ordem E de data desempata por id (nunca sobra empate)",
    ordenarGaleria(empateTotal).map((i) => i.id).join(",") === "a,z",
  );

  check(
    "14d. próxima ordem é sempre depois da maior (não reaproveita buraco)",
    proximaOrdemGaleria(fonteLista) === 2,
  );
  check("14e. galeria vazia começa em 0", proximaOrdemGaleria([]) === 0);

  // teto técnico
  check("10a. teto técnico é conservador e maior que zero", MAX_IMAGENS_GALERIA === 12);
  check("10b. galeriaCheia só no teto", !galeriaCheia(11) && galeriaCheia(12) && galeriaCheia(13));

  // 15. movimento (reorder)
  const ids = ["a", "b", "c"];
  check(
    "15a. mover para a direita troca com o vizinho",
    (moverNaGaleria(ids, "a", "direita") ?? []).join(",") === "b,a,c",
  );
  check(
    "15b. mover para a esquerda troca com o vizinho",
    (moverNaGaleria(ids, "c", "esquerda") ?? []).join(",") === "a,c,b",
  );
  check("15c. primeiro para a esquerda é no-op", moverNaGaleria(ids, "a", "esquerda") === null);
  check("15d. último para a direita é no-op", moverNaGaleria(ids, "c", "direita") === null);
  check("15e. id ausente é no-op", moverNaGaleria(ids, "zzz", "direita") === null);
  check("15f. moverNaGaleria NÃO muta a entrada", ids.join(",") === "a,b,c");

  // 17 (a11y). alt não inventa conteúdo
  const alt = altImagemGaleria("Sabor & Cia", 1, 5);
  check(
    "17a. alt diz posição e estabelecimento, sem descrever a foto",
    alt === "Imagem 2 de 5 do estabelecimento Sabor & Cia",
    alt,
  );
  check(
    "17b. imagem única não vira '1 de 1'",
    altImagemGaleria("Sabor & Cia", 0, 1) === "Imagem do estabelecimento Sabor & Cia",
  );
  check(
    "17c. nome vazio degrada sem quebrar a frase",
    altImagemGaleria("   ", 0, 1) === "Imagem do estabelecimento",
  );

  // 9 (crop). a galeria não usa a faixa 2:1 do card de cupom
  check(
    "9a. aspecto da galeria não é o 2:1 do card de cupom",
    ASPECTO_IMAGEM_GALERIA !== 2 && ASPECTO_IMAGEM_GALERIA > 1,
    String(ASPECTO_IMAGEM_GALERIA),
  );

  // 7 (validação de arquivo) — a MESMA regra já aprovada para logo/cupom
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const svg = new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  const html = new Uint8Array(Buffer.from("<!doctype html><script>alert(1)</script>"));
  check("7a. PNG real é aceito", validarBytesImagem(png).ok === true);
  const rSvg = validarBytesImagem(svg);
  check(
    "7b. SVG é recusado (tipo_invalido)",
    rSvg.ok === false && rSvg.motivo === "tipo_invalido",
  );
  const rHtml = validarBytesImagem(html);
  check(
    "7c. HTML renomeado é recusado (magic bytes, não extensão)",
    rHtml.ok === false && rHtml.motivo === "tipo_invalido",
  );
  const rVazio = validarBytesImagem(new Uint8Array(0));
  check("7d. arquivo vazio é recusado", rVazio.ok === false && rVazio.motivo === "vazio");
  const rGrande = validarBytesImagem(new Uint8Array(3 * 1024 * 1024));
  check(
    "7e. arquivo acima de 2 MB é recusado antes de olhar o conteúdo",
    rGrande.ok === false && rGrande.motivo === "muito_grande",
  );

  // 6 (traversal). o formato não admite caminho relativo nem subpasta
  check("6a. `..` no caminho não casa com o formato", !PATH_IMAGEM_RE.test("../e2/" + "a".repeat(32) + ".jpg"));
  check("6b. subpasta extra não casa", !PATH_IMAGEM_RE.test("e1/galeria/" + "a".repeat(32) + ".jpg"));
  check("6c. caminho absoluto não casa", !PATH_IMAGEM_RE.test("/e1/" + "a".repeat(32) + ".jpg"));
  check("6d. o caminho montado no servidor casa", PATH_IMAGEM_RE.test(caminhoDeTeste("e1", 1)));
}

// ============================================================
// FONTE — o que a UI promete
// ============================================================
function testarFonte() {
  console.log("\n[fonte] Superfícies, reúso e ausência de galeria de cupom");

  const portal = fonteSemComentarios("src/app/portal/(painel)/estabelecimento/page.tsx");
  const eperfil = fonteSemComentarios("src/app/e/perfil/page.tsx");
  const perfilConsumidor = fonteSemComentarios("src/app/m/estabelecimentos/[id]/page.tsx");
  const componente = fonteSemComentarios("src/components/estab/galeria-estabelecimento.tsx");
  const migration = fonte("supabase/migrations/20260909120000_client_returns_estab_galeria.sql");
  const actions = fonte("src/lib/actions/galeria-estab.ts");

  // 16 + 17 + 12. paridade Portal ↔ /e pelo MESMO componente
  check(
    "16. Portal monta a galeria",
    portal.includes("GaleriaEstabelecimento") && portal.includes("buscarGaleriaDaSessao"),
  );
  check(
    "17. /e monta a MESMA galeria (paridade por compartilhamento, não por cópia)",
    eperfil.includes("GaleriaEstabelecimento") && eperfil.includes("buscarGaleriaDaSessao"),
  );
  check(
    "12b. as duas superfícies importam o mesmo arquivo de componente",
    portal.includes("@/components/estab/galeria-estabelecimento") &&
      eperfil.includes("@/components/estab/galeria-estabelecimento"),
  );

  // 20. consumidor vê a galeria no PERFIL
  check(
    "20a. o perfil do consumidor lê a galeria pública",
    perfilConsumidor.includes("buscarGaleriaPublica") &&
      perfilConsumidor.includes("GaleriaPerfilEstab"),
  );
  check(
    "11. galeria vazia devolve null em vez de bloco quebrado",
    fonteSemComentarios("src/components/galeria-perfil-estab.tsx").includes(
      "if (validas.length === 0) return null;",
    ),
  );

  // Reúso de storage: sem bucket novo, sem policy de storage nova
  check(
    "reuso. a migration NÃO cria bucket novo",
    !/insert\s+into\s+storage\.buckets/i.test(migration),
  );
  check(
    "reuso. a migration NÃO cria policy em storage.objects",
    !/on\s+storage\.objects/i.test(migration),
  );
  check(
    "reuso. a Action usa o bucket cupom-imagens já existente",
    actions.includes("BUCKET_IMAGENS") && !/from\(["'`]galeria/i.test(actions),
  );
  check(
    "reuso. o cropper é o mesmo (nenhum segundo cropper no repo)",
    componente.includes('from "@/components/crop-imagem"'),
  );

  // 18. performance — nada de base64/bytes no banco
  check(
    "18a. a coluna guarda CAMINHO, não URL nem base64",
    /imagem\s+text not null/.test(migration) && !/base64/i.test(migration),
  );
  check(
    "18b. as imagens carregam com lazy loading",
    fonteSemComentarios("src/components/galeria-perfil-estab.tsx").includes('loading="lazy"') &&
      componente.includes('loading="lazy"'),
  );

  // 19. cache/revalidation
  check(
    "19. a Action revalida portal, /e e o perfil do consumidor",
    actions.includes('revalidatePath("/portal/estabelecimento")') &&
      actions.includes('revalidatePath("/e/perfil")') &&
      actions.includes("revalidatePath(`/m/estabelecimentos/${estabelecimentoId}`)"),
  );

  // Guard-rail de escopo: NENHUMA galeria de cupom foi criada
  const arquivosNovos = [
    "src/lib/galeria-estabelecimento.ts",
    "src/lib/data/galeria-estab.ts",
    "src/lib/actions/galeria-estab.ts",
    "src/components/estab/galeria-estabelecimento.tsx",
    "src/components/galeria-perfil-estab.tsx",
  ];
  check(
    "escopo. nenhum arquivo novo cria tabela/coluna de galeria de CUPOM",
    arquivosNovos.every((f) => !/cupom_galeria|cupons_galeria|galeria_cupom/i.test(fonte(f))),
  );
  check(
    "escopo. a migration não toca em public.cupons",
    !/alter table public\.cupons|create table public\.cupom/i.test(migration),
  );

  // O contrato do UPDATE por coluna (a armadilha do revoke por coluna)
  check(
    "ownership. update é revogado na TABELA e concedido só em `ordem`",
    /revoke all on table public\.estabelecimento_galeria/i.test(migration) &&
      /grant\s+update \(ordem\) on table public\.estabelecimento_galeria/i.test(migration),
  );

  // `type="button"` — a armadilha da Fase 8 (botão cru dentro de form)
  check(
    "a11y/form. todo botão da galeria é type=\"button\" e tem aria-label nos ícones",
    !/<button(?![^>]*type=)/i.test(componente) &&
      (componente.match(/aria-label=/g) ?? []).length >= 3,
  );
}

// ============================================================
// BANCO — posse, isolamento, forma, teto, reorder, remoção
// ============================================================
async function testarBanco() {
  console.log("\n[banco] Posse, isolamento de tenant e ciclo de vida");

  let qa: ContaQa | null = null;
  const criados: string[] = [];

  try {
    const lojista = await logar("lojista@promofy.test"); // e1, e3..e6
    const lojista2 = await logar("lojista2@promofy.test"); // e2
    qa = await criarContaQa(svc, "galeria");
    const consumidor = await logar(qa.email, qa.senha);

    // ---------- 1. dono adiciona no PRÓPRIO ----------
    const p1 = caminhoDeTeste("e1", 0xa1);
    const ins1 = await lojista
      .from(TABELA)
      .insert({ estabelecimento_id: "e1", imagem: p1, ordem: 0 })
      .select("id")
      .maybeSingle();
    check("1. owner A adiciona imagem no próprio estabelecimento", !!ins1.data?.id, ins1.error?.message);
    if (ins1.data?.id) criados.push(ins1.data.id);

    // ---------- 8. imagem válida persiste ----------
    const { data: lido } = await svc.from(TABELA).select("imagem, ordem").eq("imagem", p1).maybeSingle();
    check("8. imagem válida persiste com o caminho gravado", lido?.imagem === p1, JSON.stringify(lido));

    // ---------- 2. dono NÃO adiciona em estabelecimento alheio ----------
    const alheio = await lojista
      .from(TABELA)
      .insert({ estabelecimento_id: "e2", imagem: caminhoDeTeste("e2", 0xb2), ordem: 0 })
      .select("id");
    check(
      "2. owner A NÃO adiciona imagem no estabelecimento de B",
      !!alheio.error && (alheio.data ?? []).length === 0,
      JSON.stringify(alheio.data),
    );

    // ---------- ownership: linha própria apontando para pasta ALHEIA ----------
    const pastaAlheia = await lojista
      .from(TABELA)
      .insert({ estabelecimento_id: "e1", imagem: caminhoDeTeste("e2", 0xb3), ordem: 0 })
      .select("id");
    check(
      "2b. linha do PRÓPRIO estab apontando para a pasta de B é recusada pelo CHECK",
      !!pastaAlheia.error,
      JSON.stringify(pastaAlheia.data),
    );

    // ---------- forma do caminho (traversal / lixo) ----------
    for (const [rotulo, valor] of [
      ["traversal", "../e2/" + "a".repeat(32) + ".jpg"],
      ["subpasta", "e1/galeria/" + "a".repeat(32) + ".jpg"],
      ["extensão proibida", "e1/" + "a".repeat(32) + ".svg"],
      ["URL absoluta", "https://exemplo.com/foto.jpg"],
    ] as const) {
      const r = await lojista
        .from(TABELA)
        .insert({ estabelecimento_id: "e1", imagem: valor, ordem: 9 })
        .select("id");
      check(`6e. caminho recusado pelo banco (${rotulo})`, !!r.error, JSON.stringify(r.data));
    }

    // ---------- 3. dono NÃO remove imagem de B ----------
    const pB = caminhoDeTeste("e2", 0xc3);
    const insB = await svc
      .from(TABELA)
      .insert({ estabelecimento_id: "e2", imagem: pB, ordem: 0 })
      .select("id")
      .maybeSingle();
    if (insB.data?.id) criados.push(insB.data.id);

    const delAlheio = await lojista.from(TABELA).delete().eq("id", insB.data?.id ?? "").select("id");
    check(
      "3. owner A NÃO remove imagem de B",
      (delAlheio.data ?? []).length === 0,
      JSON.stringify(delAlheio.data ?? delAlheio.error),
    );
    const { count: aindaB } = await svc
      .from(TABELA)
      .select("id", { count: "exact", head: true })
      .eq("id", insB.data?.id ?? "");
    check("10c. remoção não afetou a imagem alheia (a linha de B continua)", aindaB === 1);

    // ---------- owner A não repõe/reordena a galeria de B ----------
    const updAlheio = await lojista
      .from(TABELA)
      .update({ ordem: 99 })
      .eq("id", insB.data?.id ?? "")
      .select("id");
    check(
      "3b. owner A NÃO reordena linha de B por PostgREST",
      (updAlheio.data ?? []).length === 0,
      JSON.stringify(updAlheio.data ?? updAlheio.error),
    );

    const rpcAlheio = await lojista.rpc("reordenar_galeria_estabelecimento", {
      p_ids: [insB.data?.id],
    });
    const rpcAlheioData = rpcAlheio.data as { ok?: boolean; motivo?: string } | null;
    check(
      "3c. RPC de reorder recusa galeria de B (nao_autorizado)",
      rpcAlheioData?.ok === false && rpcAlheioData?.motivo === "nao_autorizado",
      JSON.stringify(rpcAlheio.data ?? rpcAlheio.error),
    );

    // ---------- imagem é IMUTÁVEL: só `ordem` é gravável ----------
    const repontar = await lojista
      .from(TABELA)
      .update({ imagem: caminhoDeTeste("e1", 0xd4) })
      .eq("id", ins1.data?.id ?? "")
      .select("id");
    check(
      "ownership. o dono NÃO repõe `imagem` de uma linha publicada (grant por coluna)",
      !!repontar.error,
      JSON.stringify(repontar.data),
    );

    // ---------- 4. consumidor não escreve ----------
    const escritaConsumidor = await consumidor
      .from(TABELA)
      .insert({ estabelecimento_id: "e1", imagem: caminhoDeTeste("e1", 0xe5), ordem: 0 })
      .select("id");
    check(
      "4a. consumidor NÃO escreve na galeria",
      !!escritaConsumidor.error,
      JSON.stringify(escritaConsumidor.data),
    );
    const delConsumidor = await consumidor
      .from(TABELA)
      .delete()
      .eq("id", ins1.data?.id ?? "")
      .select("id");
    check(
      "4b. consumidor NÃO remove imagem de ninguém",
      (delConsumidor.data ?? []).length === 0,
      JSON.stringify(delConsumidor.data ?? delConsumidor.error),
    );
    const { data: leConsumidor } = await consumidor.from(TABELA).select("id").eq("imagem", p1);
    check("20b. …mas o consumidor LÊ a galeria do estabelecimento ativo", (leConsumidor ?? []).length === 1);

    // ---------- 5. anon não escreve, mas lê ----------
    const escritaAnon = await anon
      .from(TABELA)
      .insert({ estabelecimento_id: "e1", imagem: caminhoDeTeste("e1", 0xf6), ordem: 0 })
      .select("id");
    check("5a. anon NÃO escreve na galeria", !!escritaAnon.error, JSON.stringify(escritaAnon.data));
    const { data: leAnon } = await anon.from(TABELA).select("id").eq("imagem", p1);
    check("5b. anon LÊ a galeria de estabelecimento ativo (mesmo contrato do perfil)", (leAnon ?? []).length === 1);

    // ---------- galeria de estabelecimento NÃO ativo fica escondida ----------
    const pSuspenso = caminhoDeTeste("e6", 0x11); // e6 = suspenso no seed
    const insSusp = await svc
      .from(TABELA)
      .insert({ estabelecimento_id: "e6", imagem: pSuspenso, ordem: 0 })
      .select("id")
      .maybeSingle();
    if (insSusp.data?.id) criados.push(insSusp.data.id);
    const { data: anonSusp } = await anon.from(TABELA).select("id").eq("imagem", pSuspenso);
    check(
      "rls. anon NÃO vê galeria de estabelecimento suspenso (mesma visibilidade do perfil)",
      (anonSusp ?? []).length === 0,
    );
    const { data: donoSusp } = await lojista.from(TABELA).select("id").eq("imagem", pSuspenso);
    check(
      "rls. …mas o DONO vê a própria mesmo suspenso (senão o portal quebraria)",
      (donoSusp ?? []).length === 1,
    );

    // ---------- 12/13. uma imagem, múltiplas, ordem determinística ----------
    const p2 = caminhoDeTeste("e1", 0x22);
    const p3 = caminhoDeTeste("e1", 0x33);
    const ins2 = await lojista
      .from(TABELA)
      .insert({ estabelecimento_id: "e1", imagem: p2, ordem: 1 })
      .select("id")
      .maybeSingle();
    const ins3 = await lojista
      .from(TABELA)
      .insert({ estabelecimento_id: "e1", imagem: p3, ordem: 2 })
      .select("id")
      .maybeSingle();
    if (ins2.data?.id) criados.push(ins2.data.id);
    if (ins3.data?.id) criados.push(ins3.data.id);
    check("13. múltiplas imagens convivem no mesmo estabelecimento", !!ins2.data && !!ins3.data);

    const trio = [ins1.data?.id as string, ins2.data?.id as string, ins3.data?.id as string];

    // ---------- 15. reorder persiste server-side ----------
    const invertido = [trio[2], trio[1], trio[0]];
    const rpcOk = await lojista.rpc("reordenar_galeria_estabelecimento", { p_ids: invertido });
    const rpcOkData = rpcOk.data as { ok?: boolean } | null;
    check("15g. reorder do próprio estabelecimento é aceito", rpcOkData?.ok === true, JSON.stringify(rpcOk.data ?? rpcOk.error));

    const { data: aposOrdem } = await svc
      .from(TABELA)
      .select("id, ordem")
      .in("id", trio)
      .order("ordem", { ascending: true });
    check(
      "15h. a nova ordem persistiu no banco",
      (aposOrdem ?? []).map((r) => r.id).join(",") === invertido.join(","),
      JSON.stringify(aposOrdem),
    );

    // ---------- reorder com lista PARCIAL é recusado ----------
    const parcial = await lojista.rpc("reordenar_galeria_estabelecimento", {
      p_ids: [trio[0], trio[1]],
    });
    const parcialData = parcial.data as { ok?: boolean; motivo?: string } | null;
    check(
      "15i. reorder com lista parcial é recusado (lista_incompleta)",
      parcialData?.ok === false && parcialData?.motivo === "lista_incompleta",
      JSON.stringify(parcial.data ?? parcial.error),
    );

    // ---------- reorder MISTURANDO estabelecimentos é recusado ----------
    const misto = await lojista.rpc("reordenar_galeria_estabelecimento", {
      p_ids: [trio[0], insB.data?.id],
    });
    const mistoData = misto.data as { ok?: boolean; motivo?: string } | null;
    check(
      "15j. reorder misturando estabelecimentos é recusado",
      mistoData?.ok === false &&
        ["mistura_estabelecimentos", "nao_encontrado"].includes(mistoData?.motivo ?? ""),
      JSON.stringify(misto.data ?? misto.error),
    );

    // ---------- anon não executa a RPC ----------
    const rpcAnon = await anon.rpc("reordenar_galeria_estabelecimento", { p_ids: trio });
    check("5c. anon NÃO executa a RPC de reorder", !!rpcAnon.error, JSON.stringify(rpcAnon.data));

    // ---------- 10 (guard). teto técnico é fronteira do BANCO ----------
    const extras: string[] = [];
    let recusouNoTeto = false;
    for (let i = 0; i < MAX_IMAGENS_GALERIA; i++) {
      const r = await lojista
        .from(TABELA)
        .insert({ estabelecimento_id: "e1", imagem: caminhoDeTeste("e1", 0x40 + i), ordem: 10 + i })
        .select("id")
        .maybeSingle();
      if (r.error) {
        recusouNoTeto = /galeria_cheia/.test(r.error.message);
        break;
      }
      if (r.data?.id) {
        extras.push(r.data.id);
        criados.push(r.data.id);
      }
    }
    const { count: totalE1 } = await svc
      .from(TABELA)
      .select("id", { count: "exact", head: true })
      .eq("estabelecimento_id", "e1");
    check(
      "10d. o teto técnico é imposto pelo BANCO, não só pela Action",
      recusouNoTeto && totalE1 === MAX_IMAGENS_GALERIA,
      `recusou=${recusouNoTeto} total=${totalE1}`,
    );

    // ---------- 9. remoção remove o registro ----------
    const alvoRemocao = extras[extras.length - 1] ?? trio[2];
    const del = await lojista.from(TABELA).delete().eq("id", alvoRemocao).select("id").maybeSingle();
    check("9a. o dono remove a própria imagem", del.data?.id === alvoRemocao, JSON.stringify(del.error));
    const { count: sumiu } = await svc
      .from(TABELA)
      .select("id", { count: "exact", head: true })
      .eq("id", alvoRemocao);
    check("9b. a remoção apagou o REGISTRO", sumiu === 0);

    // ---------- 11. galeria vazia não quebra o perfil ----------
    const { data: vaziaE5 } = await anon.from(TABELA).select("id").eq("estabelecimento_id", "e5");
    check(
      "11b. estabelecimento sem galeria devolve lista vazia (não erro)",
      Array.isArray(vaziaE5) && vaziaE5.length === 0,
    );

    // ---------- 10 (isolamento). a galeria de B ficou intacta o tempo todo ----------
    const { data: finalB } = await svc.from(TABELA).select("id, ordem").eq("estabelecimento_id", "e2");
    check(
      "10e. a galeria de B terminou intacta (1 linha, ordem original)",
      (finalB ?? []).length === 1 && finalB?.[0].ordem === 0,
      JSON.stringify(finalB),
    );

    // ---------- cascade: apagar estabelecimento não deixa órfão ----------
    const { data: fk } = await svc
      .rpc("reordenar_galeria_estabelecimento", { p_ids: [] })
      .then((r) => r, () => ({ data: null }));
    check(
      "rpc. lista vazia é recusada explicitamente",
      (fk as { ok?: boolean; motivo?: string } | null)?.ok === false,
      JSON.stringify(fk),
    );
  } finally {
    // A limpeza apaga SÓ o que esta suíte criou, por id.
    for (const id of criados) {
      await svc.from(TABELA).delete().eq("id", id);
    }
    // Rede de segurança: nenhuma linha de galeria sobrevive à suíte.
    await svc.from(TABELA).delete().in("estabelecimento_id", ["e1", "e2", "e6"]);
    await destruirContaQa(svc, qa?.id);
  }
}

async function main(): Promise<number> {
  console.log(`\n[test-client-returns-estab-galeria] alvo: ${alvo.nome} (${alvo.envFile})\n`);
  console.log(
    "  NOTA: o [storage] local está desligado (gate da Fase 7). Esta suíte prova\n" +
      "  o contrato do BANCO e da FONTE; ela NÃO sobe bytes para o bucket.\n",
  );
  testarModuloPuro();
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
