/** SOMENTE LEITURA — baseline do hospedado antes de qualquer operação. */
import { config } from "dotenv";
config({ path: ".env.hosted.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  console.log(`ALVO: ${new URL(url).host}\n`);

  const conta = async (tabela: string, filtro?: [string, string]) => {
    let q = svc.from(tabela).select("*", { count: "exact", head: true });
    if (filtro) q = q.eq(filtro[0], filtro[1]);
    const { count, error } = await q;
    return error ? `ERRO(${error.message})` : String(count);
  };

  console.log("== CONTAGENS ==");
  for (const t of ["cupons", "estabelecimentos", "cupons_usuario", "pontos_transacoes", "favoritos", "novidades_visto", "cupom_eventos", "profiles"]) {
    console.log(`  ${t.padEnd(20)} ${await conta(t)}`);
  }

  console.log("\n== CUPONS POR STATUS ==");
  const { data: cs } = await svc.from("cupons").select("status");
  const porStatus: Record<string, number> = {};
  for (const r of cs ?? []) porStatus[r.status as string] = (porStatus[r.status as string] ?? 0) + 1;
  console.log(" ", JSON.stringify(porStatus));

  console.log("\n== ESTABELECIMENTOS POR STATUS ==");
  const { data: es } = await svc.from("estabelecimentos").select("id,status").order("id");
  console.log(" ", (es ?? []).map((e) => `${e.id}=${e.status}`).join(" "));

  console.log("\n== JANELAS RESTRITAS (candidatos do passo 2) ==");
  const { data: cup } = await svc.from("cupons").select("id,titulo,status,horarios").order("id");
  for (const c of cup ?? []) {
    const h = (c.horarios ?? {}) as Record<string, unknown>;
    const dias = Array.isArray(h.dias) ? (h.dias as string[]) : [];
    const temHora = typeof h.inicio === "string" && h.inicio !== "";
    if (dias.length > 0 || temHora) {
      console.log(`  ${c.id.padEnd(16)} [${c.status}] dias=${JSON.stringify(dias)} ${h.inicio ?? "-"}–${h.fim ?? "-"}  "${c.titulo}"`);
    }
  }

  console.log("\n== CONTAS DO CLIENTE (não tocar) ==");
  const { data: lista } = await svc.auth.admin.listUsers();
  for (const email of ["consumidor@promofy.test", "convidado@promofy.test"]) {
    const u = lista.users.find((x) => x.email === email);
    if (!u) { console.log(`  ${email}: NÃO ENCONTRADO`); continue; }
    const { data: pts } = await svc.from("pontos_transacoes").select("pontos").eq("usuario_id", u.id);
    const saldo = (pts ?? []).reduce((s, r) => s + (r.pontos as number), 0);
    const { data: cu } = await svc.from("cupons_usuario").select("cupom_id,status").eq("usuario_id", u.id);
    const { count: favs } = await svc.from("favoritos").select("*", { count: "exact", head: true }).eq("usuario_id", u.id);
    console.log(`  ${email.padEnd(26)} saldo=${saldo}  ciclo=${JSON.stringify((cu ?? []).map((x) => `${x.cupom_id}:${x.status}`))}  favoritos=${favs}`);
  }

  console.log("\n== FUNÇÕES DA FASE 5 JÁ EXISTEM? (esperado: NÃO) ==");
  const { error: eJanela } = await svc.rpc("dentro_da_janela", { p_horarios: {} });
  console.log("  dentro_da_janela:", eJanela ? `ausente (${eJanela.code ?? eJanela.message.slice(0, 40)})` : "JÁ EXISTE");
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
