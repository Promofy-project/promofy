# Relatórios de QA v1 + v2 — Plano de Implementação

> **Para executores:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Passos usam checkbox (`- [ ]`).

**Goal:** Auditar cada item dos dois relatórios de QA do cliente contra o código real, corrigir
os defeitos verdadeiros e implementar o que falta — sem reimplementar o que já existe.

**Architecture:** O achado central da auditoria é que **boa parte do v2 já está implementada** e
o relatório parte de premissas erradas (ver §"Correções ao relatório"). O trabalho real se
concentra em (a) quatro defeitos genuínos e baratos, (b) uma regra de negócio da janela de
consumo que precisa mudar no **banco**, (c) a taxonomia Segmento/Categoria, que é uma fase
inteira sozinha. Regra no banco, UI espelha — como em todo o resto do projeto.

**Tech Stack:** Next.js 14 App Router · Supabase (Postgres 17 + RLS + RPCs `security definer`) ·
TypeScript · Tailwind + shadcn/ui.

**Spec:** `docs/taxonomia/Promofy_Anotacoes_Devs.pdf` (v1, já versionado) + relatório v2
(recebido em 17/08/2026, a versionar em `docs/taxonomia/`).

## Global Constraints

- **Migrations são aditivas e vão ao ar ANTES do deploy**, com OK explícito por passo. Entrada no
  `MIGRATIONS.md` no **mesmo commit**.
- **A preview aponta para o banco de PRODUÇÃO.** Smoke só com `qa-*` ou `convidado@`. Nunca
  `consumidor@`. Nenhuma suíte `test:*:hosted` contra preview.
- **Módulos puros** (`src/lib/*.ts` sem `server-only`/DOM/`Intl`) — o app React Native traduz, não decide.
- **`"use server"`: todo export precisa ser `async`.** Helpers síncronos vão para `src/lib/`.
- **Botão dentro de `<form>` sem `type` é `submit`.** O `<Button>` da casa nasce `type="button"`;
  `<button>` cru, não.
- **Nunca editar migration já empurrada.** Produção tem 1–27; a 28 é local. A próxima livre é a **29**.

---

## Matriz de auditoria — o que o cliente pediu × o que existe

Legenda: ✅ já implementado · ⚠️ parcial/premissa errada · ❌ ausente · 🐞 defeito confirmado

### Relatório v1

| § | Item | Status | Evidência |
|---|---|---|---|
| 1 | Visualizar senha nos 4 logins | ✅ | `src/components/password-input.tsx:24-58`; `field.tsx:25` troca sozinho |
| 2.1 | Selo "cupom utilizado" na home | ✅ | `src/components/cupom-selo-utilizado.tsx:27-61`, usado em `m/page.tsx:74` |
| 2.1 | "Usar cupom" × "Regras de uso" | 🐞 | `src/app/m/page.tsx:73` — `i % 3 === 2`, rótulo decorativo |
| 2.2 | Janela: botão borrado + mensagem | ✅ | `cupom-acao-usar.tsx:147-163` |
| 2.3 | Cupom de teste | n/a | `supabase/seed.sql:59` — referência do QA, não tarefa |
| 3.1 | Editar cupom reprovado/pendente | ✅ | `reenviar_cupom_moderacao` + `coupon-portal-card.tsx:137` |
| 3.1 | Ativo só editável sem resgate acionado | ✅ | trigger `P0601`–`P0606`, migration 20 |
| 3.2 | Código sem hífens | ✅ | `src/lib/codigo-cupom.ts:36-49` (8 chars, não 12 — ver §Correções) |
| 3.3 | Taxas / formas de consumo / ilimitado / prazo 5h | ✅ | `novo-cupom-form.tsx:339-385,428-443,493-538` |
| 3.3 | Benefício no template durante a criação | ❌ | `coupon-card.tsx` nunca renderiza `cupom.beneficio` |
| 3.4 | Economia variável "a partir de" | ✅ | `cupom-campos.ts:115-117`, migration 18 |
| 4 | Rejeitar com motivo | ✅ | `admin/.../cupons-client.tsx:225-294` |
| 4 | Editar após rejeição (estabelecimento) | ✅ | `portal/.../cupons-client.tsx:55-87` |
| 4 | Editar após rejeição (**admin**) | ❌ | admin só tem Detalhes/Aprovar/Rejeitar |
| 5.1 | **Segmento + Categoria (15 × ~85)** | ❌ | hoje 6 categorias flat, `schema_inicial.sql:35-41` |
| 5.2 | Localização (perto de mim/bairro/cidade) | ❌ | `distancia_km` é estático de protótipo |
| 5.3 | Tipo de promoção | ❌ | sem modelagem |
| 5.4 | Tipo de consumo (filtro) | ⚠️ | campo existe (`formas_consumo`), filtro não |
| 5.5 | Valor de compra mínimo (slider) | ❌ | nem coluna existe |
| 5.6 | Descoberta / Em alta | ❌ | `cupom_metricas` não tem dimensão região/período |
| 5.7 | Relevância / Afinidade | ❌ | — |

