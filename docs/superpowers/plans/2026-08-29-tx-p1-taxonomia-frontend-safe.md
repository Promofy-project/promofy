# TX-P1 — Desacoplar o frontend da taxonomia fechada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a dependência operacional de `CategoriaId` (união fechada de 6 ids) e de `getCategoria`/`categoriaMap` (catálogo estático de `mock-data.ts`), substituindo por um catálogo REAL vindo de `public.categorias` (já com `icon`/`gradiente`/`ordem`) resolvido com fallback tolerante, sem quebrar nenhuma tela quando uma categoria desconhecida aparecer.

**Architecture:** Um módulo puro novo (`src/lib/categoria-visual.ts`) define `CategoriaVisual` e `resolverCategoriaVisual(id, catalogo)` — lookup tolerante, sem `Intl`, sem DOM, importável por caminho relativo (RN-safe). `src/lib/data/categorias.ts` passa a expor `buscarCategorias()` retornando o catálogo completo (`id,label,icon,gradiente`, 1 query/página). Os pontos que hoje montam objetos `Cupom` a partir do banco (`linhaParaCupom` em `src/lib/data/cupons.ts`) passam a anexar `categoriaVisual` já resolvido — os componentes de UI (`CouponCard`, `CouponListItem`, `CouponPortalCard`) deixam de importar `getCategoria` e passam a ler `cupom.categoriaVisual`, sem precisar de prop nova em nenhuma tela intermediária. Telas client que hoje fazem o lookup na mão (admin `cupons-client`/`estab-client`, o form do portal) recebem o catálogo como prop nova, buscada 1x pelo server component pai. `mock-data.ts` deixa de ser fonte de taxonomia operacional: perde `getCategoria`/`categoriaMap`, mas continua existindo para as superfícies genuinamente demo (landing, app-mockup) — que passam a carregar `categoriaVisual` já denormalizado nos próprios objetos mock.

**Tech Stack:** Next.js App Router (Server Components + Client Components), Supabase (PostgREST), TypeScript. Sem migration, sem mudança de contrato de banco.

**Spec:** Prompt do usuário "TX-P0I + TX-P1" (não há arquivo de spec separado — o pedido completo está na conversa; este plano é a tradução dele em tarefas).

## Global Constraints

- NÃO criar migration/view/RPC/trigger/coluna nova. NÃO rodar `db push`. NÃO tocar hospedado/QA.
- `CategoriaId` sai da união fechada e vira alias de `string` (compat) ou é removido dos lugares que a usam como tipo de domínio — modelo runtime = `string`.
- Nenhum componente pode desreferenciar undefined para uma categoria desconhecida — sempre fallback (`label: "Categoria"`, `icon: "Ticket"`, `gradiente` cinza neutro).
- Módulos puros (`src/lib/*.ts` sem `server-only`) continuam sem `Intl`, sem API de DOM/navegador, importados por caminho relativo entre si.
- `?cat=` continua saneado por `categoriaValida` — nunca vira predicado direto de query.
- Categorias permitidas a um estabelecimento continuam vindo de `estabelecimento_categorias` — o catálogo visual é só rótulo/ícone/gradiente, nunca substitui essa autorização.
- 1 catálogo por request/página — nenhuma lista faz 1 query de categoria por item.
- `mock-data.ts` não é apagado; perde apenas o papel de fonte de taxonomia operacional.

---

## Arquivos

- Create: `src/lib/categoria-visual.ts` — módulo puro: `CategoriaVisual`, `CATEGORIA_VISUAL_FALLBACK`, `resolverCategoriaVisual`.
- Modify: `src/lib/types.ts` — `CategoriaId` vira `string`; `Categoria` (interface antiga) sai; `Cupom`/`Estabelecimento` ganham `categoriaVisual?: CategoriaVisual`.
- Modify: `src/lib/data/categorias.ts` — `buscarCategorias()` retorna `CategoriaVisual[]` (select ampliado).
- Modify: `src/lib/data/cupons.ts` — `linhaParaCupom` recebe catálogo e popula `categoriaVisual`; todas as funções exportadas passam a buscar o catálogo 1x e repassar.
- Modify: `src/lib/data/admin.ts` — nenhuma mudança de tipo (já é string), mas ver Tarefa 6 para threading do catálogo nas telas client.
- Modify: `src/lib/mock-data.ts` — remove `getCategoria`/`categoriaMap`; `cupons`/`estabelecimentos` ganham `categoriaVisual` denormalizado na própria definição.
- Modify: `src/components/coupon-card.tsx`, `coupon-list-item.tsx`, `business-card.tsx`, `src/components/portal/coupon-portal-card.tsx` — trocam `getCategoria(x)` por `x.categoriaVisual ?? CATEGORIA_VISUAL_FALLBACK`.
- Modify: `src/app/m/cupom/[id]/page.tsx` — busca catálogo + `resolverCategoriaVisual` (cupom pode vir do mock OU do banco).
- Modify: `src/app/admin/(painel)/cupons/page.tsx` + `cupons-client.tsx` — thread do catálogo como prop nova.
- Modify: `src/app/admin/(painel)/estabelecimentos/page.tsx` + `estab-client.tsx` — thread do catálogo; `CategoriasModal` passa a listar o catálogo REAL, não `todasCategorias` do mock.
- Modify: `src/app/portal/(painel)/cupons/page.tsx` + `cupons-client.tsx` + `src/components/portal/novo-cupom-form.tsx` — thread do catálogo até o preview (`CouponCard`).
- Modify: `src/components/app-mockup.tsx` — lê `t.categoriaVisual` em vez de `getCategoria`.
- Modify: `src/app/m/estabelecimentos/page.tsx`, `src/components/category-chips.tsx`, `src/app/portal/(painel)/estabelecimento/page.tsx` — remover import de `CategoriaId`/ajustar para `string`; mantidos como superfícies mock/demo isoladas (documentado inline).
- Create: `scripts/test-tx-p1.ts` — Testes J e K do WP (mecanismo tolerante + catálogo real).
- Modify: `package.json` — novo script `test:tx-p1`.
- Modify: `MIGRATIONS.md` — NÃO aplicável (sem migration); nada a fazer aqui.

