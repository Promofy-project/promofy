/**
 * TX-P2D1 — depois da migration 20260830140000, o conjunto de cupons tem
 * de convergir para EXATAMENTE os 14 canônicos do de-para. Local nunca
 * teve os 20 extras (a migration é NO-OP aqui — eles só existem no
 * hospedado, ver MIGRATIONS.md), então este teste prova o estado
 * CONVERGIDO: os 20 IDs de remoção não existem, os 14 canônicos existem,
 * e nada de estrutural (taxonomia 14×75, legado de categorias) foi
 * tocado por uma migration que é DATA cleanup, não DDL.
 *
 * Fonte dos 14 canônicos é docs/taxonomia/depara-v1.json — não duplica
 * a lista aqui. Os 20 IDs de remoção SÃO duplicados, deliberadamente:
 * é o contrato pequeno e destrutivo da própria migration, do mesmo jeito
 * que os mapas congelados de test-tx-p2c.ts existem para pegar uma
 * migration que remova o item errado.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-tx-p2d1");

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

interface CupomDepara {
  id: string;
}
interface DeparaJson {
  cupons: CupomDepara[];
}

/** Os 20 extras que a migration 20260830140000 remove — mesma lista, contrato fechado. */
const IDS_EXTRAS_REMOVIDOS = [
  "d768d289-431b-498e-aa0d-a0d1cbf51b77",
  "ae1fa920-d094-430f-8739-5f56daef8d0b",
  "093cb015-a11d-4703-808b-e26fb090df02",
  "40b297aa-1484-46c6-a985-cdfc4b220929",
  "c2ff55a5-d082-445c-b728-ed446e57f9c1",
  "69dfb026-8bdc-422d-8b94-24d249a9c229",
  "271a9a69-b45f-458f-99f5-4daf2ca50d2d",
  "b24a3ea5-44df-44a9-8908-4da29c102fe2",
  "6dbbde09-2da5-4f80-9fca-61badd527cb0",
  "74648f5e-d7a5-4168-bc5b-73c51842051c",
  "2a0904ff-e286-4720-ac2d-90c60a2b3b66",
  "4fa3788f-7005-4d6e-9826-e9ab7ca7558c",
  "03c532b4-33da-439c-a3a1-5dddd2be5adf",
  "84e451a7-7cef-485d-9f66-6ccb8760b1b6",
  "639e1187-3373-42a4-b1ca-0cc3b80f2b08",
  "20e8434f-92bb-4224-a68d-d4cd4be9141b",
  "46c59d64-8106-4307-8b19-c87761c2a9c8",
  "c364f7dc-a296-49d2-8840-0c092e8ab936",
  "b96b6c01-82f7-47d0-acd0-b9ba547576bd",
  "57d1127f-b803-4ec8-b972-12aed17fad03",
] as const;

const MIGRATION_P2D1 = "20260830140000_tx_p2d1_cleanup_cupons_extras.sql";
const MIGRATIONS_HOSPEDADAS_ANTERIORES = [
  "20260829120000_tx_p2a_fronteira_taxonomia.sql",
  "20260830120000_tx_p2b_taxonomia_schema_staging.sql",
  "20260830130000_tx_p2c_taxonomia_catalogo.sql",
] as const;

function carregarJson<T>(caminho: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), caminho), "utf8")) as T;
}