### Relatório v2

| § | Item | Status | Evidência |
|---|---|---|---|
| 1.1 | Edição: data início, horários, dias, ocultar | ✅ | `novo-cupom-form.tsx:391-397,409-426,445-482` — **relatório está errado** |
| 1.2 | Crop de imagem | ❌ | `campo-imagem.tsx:63-95` sobe direto |
| 1.3 | Reativar esgotado/expirado por edição | ❌ | RPC só aceita `rejeitado` (migration 21:150) |
| 1.4 | 🐞 Botão "Novo cupom" no dashboard | 🐞 | `portal/(painel)/page.tsx:78-80` sem `href`/`onClick` |
| 1.5 | Validação por CPF no portal | ❌ | existe só em `/e` |
| 1.6 | Exclusão de cupom | ⚠️ | RLS permite; não há UI nem action |
| 1.7 | Logo do estabelecimento + galeria | ❌ | página é 100% mock; **sem coluna no schema** |
| 1.8 | Filtros na listagem do portal | ❌ | `cupons-client.tsx:183-193` sem controles |
| 2.1 | Ver imagem na moderação | ❌ | `AdminCupom` não traz `imagem` (`data/admin.ts:30-51`) |
| 2.2 | Admin editar cupom | ❌ | — |
| 2.3 | Cupons usados em lista vertical | ❌ | `usuarios-client.tsx:113` — `join(", ")` |
| 3.1 | 🐞 "Utilizado" sem ativação válida | ⚠️ | **não reproduzível no código** — ver §Correções |
| 3.1 | Ativação antecipada (overlap de 5h) | ❌ | `dentro_da_janela` compara só o instante atual |
| 3.2 | "Usar cupom" × "Regras de uso" | 🐞 | mesmo `i % 3` do v1 2.1 |
| 3.3 | 🐞 Ativações > cliques | 🐞 | causa real ≠ teoria do QA — ver §Correções |
| 4.1 | Planos anuais (não mensal/anual) | ❌ | `portal/planos/page.tsx:6-47` tudo `/mês` |
| 4.2 | Histórico de cupons | ⚠️ | `moderacao_historico` existe, só o admin vê |
| 4.3 | Modo noturno | ❌ | `darkMode:["class"]` é scaffold; zero classes `dark:` |
| 5.1 | NPS pela fórmula oficial? | ✅ | **Sim** — migration 25:52-62,101-103 |
| 5.2 | Onde o consumidor dá feedback? | ✅ | `nps-dialog.tsx` + `nps-pendente-card.tsx` |

---

## Correções ao relatório do cliente

Quatro afirmações do v2 não sobrevivem à leitura do código. Devolver isso é parte da entrega —
implementar em cima de premissa errada custa caro depois.

1. **§1.1 "a tela de edição não permite data de início/horários/dias/ocultar"** — permite. O mesmo
   `novo-cupom-form.tsx` serve criação e edição (`cupons-client.tsx:196-226`), com os quatro campos.
   A hipótese mais provável é que os cupons citados foram criados **pelo app `/e`**, cujo formulário
   é reduzido, e o QA leu o resultado como se a edição não tivesse os campos. **Ação:** conferir o
   formulário do `/e` (Task 9), não o do portal.

2. **§3.1 "a ativação foi processada no backend apesar do bloqueio na tela"** — não há caminho no
   código que faça isso. O botão fora da janela chama `setErro(...)` e **nunca** a RPC
   (`cupom-acao-usar.tsx:153`); a RPC retorna `fora_da_janela` **antes** do `insert`
   (migration 15:170-172), atomicamente; e o provider só toca o estado no ramo de sucesso
   (`coupon-state-provider.tsx:250-256`). **A causa provável é outra:** `validar_cupom` **não**
   recheca a janela — só `ativar_cupom` checa. Uma ativação legítima anterior (dentro do prazo de
   5h) validada no balcão às ~18h explica os dois prints sem nenhum bug de state. **Ação:** pedir ao
   QA o `cupons_usuario.ativado_em`/`row_id` do caso antes de "corrigir" o que não está quebrado.

3. **§3.3 "ativações em sequência sem fechar a tela geram mais ativações que cliques"** — a teoria
   não se sustenta: cada ativação passa por `handleUsar`, que registra o clique. A causa real é
   assimetria de durabilidade: **`ativacao` é gravada no servidor** dentro de `ativar_cupom`
   (migration 7:166), enquanto **`clique` é fire-and-forget no cliente**
   (`cupom-acao-usar.tsx:88`, `void`). Clique perdido na rede = ativação sem clique. A sugestão do
   QA (fechar a tela após ativar) trata o sintoma errado e piora a UX. **Ação:** Task 4.