## Interfaces

```ts
// src/lib/categoria-visual.ts
export interface CategoriaVisual {
  id: string;
  label: string;
  icon: string;
  gradiente: string;
}
export const CATEGORIA_VISUAL_FALLBACK: CategoriaVisual;
export function resolverCategoriaVisual(
  id: string,
  catalogo: readonly CategoriaVisual[],
): CategoriaVisual;
```

```ts
// src/lib/data/categorias.ts
export interface CategoriaFiltro { id: string; label: string } // mantido, compatível (subset)
export async function buscarCategorias(): Promise<CategoriaVisual[]>; // era CategoriaFiltro[]
export function categoriaValida(cat, categorias: { id: string }[]): string | undefined; // inalterado
```

```ts
// src/lib/data/cupons.ts
export function linhaParaCupom(
  row: CupomRow,
  estabelecimentoNome: string,
  catalogo: readonly CategoriaVisual[],
): Cupom; // NOVO 3º parâmetro
```

---

### Task 1: Módulo puro `categoria-visual.ts` + ajuste de `types.ts`

**Files:**
- Create: `src/lib/categoria-visual.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `CategoriaVisual`, `CATEGORIA_VISUAL_FALLBACK`, `resolverCategoriaVisual(id, catalogo)` — usados por TODAS as tarefas seguintes.

- [ ] **Step 1:** Criar `src/lib/categoria-visual.ts`:

```ts
/**
 * Visual de categoria (ícone + gradiente) sourced do catálogo real
 * (public.categorias). Módulo puro — sem `server-only`, sem `Intl`, sem
 * DOM: importável tanto pelo Next quanto por um futuro app RN.
 */
export interface CategoriaVisual {
  id: string;
  label: string;
  /** lucide-react icon name, mapeado a um componente na UI layer. */
  icon: string;
  /** CSS gradient usado em placeholders + avatares de categoria. */
  gradiente: string;
}

/**
 * Fallback de TOLERÂNCIA VISUAL — nunca de negócio. Aparece quando um id de
 * categoria não está (ainda) no catálogo carregado: dado em transição,
 * categoria nova, ou erro de leitura. Nunca vira opção de cadastro.
 */
export const CATEGORIA_VISUAL_FALLBACK: CategoriaVisual = {
  id: "",
  label: "Categoria",
  icon: "Ticket",
  gradiente: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)",
};

/** Lookup tolerante: id fora do catálogo → fallback, nunca undefined/throw. */
export function resolverCategoriaVisual(
  id: string,
  catalogo: readonly CategoriaVisual[],
): CategoriaVisual {
  return catalogo.find((c) => c.id === id) ?? CATEGORIA_VISUAL_FALLBACK;
}
```

- [ ] **Step 2:** Em `src/lib/types.ts`:
  - Remover o `type CategoriaId = "alimentacao" | ... | "pet"` fechado e substituir por `export type CategoriaId = string;` (mantém o nome para minimizar diffs nos imports existentes que ainda não foram limpos nesta mesma tarefa — tarefas seguintes removem os imports um a um; ao final do WP, se nenhum import sobrar, este alias pode ser removido também — decisão na Tarefa 9/auditoria).
  - Remover a interface `Categoria` (era `{id: CategoriaId; label; icon; gradiente}` — substituída por `CategoriaVisual`).
  - Em `Cupom` e `Estabelecimento`, adicionar campo opcional:
    ```ts
    import type { CategoriaVisual } from "@/lib/categoria-visual";
    // ...
    categoriaVisual?: CategoriaVisual;
    ```
  - Manter `categoria: CategoriaId` (agora = `string`) como está.

- [ ] **Step 3:** Rodar `npx tsc --noEmit` e confirmar que os erros restantes são SÓ os arquivos que ainda importam `Categoria` de `types.ts` ou `getCategoria`/`categoriaMap` de `mock-data.ts` (serão corrigidos nas tarefas seguintes). Anotar a lista de erros para conferência no final.

- [ ] **Step 4:** Commit local:

```bash
git add src/lib/categoria-visual.ts src/lib/types.ts
git commit -m "refactor(taxonomia): CategoriaId vira string; adiciona CategoriaVisual com fallback tolerante"
```

---

### Task 2: `src/lib/data/categorias.ts` — catálogo completo

**Files:**
- Modify: `src/lib/data/categorias.ts`

**Interfaces:**
- Consumes: `CategoriaVisual` (Task 1).
- Produces: `buscarCategorias(): Promise<CategoriaVisual[]>` — consumido por Tasks 3, 4, 5, 6, 7.

- [ ] **Step 1:** Trocar o select de `buscarCategorias` de `"id, label"` para `"id, label, icon, gradiente"` (mantém `order("ordem")`), e o retorno de `CategoriaFiltro[]` para `CategoriaVisual[]`:

```ts
import type { CategoriaVisual } from "@/lib/categoria-visual";

