/** Conferência do projeto de QA — sem imprimir nenhum segredo. */
import { resolverAlvo } from "./_alvo";
import { createClient } from "@supabase/supabase-js";

const REF_PRODUCAO = "bpeqpxvxgdyjjdcoycgp";

async function main() {
  const alvo = resolverAlvo("qa-check");
  const ref = new URL(alvo.url).host.split(".")[0];

  let ok = true;
  const diz = (nome: string, bom: boolean, detalhe = "") => {
    if (!bom) ok = false;
    console.log(`  ${bom ? "OK  " : "FALHA"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  };

  console.log("[1] Identidade");
  diz("é o alvo de QA", alvo.nome === "qa", alvo.nome);
  diz("NÃO é a produção do cliente", ref !== REF_PRODUCAO, `ref=${ref}`);

  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\n[2] Schema (21 migrations)");
  const { count: nCupons } = await svc.from("cupons").select("*", { count: "exact", head: true });
  const { count: nEst } = await svc.from("estabelecimentos").select("*", { count: "exact", head: true });
  diz("tabela cupons existe e tem seed", (nCupons ?? 0) > 0, `${nCupons} cupons`);
  diz("tabela estabelecimentos existe e tem seed", (nEst ?? 0) > 0, `${nEst} estabelecimentos`);

  // A coluna da 6.5 precisa existir — a migration 22 depende do trigger dela.
  const { error: eHist } = await svc.from("cupons").select("moderacao_historico").limit(1);
  diz("coluna moderacao_historico (migration 20)", !eHist, eHist?.message);

  console.log("\n[3] Donos (as policies do bucket dependem disto)");
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 100 });
  const uid = (e: string) => users.users.find((u) => u.email === e)?.id ?? null;
  const lojista = uid("lojista@promofy.test");
  const lojista2 = uid("lojista2@promofy.test");
  diz("lojista@ e lojista2@ existem", Boolean(lojista && lojista2));

  const { data: ests } = await svc
    .from("estabelecimentos")
    .select("id, owner_id")
    .in("id", ["e1", "e2"]);
  const e1 = ests?.find((e) => e.id === "e1");
  const e2 = ests?.find((e) => e.id === "e2");
  diz("e1 pertence ao lojista@", e1?.owner_id === lojista);
  diz("e2 pertence ao lojista2@", e2?.owner_id === lojista2);

  console.log("\n[4] Storage — a razão deste projeto existir");
  const { data: buckets, error: eBuckets } = await svc.storage.listBuckets();
  diz("API de Storage responde", !eBuckets, eBuckets?.message);
  diz(
    "bucket cupom-imagens ainda NÃO existe (vem da migration 22)",
    !eBuckets && !(buckets ?? []).some((b) => b.name === "cupom-imagens"),
    `${(buckets ?? []).length} bucket(s)`,
  );

  console.log(`\n${ok ? "Tudo pronto para a migration 22." : "Há falhas acima."}\n`);
  return ok ? 0 : 1;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