4. **§3.2 "12 dígitos"** — o código é `PRMF-XXXX-XXXX`: **8 caracteres significativos** num
   alfabeto de 32 sem `0/O/1/I`. A entrada já aceita qualquer formatação
   (`codigo-cupom.ts:36-49`). Nada a fazer além de alinhar o número no relatório.

---

## Ondas

| Onda | Conteúdo | Migration? | Estado |
|---|---|---|---|
| **A** | Defeitos genuínos e baratos (Tasks 1–5) | não | **executar agora** |
| **B** | Janela de consumo: ativação antecipada (Tasks 6–7) | **29** | executar após OK |
| **C** | Portal/admin — lacunas de UI (Tasks 8–12) | não | executar após OK |
| **D** | Taxonomia Segmento/Categoria (Tasks 13–16) | **30–31** | fase própria |
| **E** | Filtros de busca restantes (5.2–5.7) | 32+ | fase própria |
| **F** | Produto/decisão: planos anuais, dark mode, crop, galeria | a definir | precisa de decisão |

Ondas D–F não têm tasks bite-sized aqui de propósito: cada uma é uma fase com seu próprio ciclo
banco-antes-código. Estão especificadas em §"Ondas D–F" com escopo e aceite.

---

## Onda A — defeitos genuínos

### Task 1: Botão "Novo cupom" morto no dashboard do portal

**Files:**
- Modify: `src/app/portal/(painel)/page.tsx:78-80`

**Interfaces:**
- Consumes: rota `/portal/cupons` (já existe, `src/app/portal/(painel)/cupons/page.tsx`)
- Produces: nada para tasks seguintes

O botão equivalente em `/portal/cupons` funciona porque troca uma view local
(`cupons-client.tsx:111-113`, `setView("novo")`). No dashboard não há essa view — o destino
correto é navegar para a listagem **já no formulário**, o que exige um parâmetro de URL lido pelo
client da listagem.

- [ ] **Step 1: Fazer o client da listagem abrir o formulário por query param**

Em `src/app/portal/(painel)/cupons/cupons-client.tsx`, onde `view` é inicializado, ler
`useSearchParams()`:

```tsx
import { useSearchParams } from "next/navigation";
// ...
const params = useSearchParams();
const [view, setView] = React.useState<"lista" | "novo">(
  params.get("novo") === "1" ? "novo" : "lista",
);
```

- [ ] **Step 2: Apontar o botão do dashboard para essa URL**

Em `src/app/portal/(painel)/page.tsx:78-80`, trocar o `<Button>` solto por um link. O `<Button>` da
casa aceita `asChild` (shadcn):

```tsx
<Button asChild>
  <Link href="/portal/cupons?novo=1">
    <Plus className="h-4 w-4" /> Novo cupom
  </Link>
</Button>
```

Confirmar que `Link` de `next/link` está importado no arquivo; se não, adicionar.

- [ ] **Step 3: Verificar manualmente**

`npm run dev` → `/portal` logado como `lojista@promofy.test` → clicar "Novo cupom" → deve abrir o
formulário de criação em `/portal/cupons?novo=1`.

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/(painel)/page.tsx src/app/portal/(painel)/cupons/cupons-client.tsx
git commit -m "fix(qa-v2-1.4): botao Novo cupom do dashboard nao abria o fluxo de criacao"
```

---

### Task 2: Rótulo "Regras de uso" decidido pelo índice do card

**Files:**
- Modify: `src/app/m/page.tsx:73`

**Interfaces:**
- Consumes: `CouponCard` (`src/components/coupon-card.tsx`), prop `ctaLabel?: string`
- Produces: nada

`ctaLabel={i % 3 === 2 ? "Regras de uso" : "Usar agora"}` alterna o rótulo pela **posição no grid**.
Pior: em `CouponCard` esse texto é decorativo — o clique real é o stretched link do card inteiro
(`coupon-card.tsx:61-66`), então os dois rótulos levam ao mesmo destino. É resíduo de protótipo, e
foi exatamente o que o cliente reportou como "inconsistência entre cupons" nos dois relatórios.

Decisão: **um rótulo só**. O card leva ao detalhe; é lá que "Usar cupom" tem significado real, com
os cinco estados de negócio já implementados em `cupom-acao-usar.tsx:98-179`.

- [ ] **Step 1: Remover a alternância**

Em `src/app/m/page.tsx`, trocar a linha 73 por `ctaLabel="Ver cupom"` — o card navega para o
detalhe, e o rótulo passa a descrever o que o toque faz de verdade.

- [ ] **Step 2: Varrer os outros usos**

```bash
grep -rn "ctaLabel" src/
```

Qualquer outro `ctaLabel` que alterne por índice recebe o mesmo tratamento. Se um `ctaLabel` fixo
sobreviver em outra tela, deixar como está — o defeito é a alternância arbitrária, não a prop.

- [ ] **Step 3: Commit**

```bash
git add src/app/m/page.tsx
git commit -m "fix(qa-v1-2.1,v2-3.2): rotulo do card nao depende mais da posicao no grid"
```

---

### Task 3: Cupons usados do consumidor em lista vertical (admin)

**Files:**
- Modify: `src/app/admin/(painel)/usuarios/usuarios-client.tsx:108-127`

**Interfaces:**
- Consumes: `Info` (componente local do mesmo arquivo), `u.cuponsUsados: string[]`,
  `u.estabelecimentos: string[]`
- Produces: nada

- [ ] **Step 1: Ver a assinatura de `Info`**

Ler o componente `Info` no mesmo arquivo. Hoje ele recebe `valor` como `string`. Para aceitar lista
vertical sem duplicar o componente, alargar o tipo para `React.ReactNode`.

- [ ] **Step 2: Trocar `join(", ")` por lista**

Aplicar aos **dois** campos (cupons usados e estabelecimentos frequentados — o v2 cita o primeiro,
mas o segundo tem o mesmo defeito e a mesma leitura ruim):

```tsx
<Info
  icon={Ticket}
  label={`Cupons usados (${u.cuponsUsados.length})`}
  valor={
    u.cuponsUsados.length ? (
      <ul className="space-y-0.5">
        {u.cuponsUsados.map((c, i) => (
          <li key={`${c}-${i}`}>{c}</li>
        ))}
      </ul>
    ) : (
      "Nenhum ainda"
    )
  }
  full
