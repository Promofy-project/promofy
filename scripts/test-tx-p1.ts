/**
 * TX-P1 — o frontend não pode quebrar quando uma categoria desconhecida
 * (fora das 6 do protótipo) aparece. Testa o MECANISMO CENTRAL que os 6
 * pontos de exibição (coupon-card, coupon-list-item, business-card,
 * coupon-portal-card, detalhe do cupom, mapper do admin) usam igual:
 * `resolverCategoriaVisual`. Não há harness de render de componente neste
 * repo (suítes são scripts, não Jest/Vitest) — testar o resolvedor cobre
 * exatamente o ponto onde os 6 lugares fariam `undefined.gradiente`/
 * `undefined.icon` antes desta mudança.
 *
 * `linhaParaCupom` (o mapper de `src/lib/data/cupons.ts` que CHAMA este
 * resolvedor para cada cupom vindo do banco) não é importado aqui de
 * propósito: o arquivo é `server-only` — como todo `src/lib/data/*.ts` deste
 * repo — e um script Node fora do runtime do Next explode ao importá-lo
 * (mesmo motivo pelo qual as outras suítes `test:fase*` só importam módulos
 * puros de `src/lib/*.ts`, nunca `src/lib/data/*.ts`). A garantia de que
 * `linhaParaCupom` nunca lança para uma categoria desconhecida vem de ele
 * chamar EXATAMENTE esta função, com o `try/catch` estático (ver leitura do
 * código) — o comportamento é o mesmo testado abaixo.
 */
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-tx-p1");

import { createClient } from "@supabase/supabase-js";
import {
  resolverCategoriaVisual,
  CATEGORIA_VISUAL_FALLBACK,
  type CategoriaVisual,
} from "../src/lib/categoria-visual";

let passed = 0,
  failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const CATALOGO_TESTE: CategoriaVisual[] = [
  { id: "alimentacao", label: "Alimentação", icon: "UtensilsCrossed", gradiente: "g1" },
  { id: "fitness", label: "Fitness", icon: "Dumbbell", gradiente: "g2" },
];

async function main() {
  console.log("\n=== TX-P1 — categoria desconhecida não quebra (mecanismo central) ===\n");

  // J — id fora do catálogo -> fallback, nunca undefined
  const desconhecida = resolverCategoriaVisual("categoria-nova-de-teste", CATALOGO_TESTE);
  check(
    "id desconhecido devolve o fallback (não undefined)",
    desconhecida === CATEGORIA_VISUAL_FALLBACK,
  );
  check(
    "fallback tem icon não-vazio",
    typeof desconhecida.icon === "string" && desconhecida.icon.length > 0,
  );
  check(
    "fallback tem gradiente não-vazio",
    typeof desconhecida.gradiente === "string" && desconhecida.gradiente.length > 0,
  );
  check(
    "fallback tem label não-vazio",
    typeof desconhecida.label === "string" && desconhecida.label.length > 0,
  );

  // id conhecido -> objeto real do catálogo, não o fallback
  const conhecida = resolverCategoriaVisual("fitness", CATALOGO_TESTE);
  check(
    "id conhecido devolve o item real do catalogo",
    conhecida.id === "fitness" && conhecida.label === "Fitness",
  );

  // catálogo vazio (banco fora do ar) -> ainda assim fallback, nunca throw
  const semCatalogo = resolverCategoriaVisual("qualquer", []);
  check("catalogo vazio devolve o fallback (não lança)", semCatalogo === CATEGORIA_VISUAL_FALLBACK);

  // Nenhuma exceção lançada em NENHUM dos casos acima — os 6 pontos de
  // exibição (coupon-card, coupon-list-item, business-card,
  // coupon-portal-card, detalhe do cupom via /m/cupom/[id], mapper do admin
  // via cupons-client/estab-client) resolvem `categoriaVisual` chamando
  // exatamente esta função (ou lendo o campo que ela populou em
  // `linhaParaCupom`) — nenhum deles faz `.gradiente`/`.icon` num objeto que
  // pode ser undefined.
  check(
    "resolverCategoriaVisual nunca retorna undefined (sempre CategoriaVisual)",
    [desconhecida, conhecida, semCatalogo].every((c) => c !== undefined && c !== null),
  );

  console.log("\n=== TX-P1 — catalogo real (banco local) ===\n");
  const svc = createClient(alvo.url, alvo.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: cats, error } = await svc
    .from("categorias")
    .select("id, label, icon, gradiente, ordem")
    .order("ordem");
  check("catalogo real: consulta sem erro", !error, error?.message);
  check(
    "catalogo real: 6 categorias atuais (seed)",
    (cats ?? []).length === 6,
    `veio ${(cats ?? []).length}`,
  );
  const semIconOuGradiente = (cats ?? []).find((c) => !c.icon || !c.gradiente);
  check(
    "catalogo real: todas as linhas tem icon e gradiente",
    !semIconOuGradiente,
    JSON.stringify(semIconOuGradiente),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