export interface CategoriaFiltro {
  id: string;
  label: string;
}

export async function buscarCategorias(): Promise<CategoriaVisual[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("id, label, icon, gradiente")
    .order("ordem", { ascending: true });
  if (error) return [];
  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    gradiente: c.gradiente,
  }));
}
```

  `categoriaValida` fica intocada (continua aceitando qualquer `{id: string}[]`).

- [ ] **Step 2:** Rodar `npx tsc --noEmit` — os call sites de `buscarCategorias()` que só leem `.id`/`.label` (HomeCategoryChips, BuscarClient) continuam compilando (subset estrutural).

- [ ] **Step 3:** Commit:

```bash
git add src/lib/data/categorias.ts
git commit -m "refactor(taxonomia): buscarCategorias devolve o catalogo visual completo (icon+gradiente)"
```

---

### Task 3: `src/lib/data/cupons.ts` — enriquecer `linhaParaCupom` com o catálogo

**Files:**
- Modify: `src/lib/data/cupons.ts`

**Interfaces:**
- Consumes: `buscarCategorias()` (Task 2), `resolverCategoriaVisual` (Task 1).
- Produces: `linhaParaCupom(row, nome, catalogo)` com novo 3º parâmetro; todo `Cupom` retornado por este módulo carrega `categoriaVisual`.

- [ ] **Step 1:** Import novo no topo:
```ts
import type { CategoriaVisual } from "@/lib/categoria-visual";
import { resolverCategoriaVisual } from "@/lib/categoria-visual";
import { buscarCategorias } from "@/lib/data/categorias";
```

- [ ] **Step 2:** Mudar a assinatura de `linhaParaCupom`:
```ts
export function linhaParaCupom(
  row: CupomRow,
  estabelecimentoNome: string,
  catalogo: readonly CategoriaVisual[],
): Cupom {
  return {
    id: row.id,
    // ...
    categoria: row.categoria_id,
    categoriaVisual: resolverCategoriaVisual(row.categoria_id, catalogo),
    // ...resto inalterado
  };
}
```
(Remove o `as CategoriaId` do campo `categoria` — agora é `string` puro.)

- [ ] **Step 3:** Em CADA função exportada que chama `linhaParaCupom`, buscar o catálogo 1x (em paralelo com a query principal via `Promise.all`) e repassar:
  - `buscarCuponsHome`: já faz `Promise.all([query, favSet-promise])` — acrescentar `buscarCategorias()` nesse mesmo `Promise.all` e passar o resultado a cada `.map((row) => linhaParaCupom(row, ..., catalogo))`.
  - `buscarCuponsNovidades`: buscar catálogo em paralelo com a query de `rows`.
  - `buscarCupomPorId`: buscar catálogo em paralelo com a query do cupom.
  - `buscarCuponsFavoritos`: buscar catálogo em paralelo com a query de `favs`+`data`.
  - `buscarCuponsBusca`: buscar catálogo em paralelo com a query de cupons.
  - `buscarCuponsPortal`: buscar catálogo em paralelo com a query de `cupons`.

  Exemplo (`buscarCuponsBusca`):
  ```ts
  export async function buscarCuponsBusca(): Promise<Cupom[]> {
    const supabase = createClient();
    const [{ data, error }, catalogo] = await Promise.all([
      supabase
        .from("cupons")
        .select("*, estabelecimentos(nome)")
        .in("status", ["ativo", "indisponivel"])
        .order("ordem", { ascending: true }),
      buscarCategorias(),
    ]);
    if (error) throw new Error(`Falha ao buscar cupons da busca: ${error.message}`);
    return filtrarVisiveis(data ?? [], hojeBrt()).map((row) =>
      linhaParaCupom(row, row.estabelecimentos?.nome ?? "", catalogo),
    );
  }
  ```

- [ ] **Step 4:** `CategoriaId` não é mais importado neste arquivo — remover do import no topo (`import type { CategoriaId, Cupom, ... }` → tira `CategoriaId`).

- [ ] **Step 5:** Rodar `npx tsc --noEmit` — confirmar que este arquivo compila e que os ERROS restantes são só nos componentes/telas ainda não migrados (Tasks 4–7).

- [ ] **Step 6:** Commit:

```bash
git add src/lib/data/cupons.ts
git commit -m "refactor(taxonomia): linhaParaCupom resolve categoriaVisual do catalogo real (1 catalogo por request)"
```

---

### Task 4: Componentes de exibição — `CouponCard`, `CouponListItem`, `CouponPortalCard`, `BusinessCard`

**Files:**
- Modify: `src/components/coupon-card.tsx`
- Modify: `src/components/coupon-list-item.tsx`
- Modify: `src/components/portal/coupon-portal-card.tsx`
- Modify: `src/components/business-card.tsx`

**Interfaces:**
- Consumes: `cupom.categoriaVisual` / `estabelecimento.categoriaVisual` (Task 1/3), `CATEGORIA_VISUAL_FALLBACK` (Task 1).

- [ ] **Step 1:** Em cada um dos 4 arquivos, trocar:
```ts
import { getCategoria } from "@/lib/mock-data";
// ...
const categoria = getCategoria(cupom.categoria); // ou estabelecimento.categoria
```
por:
```ts
import { CATEGORIA_VISUAL_FALLBACK } from "@/lib/categoria-visual";
// ...
const categoria = cupom.categoriaVisual ?? CATEGORIA_VISUAL_FALLBACK; // ou estabelecimento.categoriaVisual
```
Nada mais muda nesses 4 arquivos — o resto do JSX já lê `categoria.gradiente`/`categoria.icon`/`categoria.label`.

- [ ] **Step 2:** Rodar `npx tsc --noEmit`. `BusinessCard` só compila de novo quando `Estabelecimento` (mock) carregar `categoriaVisual` — ver Task 7. Se o erro aparecer aqui, é esperado; seguir para a Task 7 antes de considerar esta tarefa fechada.

- [ ] **Step 3:** Commit:

```bash
git add src/components/coupon-card.tsx src/components/coupon-list-item.tsx src/components/portal/coupon-portal-card.tsx src/components/business-card.tsx
git commit -m "refactor(taxonomia): cards leem categoriaVisual resolvido, sem getCategoria/mock-data"
```

---

### Task 5: `/m/cupom/[id]/page.tsx` — cupom pode vir do banco OU do mock

**Files:**
- Modify: `src/app/m/cupom/[id]/page.tsx`

**Interfaces:**
- Consumes: `buscarCategorias()` (Task 2), `resolverCategoriaVisual` (Task 1). `getCupom` (mock) continua existindo, mas o cupom mock agora já carrega `categoriaVisual` (Task 7) — então este ponto pode simplesmente preferir `cupom.categoriaVisual` quando presente e cair no resolver só por robustez.

- [ ] **Step 1:** Trocar o import:
```ts
import { getCupom } from "@/lib/mock-data";
import { buscarCategorias } from "@/lib/data/categorias";
import { resolverCategoriaVisual } from "@/lib/categoria-visual";
```
(remove `getCategoria` do import de mock-data)

- [ ] **Step 2:** Buscar o catálogo em paralelo com `buscarCupomPorId`:
```ts
const [doBanco, catalogo] = await Promise.all([
  buscarCupomPorId(params.id),
  buscarCategorias(),
]);
const doMock = getCupom(params.id);
const cupom = doBanco ?? doMock;
if (!cupom) notFound();
// ...
const categoria = cupom.categoriaVisual ?? resolverCategoriaVisual(cupom.categoria, catalogo);
```
(`doBanco` já carrega `categoriaVisual` via `linhaParaCupom`; `doMock` também vai carregar depois da Task 7. O `resolverCategoriaVisual` aqui é só uma segunda rede de segurança — nunca deve disparar na prática, mas cobre o caso de o mock não ter sido migrado por algum motivo.)

- [ ] **Step 3:** Rodar `npx tsc --noEmit`.

- [ ] **Step 4:** Commit:

```bash
git add "src/app/m/cupom/[id]/page.tsx"
git commit -m "refactor(taxonomia): detalhe do cupom resolve categoria via catalogo real, com fallback"
```

---

### Task 6: Admin — `cupons-client.tsx` e `estab-client.tsx` recebem o catálogo real

**Files:**
- Modify: `src/app/admin/(painel)/cupons/page.tsx`
- Modify: `src/app/admin/(painel)/cupons/cupons-client.tsx`
- Modify: `src/app/admin/(painel)/estabelecimentos/page.tsx`
- Modify: `src/app/admin/(painel)/estabelecimentos/estab-client.tsx`

**Interfaces:**
- Consumes: `buscarCategorias()` (Task 2), `resolverCategoriaVisual`/`CategoriaVisual` (Task 1).
- Produces: `CuponsAdminClient`/`EstabAdminClient` ganham prop nova `catalogo: CategoriaVisual[]`.

- [ ] **Step 1 (`cupons/page.tsx`):**
```ts
import { buscarCategorias } from "@/lib/data/categorias";
// ...
export default async function AdminCuponsPage() {
  const [cupons, catalogo] = await Promise.all([
    buscarCuponsAdmin(),
    buscarCategorias(),
  ]);
  // ...
  <CuponsAdminClient cupons={cupons} catalogo={catalogo} />
}
```

- [ ] **Step 2 (`cupons-client.tsx`):**
  - Trocar `import type { CategoriaId } from "@/lib/types"; import { getCategoria } from "@/lib/mock-data";` por `import type { CategoriaVisual } from "@/lib/categoria-visual"; import { resolverCategoriaVisual } from "@/lib/categoria-visual";`.
  - Prop nova na assinatura do componente: `export function CuponsAdminClient({ cupons, catalogo }: { cupons: AdminCupom[]; catalogo: CategoriaVisual[] }) {`.
  - `columns` é definido dentro do componente (fecha sobre `catalogo`) — trocar `const cat = getCategoria(c.categoriaId as CategoriaId);` por `const cat = resolverCategoriaVisual(c.categoriaId, catalogo);` (2 ocorrências: coluna "cupom" e `DetalheModal`).
  - `DetalheModal` também precisa do catálogo: passar `catalogo` como prop e trocar `const cat = getCategoria(cupom.categoriaId as CategoriaId);` por `resolverCategoriaVisual(cupom.categoriaId, catalogo)`. Atualizar a chamada `<DetalheModal cupom={detalhe} ... />` para incluir `catalogo={catalogo}`.

- [ ] **Step 3 (`estabelecimentos/page.tsx`):** mesmo padrão do Step 1, com `EstabAdminClient`.

- [ ] **Step 4 (`estab-client.tsx`):**
  - Trocar `import type { CategoriaId } from "@/lib/types"; import { categorias as todasCategorias, getCategoria } from "@/lib/mock-data";` por `import type { CategoriaVisual } from "@/lib/categoria-visual"; import { resolverCategoriaVisual } from "@/lib/categoria-visual";`.
  - Prop nova: `export function EstabAdminClient({ estabelecimentos, catalogo }: { estabelecimentos: AdminEstabelecimento[]; catalogo: CategoriaVisual[] }) {`.
  - Coluna "nome": `const cat = resolverCategoriaVisual(e.categoriaId, catalogo);`.
  - Coluna "categoria" (badges): `{e.categorias.map((c) => (<Badge key={c} variant="muted">{resolverCategoriaVisual(c, catalogo).label}</Badge>))}`.
  - `CategoriasModal`: **esta é a correção funcional real** — hoje itera `todasCategorias` (6 fixas do mock); passa a receber `catalogo` como prop e iterar sobre ELE, para que o admin consiga atribuir QUALQUER categoria real do banco a um estabelecimento, não só as 6 do protótipo:
    ```ts
    function CategoriasModal({
      estabelecimento,
      catalogo,
      onClose,
      onSalvo,
    }: {
      estabelecimento: AdminEstabelecimento;
      catalogo: CategoriaVisual[];
      onClose: () => void;
      onSalvo: () => void;
    }) {
      // ...
      {catalogo.map((c) => { /* igual, trocando todasCategorias por catalogo */ })}
    }
    ```
    Atualizar o local que renderiza `<CategoriasModal estabelecimento={editando} ... />` para passar `catalogo={catalogo}` (o `catalogo` já está em escopo no componente pai `EstabAdminClient`).

- [ ] **Step 5:** Rodar `npx tsc --noEmit`.

- [ ] **Step 6:** Commit:

```bash
git add "src/app/admin/(painel)/cupons" "src/app/admin/(painel)/estabelecimentos"
git commit -m "refactor(taxonomia): admin le o catalogo real de categorias (fim do limite de 6 no modal de atribuicao)"
```

---

### Task 7: `mock-data.ts` — denormalizar `categoriaVisual` nos objetos demo

**Files:**
- Modify: `src/lib/mock-data.ts`
- Modify: `src/components/app-mockup.tsx`

**Interfaces:**
- Consumes: `CategoriaVisual`, `resolverCategoriaVisual` (Task 1).
- Produces: `categorias` (array local, renomear para não colidir semanticamente — manter nome, é só o catálogo DEMO), `cupons`/`estabelecimentos` com `categoriaVisual` já preenchido.

- [ ] **Step 1:** No topo de `mock-data.ts`, trocar o import de `Categoria`/`CategoriaId` (que saíram de `types.ts`) por `CategoriaVisual` de `@/lib/categoria-visual`:
```ts
import type {
  Avaliacao, Cupom, Estabelecimento, FunilEtapa, MetricasCupom, Plano, SerieMensal, Usuario,
} from "./types";
import type { CategoriaVisual } from "./categoria-visual";
import { resolverCategoriaVisual } from "./categoria-visual";
```

- [ ] **Step 2:** Tipar o array de catálogo demo como `CategoriaVisual[]` (mesmo conteúdo, só troca o tipo):
```ts
const categoriasDemo: CategoriaVisual[] = [ /* ... mesmos 6 objetos, sem `id: CategoriaId` — id: string ... */ ];
export const categorias = categoriasDemo; // nome público preservado (consumido por category-chips.tsx, portal/estabelecimento/page.tsx)
```

- [ ] **Step 3:** Remover `categoriaMap` e `getCategoria` inteiramente (não são mais exportados por ninguém no domínio operacional — os únicos consumidores foram migrados nas Tasks 4–6).

- [ ] **Step 4:** Ao construir `estabelecimentos` e `cupons`, anexar `categoriaVisual` resolvido contra `categoriasDemo`. Mais simples: manter os literais como estão (com `categoria: "alimentacao"` etc.) e no FINAL do array fazer um `.map()`:
```ts
export const estabelecimentos: Estabelecimento[] = [
  /* ...literais inalterados... */
].map((e) => ({ ...e, categoriaVisual: resolverCategoriaVisual(e.categoria, categoriasDemo) }));

export const cupons: Cupom[] = [
  /* ...literais inalterados... */
].map((c) => ({ ...c, categoriaVisual: resolverCategoriaVisual(c.categoria, categoriasDemo) }));
```
(`cuponsEmDestaque`, `cuponsVisiveis`, `getCupom` continuam funcionando sem mudança — operam sobre `cupons` já enriquecido.)

- [ ] **Step 5 (`app-mockup.tsx`):** trocar
```ts
import { cupons, getCategoria } from "@/lib/mock-data";
// ...
style={{ background: getCategoria(t.categoria).gradiente }}
```
por
```ts
import { cupons } from "@/lib/mock-data";
// ...
style={{ background: t.categoriaVisual?.gradiente ?? CATEGORIA_VISUAL_FALLBACK.gradiente }}
```
(import `CATEGORIA_VISUAL_FALLBACK` de `@/lib/categoria-visual`; na prática `t.categoriaVisual` sempre existe aqui porque vem de `mock-data.cupons` já enriquecido, mas o `??` documenta a tolerância sem custo.)

- [ ] **Step 6:** Rodar `npx tsc --noEmit` — checar `landing/hero.tsx`, `landing/sections.tsx`, `components/portal/novo-cupom-form.tsx` (preview com `cuponsEmDestaque`/mock) continuam compilando sem alteração nenhuma (eles só passam `cupom` adiante).

- [ ] **Step 7:** Commit:

```bash
git add src/lib/mock-data.ts src/components/app-mockup.tsx
git commit -m "refactor(taxonomia): mock-data denormaliza categoriaVisual e perde getCategoria/categoriaMap"
```

---

### Task 8: Portal — `NovoCupomForm` (preview com `CouponCard`) recebe o catálogo

**Files:**
- Modify: `src/app/portal/(painel)/cupons/page.tsx`
- Modify: `src/app/portal/(painel)/cupons/cupons-client.tsx`
- Modify: `src/components/portal/novo-cupom-form.tsx`

**Interfaces:**
- Consumes: `buscarCategorias()` (Task 2), `resolverCategoriaVisual` (Task 1).
- Produces: `NovoCupomForm` ganha prop `catalogoVisual: CategoriaVisual[]`; o `previewCupom` passado a `CouponCard` carrega `categoriaVisual` calculado ao vivo conforme o lojista troca a seleção.

- [ ] **Step 1 (`cupons/page.tsx`):**
```ts
import { buscarCategorias } from "@/lib/data/categorias";
// ...
const [{ estabelecimento, itens }, categoriasEstab] = await Promise.all([
  buscarCuponsPortal(),
  /* ... já existia buscarCategoriasEstab condicional ... */
]);
const catalogoVisual = await buscarCategorias();
// ...
<CuponsClient ... catalogoVisual={catalogoVisual} />
```
(Ajustar conforme a ordem real de `await`s já existente no arquivo — o ponto é acrescentar UMA chamada a `buscarCategorias()`, em paralelo com as demais via `Promise.all`, e repassar.)

- [ ] **Step 2 (`cupons-client.tsx`):** prop nova `catalogoVisual: CategoriaVisual[]` na assinatura de `CuponsClient`, repassada para `<NovoCupomForm ... catalogoVisual={catalogoVisual} />`.

- [ ] **Step 3 (`novo-cupom-form.tsx`):**
  - Trocar `import type { CategoriaId, Cupom } from "@/lib/types";` → remove `CategoriaId` (não usado mais como tipo de domínio).
  - Nova prop: `catalogoVisual: CategoriaVisual[]` (import de `@/lib/categoria-visual`, junto com `resolverCategoriaVisual`).
  - Trocar `const categoria = categoriaSel as CategoriaId;` por `const categoria = categoriaSel;` (já é string).
  - No objeto `previewCupom` (montado para o `<CouponCard cupom={previewCupom} .../>`), acrescentar `categoriaVisual: resolverCategoriaVisual(categoriaSel, catalogoVisual)`.
  - Atualizar a assinatura de props do componente para incluir `catalogoVisual`.

- [ ] **Step 4:** Rodar `npx tsc --noEmit`.

- [ ] **Step 5:** Commit:

```bash
git add "src/app/portal/(painel)/cupons" src/components/portal/novo-cupom-form.tsx
git commit -m "refactor(taxonomia): preview do form do portal usa o catalogo visual real"
```

---

### Task 9: Superfícies mock isoladas — ajuste de tipo sem mudança de comportamento

**Files:**
- Modify: `src/app/m/estabelecimentos/page.tsx`
- Modify: `src/components/category-chips.tsx`
- Modify: `src/app/portal/(painel)/estabelecimento/page.tsx`

**Interfaces:**
- Nenhuma nova — só remoção de imports de tipo que deixaram de existir.

- [ ] **Step 1 (`m/estabelecimentos/page.tsx`):** esta tela é 100% mock (array `estabelecimentos` de `mock-data.ts`, sem leitura do banco — documentado no próprio arquivo). Trocar `getCategoria(e.categoria)` por `e.categoriaVisual ?? CATEGORIA_VISUAL_FALLBACK` (mesmo padrão da Task 4); remover o import de `getCategoria`.

- [ ] **Step 2 (`category-chips.tsx`):** nenhuma mudança de lógica — só confirmar que `categorias` (de `mock-data`) ainda tipa como `CategoriaVisual[]` (compatível, `c.icon`/`c.label` continuam existindo). Sem edição necessária além de revalidar com `tsc`.

- [ ] **Step 3 (`portal/(painel)/estabelecimento/page.tsx`):** esta tela não persiste nada (é um formulário 100% local, `onClick={() => setSalvo(true)}` sem server action — confirmado na Parte A). Trocar `const [categoria, setCategoria] = React.useState<CategoriaId>("alimentacao");` por `React.useState<string>("alimentacao")` e remover o import de `CategoriaId`. Documentar com um comentário curto por que ela não foi conectada ao catálogo real (fora do escopo deste WP — tela sem persistência).

- [ ] **Step 4:** Rodar `npx tsc --noEmit` — deve fechar zero erros relacionados a taxonomia.

- [ ] **Step 5:** Commit:

```bash
git add "src/app/m/estabelecimentos/page.tsx" src/components/category-chips.tsx "src/app/portal/(painel)/estabelecimento/page.tsx"
git commit -m "refactor(taxonomia): ajusta tipos das telas mock isoladas (sem mudanca de comportamento)"
```

---

### Task 10: Testes bloqueantes (J e K do WP) + N+1

**Files:**
- Create: `scripts/test-tx-p1.ts`
- Modify: `package.json` (novo script `test:tx-p1`)

**Interfaces:**
- Consumes: `resolverCategoriaVisual`, `CATEGORIA_VISUAL_FALLBACK` (Task 1), `buscarCategorias` (Task 2), `linhaParaCupom` (Task 3).

- [ ] **Step 1:** Escrever `scripts/test-tx-p1.ts` seguindo o padrão dos outros `scripts/test-fase*.ts` (função `check(nome, ok, detalhe)`, contadores `passed`/`failed`, `process.exitCode` no final — NUNCA `process.exit()`, ver armadilha do `finally`):

```ts
/**
 * TX-P1 — o frontend não pode quebrar quando uma categoria desconhecida
 * (fora das 6 do protótipo) aparece. Testa o MECANISMO CENTRAL que os 6
 * pontos de exibição (coupon-card, coupon-list-item, business-card,
 * coupon-portal-card, detalhe do cupom, mapper do admin) usam igual:
 * `resolverCategoriaVisual`. Não há harness de render de componente neste
 * repo (suítes são scripts, não Jest/Vitest) — testar o resolvedor cobre
 * exatamente o ponto onde os 6 lugares fariam undefined.gradiente/undefined.icon
 * antes desta mudança.
 */
import { resolverCategoriaVisual, CATEGORIA_VISUAL_FALLBACK, type CategoriaVisual } from "../src/lib/categoria-visual";
import { linhaParaCupom } from "../src/lib/data/cupons";
import { resolverAlvo } from "./_alvo";

const alvo = resolverAlvo("test-tx-p1");
import { createClient } from "@supabase/supabase-js";

let passed = 0, failed = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${nome}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
}

const CATALOGO_TESTE: CategoriaVisual[] = [
  { id: "alimentacao", label: "Alimentação", icon: "UtensilsCrossed", gradiente: "g1" },
  { id: "fitness", label: "Fitness", icon: "Dumbbell", gradiente: "g2" },
];

async function main() {
  console.log("\n=== TX-P1 — categoria desconhecida não quebra ===\n");

  // J — mecanismo central: id fora do catálogo -> fallback, nunca undefined
  const desconhecida = resolverCategoriaVisual("categoria-nova-de-teste", CATALOGO_TESTE);
  check("id desconhecido devolve o fallback (não undefined)", desconhecida === CATEGORIA_VISUAL_FALLBACK);
  check("fallback tem icon", typeof desconhecida.icon === "string" && desconhecida.icon.length > 0);
  check("fallback tem gradiente", typeof desconhecida.gradiente === "string" && desconhecida.gradiente.length > 0);
  check("fallback tem label", typeof desconhecida.label === "string" && desconhecida.label.length > 0);

  // id conhecido -> objeto real do catálogo, não o fallback
  const conhecida = resolverCategoriaVisual("fitness", CATALOGO_TESTE);
  check("id conhecido devolve o item real do catalogo", conhecida.id === "fitness" && conhecida.label === "Fitness");

  // linhaParaCupom (mapper usado por TODAS as consultas de /m, /portal, /admin)
  // nunca lança e sempre popula categoriaVisual, mesmo com categoria_id fora do catalogo passado.
  const rowFake = {
    id: "x1", titulo: "t", estabelecimento_id: "e1", categoria_id: "categoria-nova-de-teste",
    economia: "10", economia_variavel: false, taxas: [], formas_consumo: [],
    preco_de: null, preco_por: null, distancia_km: "1", rating: "4.5", avaliacoes: 10,
    validade_fim: "2099-01-01", status: "ativo", imagem: "", beneficio: "b", regras: [],
    horarios: {}, prazo_ativacao_horas: null, destaque: false,
  } as unknown as Parameters<typeof linhaParaCupom>[0];
  let lancou = false;
  let cupomMapeado: ReturnType<typeof linhaParaCupom> | undefined;
  try {
    cupomMapeado = linhaParaCupom(rowFake, "Estab Teste", CATALOGO_TESTE);
  } catch {
    lancou = true;
  }
  check("linhaParaCupom NAO lanca com categoria_id desconhecido", !lancou);
  check("linhaParaCupom popula categoriaVisual com o fallback", cupomMapeado?.categoriaVisual?.id === CATEGORIA_VISUAL_FALLBACK.id);

  console.log("\n=== TX-P1 — catalogo real (banco local) ===\n");
  const svc = createClient(alvo.url, alvo.serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cats, error } = await svc.from("categorias").select("id, label, icon, gradiente, ordem").order("ordem");
  check("catalogo real: consulta sem erro", !error, error?.message);
  check("catalogo real: 6 categorias atuais", (cats ?? []).length === 6, `veio ${(cats ?? []).length}`);
  const primeiroSemIcon = (cats ?? []).find((c) => !c.icon || !c.gradiente);
  check("catalogo real: todas as linhas tem icon e gradiente", !primeiroSemIcon, JSON.stringify(primeiroSemIcon));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
```

- [ ] **Step 2:** Adicionar em `package.json`:
```json
"test:tx-p1": "tsx scripts/test-tx-p1.ts",
```

- [ ] **Step 3:** Rodar `npm run db:reset` (garante o catálogo de 6 categorias no banco local) e depois `npm run test:tx-p1`. Todos os `check` devem imprimir `PASS`.

- [ ] **Step 4:** Prova de N+1 (inspeção, sem novo teste automatizado): confirmar por leitura que cada função em `src/lib/data/cupons.ts` chama `buscarCategorias()` UMA VEZ por invocação (dentro do `Promise.all` da Task 3), nunca dentro de um `.map()`. Registrar essa confirmação no relatório final (não precisa de script — é uma propriedade estática do código, checável por `git grep -n "buscarCategorias()" src/lib/data/cupons.ts` e contando as ocorrências = número de funções exportadas, todas fora de laço).

- [ ] **Step 5:** Commit:

```bash
git add scripts/test-tx-p1.ts package.json
git commit -m "test(taxonomia): categoria desconhecida nao quebra o mecanismo central + catalogo real tem icon/gradiente"
```

---

### Task 11: `db:types` + auditoria final + verify

**Files:** nenhum arquivo novo — só comandos e conferência.

- [ ] **Step 1:** `npm run db:types` — confirmar exit 0, arquivo `src/lib/supabase/database.types.ts` não truncado (`wc -l` antes/depois, sem queda abrupta), sem delta inesperado (`git diff --stat src/lib/supabase/database.types.ts` deve dar vazio, já que este WP não muda schema).

- [ ] **Step 2:** Auditoria final (repetir os greps da Parte A/P do WP):
```bash
git grep -n "as CategoriaId" -- src
git grep -n "getCategoria" -- src
git grep -n "categoriaMap" -- src
git grep -n 'from "@/lib/mock-data"' -- src
```
Cada ocorrência restante precisa ser classificável como (a) demo isolado e documentado (landing, app-mockup, portal/estabelecimento sem persistência) ou (b) inexistente. Nenhuma pode ser dependência operacional da taxonomia fechada.

- [ ] **Step 3:** `npm run verify > verify.log 2>&1; echo $?` (capturar em arquivo, ler o código depois — NUNCA pipe com `tail`/`tee` para medir exit code, é a armadilha documentada no CLAUDE.md). Ler `verify.log` e relatar suítes PASS/FAIL reais + resultado do `next build`.

- [ ] **Step 4:** Se tudo verde, commit final se houver sobras (não deveria haver, já que cada tarefa comitou por si):
```bash
git status --short
```
Se limpo, nada a commitar aqui — só reportar.

---

## Self-Review (já aplicado ao escrever este plano)

- **Cobertura do spec:** A–D (inventário/CategoriaId/catálogo real/fallback) → Tasks 1–3, 7. E (sem lookup global fechado) → Tasks 4–8. F (home/filtros preservados) → nenhuma mudança nesses arquivos, só confirmado por leitura. G (autorização via `estabelecimento_categorias` preservada) → Task 6 não mexe em `buscarCategoriasEstab`. H (app-mockup) → Task 7. I (mock-data preservado) → Task 7. J/K (testes) → Task 10. L (N+1) → Task 10 Step 4. M (sem mudança de banco) → nenhuma migration em nenhuma tarefa. N (db:types) → Task 11. O (verify) → Task 11. P (auditoria) → Task 11. Q (commit local, sem push/PR) → cada tarefa comita local; nenhuma tarefa faz push/PR.
- **Placeholder scan:** nenhum "TBD"/"similar to Task N" — cada tarefa tem o código real.
- **Consistência de tipos:** `CategoriaVisual` (Task 1) é o único shape novo e é usado com o mesmo nome de campo (`categoriaVisual`) em `Cupom`, `Estabelecimento`, e como prop (`catalogo`/`catalogoVisual`) em todos os client components — nomes de prop variam entre `catalogo` (admin) e `catalogoVisual` (portal) de propósito, para não colidir com a variável local `categorias` (id+label, `CategoriaEstab`) já existente nesses mesmos arquivos.