/>
```

A `key` leva o índice porque `cuponsUsados` é lista de **títulos**, e dois cupons podem repetir o
título — `key={c}` duplicaria.

- [ ] **Step 3: Verificar**

`/admin/usuarios` logado como `admin@promofy.test`, expandir um usuário com cupons usados.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/(painel)/usuarios/usuarios-client.tsx
git commit -m "feat(qa-v2-2.3): cupons usados e estabelecimentos em lista vertical no admin"
```

---

### Task 4: Clique deixa de ser fire-and-forget no cliente

**Files:**
- Modify: `supabase/migrations/` → **nova migration 29** (ver Task 6 — vão juntas se a Onda B for
  executada no mesmo ciclo; se não, esta task usa a 29 e a Task 6 passa para a 30)
- Modify: `src/components/cupom-acao-usar.tsx:88`
- Modify: `MIGRATIONS.md`

**Interfaces:**
- Consumes: `ativar_cupom(p_cupom_id text) → jsonb` (migration 15/17)
- Produces: contrato inalterado — a mudança é interna à função

O relatório pede "fechar a tela após ativar". Isso não corrige a causa: o clique se perde porque é
`void registrarEventoAction(...)` no cliente, sem await nem retry, enquanto a ativação é gravada
no servidor. A correção que respeita "regra no servidor" é registrar o clique **dentro da própria
RPC**, na mesma transação da ativação.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260817120000_fase10_clique_no_servidor.sql`. `create or replace` da
`ativar_cupom` mantendo a assinatura (não muda parâmetros — não precisa de DROP), acrescentando o
registro do clique **antes** de qualquer `return`, para que tentativa recusada também conte como
clique:

```sql
-- Logo após a checagem de sessão, antes de qualquer return de recusa:
insert into public.cupom_eventos (cupom_id, usuario_id, tipo)
values (p_cupom_id, v_uid, 'clique');
```

Copiar o corpo restante da versão vigente — que é a da **migration 17**
(`20260802120100_fase6_limites_ilimitados.sql`), não a da 15. Ler a 17 inteira antes de escrever:
recriar a partir da 15 perderia o tratamento de `limite_por_usuario = NULL`.

Cuidado: o `insert` do clique precisa vir **depois** do `if v_uid is null` (sem sessão não há
usuário para gravar) e **antes** do ramo idempotente `ja_ativo`, senão reabrir o cupom ativo não
conta clique.

- [ ] **Step 2: Entrada no MIGRATIONS.md (mesmo commit)**

Acrescentar a linha da 29 na seção da fase, com a observação: por que o clique saiu do cliente,
e que a relação cliques ≥ ativações passa a valer por construção.

- [ ] **Step 3: Remover o registro no cliente**

Em `cupom-acao-usar.tsx`, apagar a linha 88 (`void registrarEventoAction(cupom.id, "clique")`) e o
import se ficar órfão. Deixar comentário curto dizendo que o clique agora é gravado por
`ativar_cupom`, para ninguém reintroduzir.

**Atenção à janela banco-antes-código:** entre aplicar a 29 e subir o código, o clique é contado
**duas vezes** (cliente + servidor). É aditivo e não quebra nada, mas a janela precisa ser curta e
o fato precisa estar no `MIGRATIONS.md`.

- [ ] **Step 4: Rodar a suíte**

```bash
npm run db:reset && npm run test:fase2
```

Esperado: verde. `test-fase2.ts` cobre o ciclo do cupom e é onde uma regressão apareceria.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260817120000_fase10_clique_no_servidor.sql MIGRATIONS.md src/components/cupom-acao-usar.tsx
git commit -m "fix(qa-v2-3.3): clique vira evento de servidor — cliques >= ativacoes por construcao"
```