async function main(): Promise<number> {
  const depara = carregarJson<DeparaJson>("docs/taxonomia/depara-v1.json");
  const idsCanonicos = depara.cupons.map((c) => c.id);

  console.log("\n=== TX-P2D1/A — migration versionada, posterior às hospedadas ===\n");

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const arquivos = fs.readdirSync(migrationsDir);
  check("1. migration 20260830140000 existe no repo", arquivos.includes(MIGRATION_P2D1));

  const timestampP2D1 = MIGRATION_P2D1.split("_")[0];
  for (const hospedada of MIGRATIONS_HOSPEDADAS_ANTERIORES) {
    const ts = hospedada.split("_")[0];
    check(
      `2. ${timestampP2D1} é posterior a ${ts} (hospedada, imutável)`,
      timestampP2D1 > ts,
      `${timestampP2D1} vs ${ts}`,
    );
  }

  console.log("\n=== TX-P2D1/B — depara-v1.json continua com exatamente os 14 canônicos ===\n");

  check("3. depara-v1.json tem exatamente 14 cupons", idsCanonicos.length === 14, String(idsCanonicos.length));
  check("4. nenhum dos 14 canônicos coincide com um dos 20 removidos", idsCanonicos.every((id) => !(IDS_EXTRAS_REMOVIDOS as readonly string[]).includes(id)));

  console.log("\n=== TX-P2D1/C — banco local: conjunto convergido ===\n");

  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dbCupons = await svc.from("cupons").select("id, estabelecimento_id, categoria_id");
  check("5. select em cupons funcionou", !dbCupons.error, dbCupons.error?.message);

  const idsNoBanco = (dbCupons.data ?? []).map((c) => c.id as string);

  const extrasPresentes = IDS_EXTRAS_REMOVIDOS.filter((id) => idsNoBanco.includes(id));
  check("6. nenhum dos 20 extras existe no banco", extrasPresentes.length === 0, JSON.stringify(extrasPresentes));

  const canonicosAusentes = idsCanonicos.filter((id) => !idsNoBanco.includes(id));
  check("7. todos os 14 canônicos existem no banco", canonicosAusentes.length === 0, JSON.stringify(canonicosAusentes));

  check(
    "8. o conjunto de cupons do banco é EXATAMENTE os 14 canônicos (nem a mais, nem a menos)",
    idsNoBanco.length === 14 && JSON.stringify([...idsNoBanco].sort()) === JSON.stringify([...idsCanonicos].sort()),
    `banco tem ${idsNoBanco.length}: ${idsNoBanco.join(",")}`,
  );

  const dbEventos = await svc.from("cupom_eventos").select("cupom_id").in("cupom_id", Array.from(IDS_EXTRAS_REMOVIDOS));
  check("9. zero cupom_eventos apontando para algum dos 20 removidos", (dbEventos.data ?? []).length === 0, String(dbEventos.data?.length));

  const dbUsuario = await svc.from("cupons_usuario").select("cupom_id").in("cupom_id", Array.from(IDS_EXTRAS_REMOVIDOS));
  check("10. zero cupons_usuario apontando para algum dos 20 removidos", (dbUsuario.data ?? []).length === 0, String(dbUsuario.data?.length));

  // TX-P2D1B: o ledger de pontos derivado dos cupons_usuario dos extras
  // (17 resgate + 9 nps = 26 no hospedado auditado) também é removido pela
  // migration. Localmente os 20 extras nunca existem fora de uma simulação
  // (NO-OP no db:reset), então não há bigint de cupons_usuario hospedado
  // para hardcodar — a prova estrutural aqui é: NENHUM pontos_transacoes
  // no banco local aponta (via referencia_id = cupons_usuario.id::text)
  // para um cupons_usuario ligado a qualquer um dos 20 removidos. Como
  // esses cupons_usuario não existem localmente, isto é necessariamente
  // verdade — mas o teste prova a AUSÊNCIA de resíduo, não apenas assume.
  const dbCuTodos = await svc.from("cupons_usuario").select("id, cupom_id");
  const idsCuDosExtras = new Set(
    (dbCuTodos.data ?? [])
      .filter((r) => (IDS_EXTRAS_REMOVIDOS as readonly string[]).includes(r.cupom_id as string))
      .map((r) => String(r.id)),
  );
  check(
    "10b. zero cupons_usuario no banco está ligado a algum dos 20 removidos (pré-condição do ledger)",
    idsCuDosExtras.size === 0,
    JSON.stringify(Array.from(idsCuDosExtras)),
  );

  const dbPontos = await svc.from("pontos_transacoes").select("referencia_id").not("referencia_id", "is", null);
  const pontosOrfaos = (dbPontos.data ?? []).filter((p) => idsCuDosExtras.has(String(p.referencia_id)));
  check(
    "10c. zero pontos_transacoes no banco referencia um cupons_usuario ligado aos 20 removidos",
    pontosOrfaos.length === 0,
    JSON.stringify(pontosOrfaos),
  );

  console.log("\n=== TX-P2D1/D — nenhuma alteração estrutural (é DATA cleanup, não DDL) ===\n");

  const seg = await svc.from("segmentos").select("id", { count: "exact", head: true });
  check("11. segmentos continua 14", seg.count === 14, String(seg.count));

  const catNovas = await svc.from("categorias_novas").select("id", { count: "exact", head: true });
  check("12. categorias_novas continua 75", catNovas.count === 75, String(catNovas.count));

  const catLegado = await svc.from("categorias").select("id", { count: "exact", head: true });
  check("13. categorias legado continua 6", catLegado.count === 6, String(catLegado.count));

  const estab = await svc.from("estabelecimentos").select("id", { count: "exact", head: true });
  check("14. estabelecimentos continua 6 (nenhuma conta/estabelecimento tocado)", estab.count === 6, String(estab.count));

  const estabCat = await svc.from("estabelecimento_categorias").select("estabelecimento_id", { count: "exact", head: true });
  check("15. estabelecimento_categorias continua 7", estabCat.count === 7, String(estabCat.count));

  console.log(`\nResultado: ${passed} PASS, ${failed} FAIL\n`);
  return failed > 0 ? 1 : 0;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error("FALHOU:", e.message);
    process.exitCode = 1;
  });