---

### Task 5: Benefício/descrição visível no template durante a criação

**Files:**
- Modify: `src/components/coupon-card.tsx`

**Interfaces:**
- Consumes: `Cupom.beneficio: string` (já existe no tipo e já é passado ao preview em
  `novo-cupom-form.tsx:159`)
- Produces: nada

O campo existe, o form já alimenta `previewCupom.beneficio`, mas o `CouponCard` nunca renderiza —
então o lojista escreve a descrição e não a vê no template, que é exatamente o pedido do v1 §3.3.

- [ ] **Step 1: Renderizar o benefício no card**

Em `CouponCard`, abaixo do título, acrescentar — truncado, para não quebrar o layout do grid:

```tsx
{cupom.beneficio && (
  <p className="line-clamp-2 text-xs text-muted-foreground">{cupom.beneficio}</p>
)}
```

- [ ] **Step 2: Conferir que não quebra a home**

O `CouponCard` é usado em `m/page.tsx`, `m/buscar`, `m/favoritos`, `m/novidades` e no preview do
form. Rodar `npm run dev` e olhar a home do `/m` e a listagem do portal: o card `compact` não pode
estourar altura. Se estourar, restringir o parágrafo ao card não-compact (`{!compact && ...}`).

- [ ] **Step 3: Commit**

```bash
git add src/components/coupon-card.tsx
git commit -m "feat(qa-v1-3.3): template do cupom passa a exibir o beneficio na criacao"
```

---

## Onda B — janela de consumo: ativação antecipada

### Task 6: `ativar_cupom` aceita ativação quando o prazo cobre a janela

**Files:**
- Create: `supabase/migrations/20260817130000_fase10_janela_antecipada.sql`
- Modify: `MIGRATIONS.md`

**Interfaces:**
- Consumes: `public.dentro_da_janela(jsonb) → boolean` (migration 15:40-102)
- Produces: `public.janela_alcancavel(p_horarios jsonb, p_prazo_horas int) → boolean` — usada pela
  UI espelho na Task 7 via `src/lib/janela.ts`

Hoje `ativar_cupom` recusa se o **instante atual** está fora da janela. O cliente pede: aceitar
quando a janela de prazo (`prazo_ativacao_horas`, default 5) a partir de agora **sobrepõe** a
janela de consumo do dia — 17:48 com janela 18:00–22:00 é ativação legítima, porque o código só
expira às 22:48.

**Decisão de desenho — `expira_em` não pode ultrapassar o fim da janela.** Sem isso, um cupom
"Seg 18h–22h" ativado às 17:48 expiraria às 22:48 e poderia ser validado no balcão às 22:30, fora
da janela que o lojista definiu. O `expira_em` passa a ser `min(agora + prazo, fim da janela)` —
e o consumidor continua sem perder o cupom, que é o objetivo do pedido.

- [ ] **Step 1: Escrever o helper de alcance**

Função pura sobre `jsonb` + int, `security definer set search_path = ''`, mesmo padrão de
`dentro_da_janela`. Regra: `true` se `dentro_da_janela(p_horarios)` **ou** se hoje é dia válido e
`inicio` cai dentro de `[agora, agora + p_prazo_horas]` (em BRT). Malformado = sem restrição =
`true`, igual à 15 — nunca exceção.

- [ ] **Step 2: Escrever a função de fim efetivo**

`public.fim_da_janela_hoje(p_horarios jsonb) → timestamptz` — devolve o timestamp BRT do `fim` de
hoje, ou `null` quando não há restrição/é malformado. É o que limita o `expira_em`.

- [ ] **Step 3: Recriar `ativar_cupom` usando as duas**

`create or replace`, a partir do corpo vigente (**migration 17**, mais a Task 4 se já aplicada).
Trocar `if not public.dentro_da_janela(...)` por `if not public.janela_alcancavel(c.horarios,
coalesce(c.prazo_ativacao_horas, 5))`, mantendo o motivo `fora_da_janela`. E no `insert`, trocar
`now() + make_interval(...)` por `least(now() + make_interval(...), coalesce(fim_da_janela_hoje, 'infinity'))`.

- [ ] **Step 4: Grants**

`revoke execute ... from public, anon` + `grant execute ... to authenticated` para as duas funções
novas — o padrão da 15:384-385.

- [ ] **Step 5: Entrada no MIGRATIONS.md (mesmo commit)**

Registrar: a regra que mudou, por que `expira_em` ganhou teto, e que `validar_cupom` **continua**
sem rechecar janela (é o `expira_em` que passa a carregar a garantia).

- [ ] **Step 6: Asserções na suíte**

Em `scripts/test-qa-relatorios.ts` (Task 17), cobrir com cupom próprio de horário controlado:
ativação antecipada dentro do alcance → `ok:true` e `expira_em` **não** ultrapassa o fim da janela;
ativação a mais de `prazo` horas do início → `fora_da_janela`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260817130000_fase10_janela_antecipada.sql MIGRATIONS.md scripts/test-qa-relatorios.ts
git commit -m "feat(qa-v2-3.1): ativacao antecipada quando o prazo alcanca a janela, com expira_em limitado"
```

---

### Task 7: UI espelha a nova regra

**Files:**
- Modify: `src/lib/janela.ts`
- Modify: `src/app/m/cupom/[id]/page.tsx:55`

**Interfaces:**
- Consumes: `dentroDaJanela(horarios)` (existente, `janela.ts:79-107`)
- Produces: `janelaAlcancavel(horarios, prazoHoras): boolean` — mesma semântica do SQL da Task 6

`janela.ts` é módulo puro (sem `Intl`, sem DOM) e replica o SQL byte a byte. Se a UI continuar
usando `dentroDaJanela`, o botão segue esmaecido às 17:48 mesmo com o servidor aceitando.

- [ ] **Step 1: Escrever `janelaAlcancavel` espelhando o SQL**

Mesma regra da Task 6, sem `Intl` (o Hermes pode não trazer). Reusar o cálculo de BRT já existente
no arquivo.

- [ ] **Step 2: Trocar o cálculo de `foraDaJanela` no server component**

Em `src/app/m/cupom/[id]/page.tsx:55`, passar a usar `!janelaAlcancavel(cupom.horarios,
cupom.prazoAtivacaoHoras ?? 5)`.

- [ ] **Step 3: Ajustar a mensagem**

`FORA_DA_JANELA` em `cupom-acao-usar.tsx:15` hoje diz "Cupom fora do intervalo de consumo." — com a
regra nova, o bloqueio só acontece quando o cupom **não é alcançável hoje**. Ajustar para dizer
quando volta a valer, se o dado estiver à mão; senão manter o texto (é o que o cliente pediu
literalmente no v1 §2.2).

- [ ] **Step 4: Commit**

```bash
git add src/lib/janela.ts src/app/m/cupom/[id]/page.tsx src/components/cupom-acao-usar.tsx
git commit -m "feat(qa-v2-3.1): UI espelha a regra de alcance da janela"
```

---

## Onda C — lacunas de UI no portal e no admin

### Task 8: Imagem do cupom visível na moderação

**Files:**
- Modify: `src/lib/data/admin.ts:30-51,58`
- Modify: `src/app/admin/(painel)/cupons/cupons-client.tsx` (`DetalheModal`, ~315-469)

- [ ] **Step 1:** Acrescentar `imagem: string` à interface `AdminCupom` e ao mapper (a query já é
  `select("*")`, então o dado já chega — falta tipar e propagar).
- [ ] **Step 2:** No `DetalheModal`, renderizar a imagem com o mesmo fallback usado no consumidor
  (ver `coupon-card.tsx`, que já trata `imagem` vazia). Moderar sem ver a imagem é o furo relatado.
- [ ] **Step 3:** Commit — `feat(qa-v2-2.1): moderacao passa a exibir a imagem do cupom`

### Task 9: Formulário do `/e` — conferir os campos de janela

**Files:**
- Modify: `src/app/e/cupom/novo/novo-cupom-form.tsx`

Este é o item que explica a premissa errada do v2 §1.1: se o form do `/e` não tem dias/horários, os
cupons nascem "todos os dias, 00:00–23:59" — exatamente a consequência descrita no relatório.

- [ ] **Step 1:** Ler o form do `/e` e listar quais dos quatro campos (data início, horários, dias,
  ocultar até início) faltam.
- [ ] **Step 2:** Acrescentar os que faltarem, reusando os controles do
  `src/components/portal/novo-cupom-form.tsx` (extrair para componente compartilhado se a
  duplicação passar de ~40 linhas).
- [ ] **Step 3:** Commit — `fix(qa-v2-1.1): cupom criado no /e deixa de nascer 24x7 por omissao`

### Task 10: Filtros na listagem de cupons do portal

**Files:** `src/app/portal/(painel)/cupons/cupons-client.tsx`

- [ ] **Step 1:** Filtro por **status** (o pedido explícito do v2 §1.8), client-side sobre a lista
  já carregada — sem ida ao servidor, a listagem do lojista é pequena.
- [ ] **Step 2:** Dia da semana e formas de consumo só depois, se o cliente confirmar a necessidade
  — são filtros de volume que hoje ninguém tem.
- [ ] **Step 3:** Commit — `feat(qa-v2-1.8): listagem de cupons do portal filtra por status`

### Task 11: Exclusão de cupom

**Files:** `src/lib/actions/cupons.ts`, `src/components/portal/coupon-portal-card.tsx`

**Decisão necessária antes de executar:** o v2 §4.2 pede **preservar histórico de tudo, inclusive
excluídos**. `DELETE` físico contradiz isso (e a RLS hoje permite delete físico —
`rls_policies.sql:159-161`). O desenho correto é **soft delete**: status `excluido` no enum, fora
das policies públicas, com o `DELETE` físico **revogado**. Isso é migration, não só UI.

- [ ] **Step 1:** Migration: `ALTER TYPE status_cupom ADD VALUE 'excluido'` — **arquivo próprio**,
  o valor não pode ser usado na mesma transação em que nasce (padrão das migrations 5 e 8).
- [ ] **Step 2:** Migration seguinte: revogar `delete` de `cupons` para `authenticated`; RPC
  `excluir_cupom(p_cupom_id)` que só marca `excluido` e registra em `moderacao_historico`.
- [ ] **Step 3:** UI: ação no card, com confirmação.
- [ ] **Step 4:** Commit.

### Task 12: Reativação de cupom esgotado/expirado

**Files:** migration + `src/components/portal/coupon-portal-card.tsx`

`reenviar_cupom_moderacao` recusa tudo que não é `rejeitado` (migration 21:150-151, erro
`nao_rejeitado`).

- [ ] **Step 1:** Migration: `create or replace` da RPC aceitando também `esgotado`/`expirado`.
  Ler a 21 inteira antes — ela é `DROP`+`CREATE` por ter mudado assinatura; aqui a assinatura
  **não** muda, então `create or replace` basta.
- [ ] **Step 2:** Ampliar a condição do botão "Reenviar para análise"
  (`coupon-portal-card.tsx:137`).
- [ ] **Step 3:** Commit.

---

## Ondas D–F — especificação (fases próprias)

### Onda D — Taxonomia Segmento × Categoria (v1 §5.1)

O maior item dos dois relatórios. Hoje: **6 categorias flat** (`seed.sql:14-21`). Pedido: **~15
segmentos × ~85 categorias**, hierárquico.

**Modelagem:** tabela `segmentos` (id text, label, ordem) + `categorias.segmento_id` FK **nullable
no nascimento** (aditiva!), populada por backfill na mesma migration; `NOT NULL` só numa migration
posterior, depois de o código novo estar no ar. As 6 categorias atuais viram categorias dentro dos
segmentos correspondentes — **os ids atuais não podem mudar**: `cupons.categoria_id` e
`estabelecimentos.categoria_id` são FKs, e `estabelecimento_categorias` (migration 12) tem trigger
validando que a categoria do cupom pertence ao estabelecimento.

**Risco a tratar antes:** com 85 categorias, o trigger `checar_categoria_cupom` continua exigindo
que a categoria do cupom esteja na junção do estabelecimento. Um estabelecimento cadastrado hoje em
"Alimentação" não terá "Pizzaria" na junção e **perderá a capacidade de criar cupom** se o backfill
não expandir a junção junto. Isso precisa estar na mesma migration.

**Aceite:** filtro em dois níveis em `/m/filtros` (o próprio código já reconhece o gap —
`filtros-client.tsx:146-148`); nenhum cupom existente órfão; `test:fase4` verde.

### Onda E — Filtros restantes (v1 §5.2–5.7)

Ordem sugerida por custo crescente:

1. **§5.4 tipo de consumo** — mais barato: campo `formas_consumo` já existe e chega ao objeto
   `Cupom` (`data/cupons.ts:82`). É só filtro de UI.
2. **§5.5 valor mínimo** — coluna nova `cupons.valor_minimo numeric` (aditiva, default null) +
   slider com teto de referência e "sem limite" no extremo.
3. **§5.3 tipo de promoção** — exige modelagem nova (enum `tipo_promocao`): "desconto em R$",
   "leve mais pague menos", "frete grátis". Não dá para derivar de `taxas`/`beneficio` (texto livre).
4. **§5.6 descoberta/em alta** — exige agregação por período/região; `cupom_metricas` só agrega por
   cupom. View materializada ou RPC com janela temporal. "Últimas unidades" só vale com
   `limite_total is not null` (o próprio relatório alerta).
5. **§5.2 localização** — a maior: `distancia_km` hoje é **estático de protótipo**
   (`schema_inicial.sql:77`). Fazer "perto de mim" de verdade pede lat/long em `estabelecimentos`,
   PostGIS ou cálculo de haversine, e permissão de geolocalização no cliente. O relatório ainda pede
   que isso vire a **ordenação padrão** — o que muda a home inteira.

### Onda F — precisa de decisão do cliente antes de estimar

- **Planos anuais (v2 §4.1):** hoje tudo é `/mês` e o toggle mensal/anual do `/m/planos` é
  decorativo (`mock-data.ts:476-524`). O cliente ofereceu explicar o modelo comercial — **aceitar a
  oferta antes de codar**. Envolve preço, parcelamento 12x e desconto à vista.
- **Modo noturno (v2 §4.3):** o cliente pergunta qual é o comportamento esperado. Resposta honesta:
  **não há dark mode**; `darkMode:["class"]` é scaffold do shadcn e nenhuma classe `dark:` existe.
  Implementar é um passe de design system inteiro, não um toggle.
- **Crop de imagem (v2 §1.2):** exige lib de crop (só-web) — precisa ficar confinada atrás de ponto
  trocável, como `campo-imagem.tsx`, por causa do React Native.
- **Logo + galeria do estabelecimento (v2 §1.7):** a página `/portal/estabelecimento` é **100%
  mock** — não lê nem grava no banco, e `estabelecimentos` **não tem coluna de imagem**. Fazer logo
  e galeria é: coluna(s) nova(s) + bucket/policies (padrão da migration 22/23) + ligar a página ao
  banco. É uma fase, não um campo.
- **Validação por CPF no portal (v2 §1.5):** o backend já existe inteiro (migrations 26/27) e é
  usado em `/e`. Portar `<ValidarPorCpf>` para o dialog do portal é barato — mas confirmar com o
  cliente que o portal web deve mesmo ter acesso a busca por CPF (é PII, e o rate limit é por
  `auth.uid()`).
- **Edição de cupom pelo admin (v1 §4, v2 §2.2):** o trigger da migration 20 **isenta o admin** da
  matriz de imutabilidade (`auth.uid()` nulo e admin escapam). Então habilitar edição no admin dá
  poder de reescrever cupom aprovado sem remoderação. Precisa de decisão: admin edita tudo, ou
  edita e o cupom volta para `pendente`?

---

## Onda A′ — suíte de QA

### Task 17: `scripts/test-qa-relatorios.ts`

**Files:**
- Create: `scripts/test-qa-relatorios.ts`
- Modify: `package.json` (scripts `test:qa` e `test:qa:hosted`, e `test:qa` entra no `verify`)

**Interfaces:**
- Consumes: `resolverAlvo` (`scripts/_alvo.ts`), `criarContaQa`/`destruirContaQa`/`encerrar`
  (`scripts/_qa-conta.ts`), padrão de `check(nome, ok, detalhe)` de `test-fase9.ts`
- Produces: nada

Segue o padrão da casa: conta `qa-*` efêmera (**nunca** `consumidor@`), PostgREST direto com sessão
real, `encerrar()` devolvendo o código (nunca `process.exit()` no meio — não roda `finally`).

Cobre duas naturezas de asserção:

**Comportamentais (banco):**
- [ ] ativação antecipada dentro do alcance → `ok:true`; `expira_em` ≤ fim da janela (Task 6)
- [ ] ativação fora de alcance → `motivo: 'fora_da_janela'`
- [ ] ativar cupom gera evento `clique` **e** `ativacao` (Task 4); tentativa recusada gera `clique`
      e **nenhuma** `ativacao` — é a asserção que prova cliques ≥ ativações
- [ ] NPS: promotor/detrator/neutro produzem `score = %prom − %detr` (regressão da migration 25)

**Estáticas (código) — o padrão já usado em `test-fase7`/`test-fase9`:**
- [ ] `src/app/m/page.tsx` não contém `i % 3` decidindo `ctaLabel` (Task 2)
- [ ] `src/app/portal/(painel)/page.tsx` — o botão "Novo cupom" tem destino (Task 1)
- [ ] `usuarios-client.tsx` não usa `cuponsUsados.join(", ")` (Task 3)
- [ ] `cupom-acao-usar.tsx` não registra mais `"clique"` no cliente (Task 4)

Asserção estática lê o arquivo e **remove comentários antes de casar** — em `test-fase9.ts:140-142`
isso foi necessário porque o cabeçalho cita a string antiga para explicar por que ela saiu.

- [ ] **Step final: Commit** — `test(qa): suite dos relatorios v1/v2`

---

## Self-review

**Cobertura:** todo item dos dois relatórios aparece na matriz com veredito. Os itens ✅ não geram
task (é o ponto do exercício); os ❌/🐞 geram task na Onda A–C ou especificação na D–F.

**Ordem de migrations:** produção tem 1–27, a 28 é local. Este plano usa **29** (clique) e **30**
(janela). Se a Onda B for adiada, a Task 4 fica com a 29 sozinha. As Tasks 11/12 e as Ondas D–E
pegam de 31 em diante. Nenhuma edita migration já empurrada.

**Risco de janela banco-antes-código** declarado nas Tasks 4 e 6 — as duas são `create or replace`
sem mudança de assinatura, então o código antigo continua chamando a função e recebendo contrato
compatível. A 29 tem contagem dupla de clique na janela; a 30 muda comportamento (aceita mais),
nunca menos — código antigo não quebra.
