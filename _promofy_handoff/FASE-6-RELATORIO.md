# FASE 6 — Relatório de Implementação (Higiene + Cupom)

*Branch: `fase-6-higiene-cupom` (a partir da `main`) · Data: 2026-08-02 · Status: **concluída e verificada local; NÃO está no ar***

> Duas ondas. **Onda 1** limpou os quatro achados que o smoke de 31/07 confirmou em produção
> (§12 do FASE-5) e a dívida crítica da suíte. **Onda 2** entregou o cupom com campos novos e
> economia variável.
>
> **Pendente da sua decisão:** `supabase db push` no hospedado e deploy, na coreografia
> banco-antes-código. Nada foi aplicado no ambiente do cliente.

---

## 1. O corte da Onda 2 (decidido antes de começar)

A Onda 2 pedida era de duas fases. O corte foi pelo **caminho de escrita**:

| | Escopo | Por quê |
|---|---|---|
| **Fase 6** (esta) | **C1** campos novos + **C3** economia variável | Só endurece o `INSERT` que já existia. Nenhuma RPC de escrita nova, nenhum subsistema novo. |
| **Fase 6.5** | **C2** editar · **C5** motivo de rejeição · **C4** upload/Storage | Abrem "mutar cupom que já nasceu" e compartilham a mesma superfície — o form de edição é onde a imagem mora, e o "editar e reenviar" do C5 depende do C2. |

## 2. Entregas (por commit)

| Commit | Entrega |
|---|---|
| `b6f9baa` | **H3** — folha do cupom e detalhe leem o banco, não o mock |
| `5ce2243` | **H1** — tabela "Regras de Uso" com a janela real + `src/lib/janela-formato.ts` + `test-fase6` |
| `95fc103` | **H2** — `/cadastro` deixa de ser 404 (página de escolha) |
| `7671d17` | **H5** — chips filtram de verdade; `/m/filtros` reduzido ao que existe |
| `eb8c1d5` | **H4** — suítes logam em conta `qa-*` efêmera + `scripts/_qa-conta.ts` |
| `428091e` | portas locais 5532x → 5542x (faixa reservada pelo Windows) |
| `99d3711` | **H1** — cupom sem janela estruturada diz o que o servidor aplica |
| `e5f41aa` | remove `resumoJanela` (copy de UI não pertence ao módulo puro) |
| `bb89dfc` | **DB** — migrations 16–19 (campos, ilimitado + `pode_reusar`, economia variável, status no insert) |
| `2f53a23` | **C1+C3** na aplicação (action, formulários, UI, provider) |
| `dbdda5b` | **testes** de banco da Fase 6 |
| `e9b2db3` | `EconomiaDTO`/`economiaDeJson` para `@/lib/economia` (restrição do `"use server"`) |

## 3. Critérios de aceite — como cada um foi provado

| # | Critério | Prova |
|---|---|---|
| H1 | Detalhe mostra a janela real, sem contradizer a barreira | `/m/cupom/c02` num domingo: tabela **"Hoje, Dom \| —"** e os dois botões `aria-disabled` + esmaecidos. 152 asserções de **paridade tabela↔barreira** |
| H2 | Nenhum link para `/cadastro` quebrado | Os 5 links → **200**; **zero erro de console** em toda a sessão de smoke |
| H3 | Validade da folha vem do banco | `c01` ativado: folha exibe **16/09** (banco), não 27/08 (mock) |
| H4 | Suítes em conta `qa-*` efêmera, provado local | `verify` verde; **0 contas penduradas**; `cupom_eventos` total 20475 = anônimos 20475 (**nenhuma linha deixada**) |
| H5 | Chips/filtros coerentes | `?cat=fitness`: 6 → **2 cupons**; `?cat=xpto` → 6 (não quebra); "Aplicar" → `/m/buscar?cat=beleza` |
| C1 | Campos novos persistem e aparecem no `/m` e `/e` | Suíte + smoke: folha mostra "No local e Retirada" e "Não inclui taxa de entrega" |
| C3 | "a partir de" / "mais de" e total correto | Smoke: card "Economize **a partir de** R$ 20,00"; resumo "**mais de** R$ 26,00" (6 fixo + 20 mínimo) |
| Geral | Suítes anteriores + novas verdes; build verde; zero regressão | `npm run verify` = **25+27+22+42+64+177 = 357 PASS, 0 FAIL** + `next build` 47 páginas |

**As 180 asserções das fases 1–5 seguem verdes sem uma única edição de assertiva.**

## 4. O achado que mudou o projeto antes da primeira linha de código

A revisão adversarial (4 lentes, cada achado submetido a um cético independente) produziu
**8 achados; 1 sobreviveu** — e ele era real. O plano dizia: "com `limite_por_usuario` NULL,
`usos.restantes` vem `null` e o selo 'utilizado' não aparece". **Os dois pedaços eram falsos**,
e a verificação no código provou por quatro caminhos independentes:

| Fato | Consequência |
|---|---|
| `greatest(u.limite - u.consumidos, 0)` com limite NULL → **GREATEST ignora NULL** | `restantes` viria **0**, não `null` — o valor que significa "acabou" |
| `cupom-selo-utilizado.tsx:35` fazia `if (uso.restantes > 0) return null` | `null > 0` **e** `0 > 0` são ambos `false` → **o selo RENDERIZA** no cupom ilimitado |
| `cupom-acao-usar.tsx:89` decidia só por `status === 'validado'` e **nunca lia `usos`** | Sendo o único ponto de ativação do app, não havia caminho de UI para a 2ª ativação: a feature subiria **inerte** |
| `UsoCupomDTO` tipava `restantes: number` e o jsonb entra por `as unknown as` | **`tsc --noEmit` passaria verde** com `null` em runtime |

**Correção — o predicado virou contrato de servidor.** `meu_estado_consumidor.usos` ganhou
`pode_reusar`, escrito como a **negação literal** da checagem de `ativar_cupom`: uma regra, uma
expressão. `restantes` passou a `case when limite is null then null else greatest(...)` e virou
**dado de exibição — nunca mais entra num `if`**. O `UsoCupomDTO` nullable foi a forçante: o
`tsc` reprovou exatamente em `cupom-selo-utilizado.tsx:35`.

Nome `pode_reusar` e não `pode_ativar` de propósito: é **só** a cota por usuário. Validade,
janela, `esgotado` e estabelecimento suspenso continuam sendo decididos por `ativar_cupom`, e
um nome mais largo convidaria o próximo call site — e o app nativo — a tratar o booleano como
admissão completa.

**Provado em runtime, não só em teste:** cupom ilimitado ativado → validado pelo lojista →
**sem F5**, o botão volta a oferecer "Usar cupom" (sem badge) → 2ª ativação abre a folha com
**código novo**; e na lista o ilimitado fica **sem** selo enquanto o de cota 1 fica **com** selo.

## 4.1 ⚠️ CONFIRMAÇÃO DE PRODUTO PENDENTE — o que "ilimitado" significa hoje

**Levar ao cliente antes de anunciar a funcionalidade.** O switch "Ilimitado por usuário"
entregue nesta fase é **literal e sem controle de periodicidade**:

- o consumidor pode ativar → validar → **ativar de novo em seguida**, sem intervalo mínimo;
- **cada validação credita os pontos de `resgate` e soma `economia` outra vez** — a dedupe do
  ledger é por linha de `cupons_usuario` (`referencia_id = v.id::text`), não por cupom, e
  `economia_consumidor()` soma por linha validada;
- consequência: num cupom ilimitado, pontos e "total economizado" do consumidor **não têm teto**,
  e é o lojista que paga a métrica.

**Não é farm de pontos:** `validar_cupom` exige o **lojista** validando no balcão e recusa
`cupom_proprio` — cada repetição é uma transação real que alguém do estabelecimento autorizou.

**O que o modelo NÃO cobre e é o caso que o cliente provavelmente quer:** periodicidade — "1
café por dia", "1 por semana". Isso **não existe** no schema: exige coluna nova
(`periodo_limite`) e uma janela de contagem em `ativar_cupom`. **É feature separada, está no
backlog da §14, e o switch desta fase não a promete.** Se a resposta do cliente for "na verdade
eu queria 1 por dia", o switch entregue aqui não atende e a Fase 6.5/7 precisa da periodicidade
antes de o cupom ilimitado ir para uso comercial.

## 5. As duas decisões de modelagem que precisam ficar registradas

**Taxas e formas de consumo em `jsonb`, não em colunas.** O vocabulário é do cliente e vai
mudar (já se falou em taxa de serviço em %, pedido mínimo); com coluna, cada palavra nova é uma
migration. Os dois campos são multivalorados por natureza, e já há precedente (`regras`,
`horarios`). **Sem `CHECK` de domínio, deliberadamente:** a Fase 5 mostrou que restringir jsonb
no banco transforma dado sujo em **exceção**, e exceção dentro de `security definer` sem bloco
`exception` vira 500 e deixa o cupom inativável. Quem garante o vocabulário é o servidor
(`src/lib/cupom-campos.ts`), e o saneamento roda **também na leitura** — as duas colunas estão
no grant de UPDATE do lojista, então o PostgREST direto pode gravar qualquer array. Provado nos
dois sentidos: lixo gravado por `service_role` some da tela, e `formas_consumo` como string vira
lista vazia em vez de exceção.

**`NULL` = ilimitado, o mesmo vocabulário nas duas colunas.** `limite_total` já era nullable e
já significava "sem teto" (10 dos 12 cupons do seed). Alinhar `limite_por_usuario` no mesmo
vocabulário evitou inventar um terceiro (booleano paralelo, ou sentinela `-1`) que precisaria
ser mantido em sincronia com o inteiro.

## 6. C3 — o número que o cliente já vê NÃO muda

Era o critério mais sensível da fase. Duas escolhas o garantem:

1. **`economia_variavel` nasce `false` para toda linha existente.** Cupom fixo é 100% do acervo,
   então "mínima garantida" e "economia" coincidem. Sem backfill, sem reinterpretação de dado.
2. **`economia_total_consumidor()` não foi tocada.** A funcionalidade nova entrou numa RPC
   **nova** ao lado, `economia_consumidor() → jsonb {total, inclui_variavel}`.

**Por que aditiva e não trocar o retorno:** mudar o tipo exigiria `drop function` + recriar. Na
coreografia banco-antes-código existe uma janela em que o banco novo roda com o **código antigo**
em produção, e o código antigo faz `Number(economiaData)` — com jsonb no lugar de numeric isso
vira `NaN`, e **todo consumidor logado veria "R$ NaN" na home** até o deploy terminar. Aditivo
custa uma função a mais; destrutivo custa a home do cliente durante a janela.

Duas asserções provam a não-regressão: com cupom fixo e com cupom variável,
`economia_consumidor().total` é **idêntico** a `economia_total_consumidor()`. E `test-fase3`
(que assere a RPC antiga) segue verde **sem uma linha editada** — compatibilidade de graça.

## 7. Extra de segurança (achado, não pedido)

A Fase 3 fechou o auto-publish do lojista **só no UPDATE**: `revoke update on table` + grant por
coluna sem `status`. O **INSERT nunca foi revogado** — `authenticated` mantinha o grant de tabela
e a policy checa apenas a posse, então bastava **criar** o cupom já com `status:'ativo'` em vez
de tentar promovê-lo depois. `test-fase3.ts:113` cobria só o caminho do UPDATE.

Fechado com **trigger**, não com `revoke insert` + grant por coluna: revogar a coluna `status`
quebraria a `criarCupomAction` atual (que manda `'pendente'` explícito) **durante a janela de
deploy**. O trigger é inerte para quem já manda o valor certo. Provado: INSERT do lojista com
`status:'ativo'` nasce `pendente`.

## 8. Duas armadilhas de ferramenta que a fase fechou

**`process.exit` não executa `finally`.** Todas as suítes chamavam `process.exit` **dentro** de
`main()`. Pôr `destruirContaQa` num `finally` que envolve o corpo **não rodaria no caminho de
sucesso** — a conta `qa-*` ficaria pendurada exatamente no ambiente que o H4 existe para
proteger. `main()` passou a devolver o código; quem sai é o chamador, depois da limpeza.
*(Este ponto foi descartado por um cético junto com um achado errado, e é verdade independente —
verificado em `test-rls.ts:264` e nas outras quatro suítes.)*

**Insert em lote no PostgREST exige as mesmas chaves.** Objetos com chaves diferentes falham
(PGRST102). O erro não estava sendo capturado e um `update` que casa 0 linhas devolve
`error: null` — resultado: 12 asserções passaram **vazias** na primeira rodada. Agora o erro do
insert é capturado e os updates encadeiam `.select()`.

## 9. Verificação

**`npm run verify` do zero:** `db:reset` (19 migrations + seed + seed-users) → RLS **25** ·
Fase 2 **27** · Fase 3 **22** · Fase 4 **42** · Fase 5 **64** · Fase 6 **177** = **357 PASS,
0 FAIL** → `next build` **47 páginas**. `tsc --noEmit` e `next lint` limpos.

**Smoke em runtime (dev + Playwright), não só build** — a lição da Fase 3 valeu **duas vezes**
nesta fase: (a) o `next build` reprovou `economiaDeJson` exportada de um `"use server"` ("Server
actions must be async functions"), coisa que o `tsc` aceita; (b) o smoke encontrou o `c07`
(§10). Roteiro coberto: janela real dentro e fora, cupom legado, `/cadastro` e landings sem erro
de console, chips e "Aplicar", folha com validade do banco, cupom só-do-banco, ilimitado ponta a
ponta, "a partir de" e "mais de".

**Ambiente devolvido ao estado do seed:** 0 fixtures de smoke, 0 contas `qa-*`.

## 10. Achado do smoke que virou correção

`c07` tem só `horarios.descricao` livre ("Seg a Sáb, 10h às 22h") e **nenhuma** restrição
estruturada — o servidor não barra nada. Exibir apenas a frase do lojista recriava, por outra
fonte, exatamente a contradição que o H1 existe para matar: num domingo o texto dizia "Seg a
Sáb" com o botão ativo e a RPC aceitando. O bloco passou a afirmar a regra que o app aplica
("Sem restrição de horário no app") e a mostrar a descrição como informação do estabelecimento.

## 11. IMPACTO NA MIGRAÇÃO NATIVA

Princípio permanente: regra no servidor, lógica pura em `src/lib` sem API de navegador, só-web
isolado atrás de ponto trocável.

**Contratos de servidor que o RN herda prontos — o ganho maior desta fase:**
- **`pode_reusar`** em `meu_estado_consumidor.usos`. Sem ele, o app nativo copiaria a mesma
  divergência que a web tinha: derivar "ainda posso usar?" no cliente e errar em `null`/`0`.
  A Fase 5 já exportou `getUsos` como padrão a repetir — agora o padrão vem com a decisão dentro.
- **`economia_consumidor() → {total, inclui_variavel}`**. O "mais de R$ X" é decisão de servidor;
  o RN lê o mesmo jsonb e escreve a mesma frase.
- **`taxas` / `formas_consumo`** com vocabulário canônico e saneamento em módulo puro.
- O motivo `limite_usuario`, a barreira de janela e o `pontos_resgate` seguem valendo.

**Módulos puros novos, reaproveitáveis como estão (sem DOM, sem `server-only`, sem `Intl`):**
- `src/lib/janela-formato.ts` — descreve a janela; import relativo de `./dias` de propósito.
- `src/lib/cupom-campos.ts` — vocabulário + saneadores + `listarPtBr` (escrito à mão em vez de
  `Intl.ListFormat`: a Fase 5 registrou `Intl` como a dependência mais frágil no Hermes, e duas
  palavras não justificam o risco) + `rotuloEconomia`, que recebe o valor **já formatado** para
  a formatação de moeda (que usa `Intl`) ficar fora da camada pura.
- `src/lib/economia.ts` — parser do jsonb da RPC.

**Só-web, cada um isolado num ponto de troca:**
- `HomeCategoryChips` virou `<Link href="/m?cat=…">`: a query string é rota web, mas **o
  contrato é "categoria entra na consulta"** — no RN vira parâmetro de tela sobre a mesma query.
- `src/app/cadastro/page.tsx` é landing web por natureza; não vaza para o app.
- O `sheetCupom` passado por prop ao provider é o padrão que o RN repete: a tela que abre a
  folha já tem o objeto.

**Cuidado herdado e ainda válido:** validar `Intl` com `America/Sao_Paulo` no Hermes antes de
confiar em `dentroDaJanela` no cliente nativo.

## 12. Riscos e o que decidir antes do deploy

1. **Gates de leitura no hospedado, ANTES do `db push`** (o `_baseline-hosted.ts` já é
   somente-leitura e é onde isso entra):
   - `select count(*) from cupons where prazo_ativacao_horas < 5` deve ser **0** — senão o
     `validate constraint` da migration 16 reprova o push;
   - `select count(*) from cupons where limite_por_usuario is null` deve ser **0** antes e depois.
2. **Regra da janela banco-antes-código:** a migration 17 **não faz backfill** de
   `limite_por_usuario` para NULL, em hipótese nenhuma. `drop not null` não altera dado e só o
   código novo envia `null`. Com backfill, todo consumidor que já validou aquele cupom veria o
   selo "Utilizado" mentiroso enquanto o código antigo estivesse no ar.
3. **Rollback só de código** (com o banco novo) devolve o comportamento da Fase 5, porque
   `pode_reusar` ausente é lido como `false` (`=== true`, nunca `!== false`).
4. **"Ilimitado" é literal.** O lojista honra o cupom quantas vezes quiser, e **cada validação
   credita os pontos de resgate e soma economia de novo** (a dedupe do ledger é por linha de
   `cupons_usuario`). Não é farm: `validar_cupom` exige o **lojista** validando no balcão e
   recusa `cupom_proprio`. O que o modelo **não** cobre é periodicidade ("1 café por dia") —
   está no backlog.
5. **Portas locais mudaram** (5532x → 5542x) porque o Windows reservou 55012–55411. Afeta só
   o ambiente de desenvolvimento; `.env.local` já foi ajustado.

## 13. Deploy — coreografia executada em 03/08/2026

Banco antes do código, cada passo com OK explícito. **Concluído: a Fase 6 está no ar.**

### Passo 0 — gates de leitura (antes de tudo)

`scripts/_baseline-hosted.ts` (somente-leitura, conferido linha a linha antes de rodar; alvo
confirmado como `bpeqpxvxgdyjjdcoycgp`):

| Gate | Antes | Depois do push |
|---|---|---|
| `cupons` com `prazo_ativacao_horas < 5` | **0** | 0 |
| `cupons` com `limite_por_usuario is null` | **0** | **0** (a migration 17 não faz backfill — regra, não acaso) |

Baseline capturado: `consumidor@` 1410 · `convidado@` 1460 · cupons 20 · estabelecimentos 6 ·
`cupons_usuario` 10 · `favoritos` 2 · `cupom_eventos` 20514 · `profiles` 5.

### Passo 1 — migrations 16–19 no hospedado

**`supabase db push --linked` direto — sem `migration repair`.** Na Fase 5 o push não estava
disponível e foi preciso o desvio via MCP + `repair`, cuja prova de fidelidade era justamente
"a linha ficou idêntica à que um `db push` teria gravado". Desta vez o CLI alcançou o remoto
(`migration list --linked` e `--dry-run` confirmaram antes de qualquer escrita), então usou-se
o caminho canônico: versão e `statements` gravados nativamente, **zero passos corretivos**.

> **Registrar como caminho padrão daqui em diante:** verificar `migration list --linked` e
> `db push --dry-run` primeiro; havendo conectividade, `db push` direto. O par MCP + `repair`
> é o plano B para quando o CLI não alcançar o banco.

Resultado: as 4 aplicaram em ordem, sem erro (o único `NOTICE` foi o `drop trigger if exists`
da 19 numa primeira aplicação). `migration list` mostra as 4 com **Local e Remote preenchidos**
e versões idênticas às dos arquivos; `db push --dry-run` responde *"Remote database is up to
date"*. Todas as contagens e as duas contas do cliente ficaram **idênticas ao baseline**.

Schema conferido no ar: `taxas`/`formas_consumo` (jsonb not null), `economia_variavel`,
`limite_por_usuario` **nullable**, `CHECK (prazo_ativacao_horas >= 5)`, trigger
`trg_cupons_status_pendente` habilitado, e **as duas RPCs coexistindo** (`economia_consumidor`
jsonb + `economia_total_consumidor` numeric).

**A janela de deploy foi medida, não suposta.** Com o banco já na Fase 6 e o código da Fase 5
ainda no ar, logado como `convidado@`: `economia_total_consumidor` devolveu **162** (idêntico
ao que o cliente via), `economia_consumidor` devolveu `{total:162, inclui_variavel:false}`, e
`usos[]` já trazia `pode_reusar` como campo extra — que o código antigo simplesmente ignora.
É exatamente a razão de a RPC nova ser **aditiva** em vez de trocar o tipo de retorno.

### Passo 2 — merge e build

`merge --no-ff` → `main` → push `23846ac..45ce99c`. Deployment
**`dpl_FAXnfb23JhdkxUbfL7S8HSzCuT4B`** (commit `45ce99c`): build **READY em 39s**, 47 páginas,
`promofy-pro.vercel.app` apontando para ele.

**Correção de premissa registrada:** o plano falava em fazer rollback para o commit `8486863`,
mas ele era um commit **só de documentação que nunca havia sido enviado** — `origin/main`
estava em `23846ac`, e era **esse** o deployment em produção
(`dpl_12rbY3gTHaFSSzNj3mdPys35VkWa`, `isRollbackCandidate: true`). O commit de docs subiu junto
neste push. Segundo candidato disponível: `dpl_AxT2JZeW3UwhKQMhXVaZDsfo3G3R` (Fase 4,
`05c3071`). Rollback não foi necessário.

### Passo 3 — smoke em produção (`convidado@`; `consumidor@` nunca tocado)

| | Verificação | Resultado |
|---|---|---|
| a | Economia de conta só-fixos | **R$ 162,00 exato, sem "mais de"** — o número do cliente não se moveu |
| b | **Ataque de moderação** | `INSERT` direto via PostgREST como `lojista@` forçando `status:'ativo'` → **nasceu `pendente`**. O trigger da migration 19 provado **em produção** |
| b | Cadastro pelo formulário `/e` | rótulo virou "Economia mínima garantida"; cupom listado "Em análise" com "a partir de R$ 8,00", "No local e Retirada", "Não inclui taxa de entrega e taxa de serviço", "Ilimitado por cliente" |
| b | Folha `/m` | "Estou economizando **a partir de** R$ 8,00", seção "Formas de consumo", "O benefício não cobre…" |
| c | Ilimitado ponta a ponta | ativar → validar → **sem F5 o botão voltou a oferecer** → 2ª ativação com **código novo** (`AHR7-W5AQ` → `S7U4-RP97`) |
| c | Selo | ilimitado validado **sem** selo; `c01` (cota 1, validado) **com** selo e sem botão — a discriminação que `pode_reusar` entrega |
| e | "mais de" | **"mais de R$ 170,00"** (162 + 8 do mínimo garantido). Pontos 1.460 → 1.510 |
| d | Fase 5 | janela real no `c01` (Ter–Dom 18:00–23:00, Seg "—", "Hoje, Dom") · `/cadastro` 200 · animação de pontos · validação por código |
| d | Fase 4 | busca (10 cupons) · chips de dia com "Dom hoje" · favoritos (2) · novidades e estabelecimentos 200 · multi-categoria no `/e` |
| d | H5 | home 12 cards → Beleza 4 · `?cat=xpto` 200 sem quebrar · `/m/filtros` "Aplicar" → `/m/buscar?cat=fitness` |

**Zero erro de console** em toda a sessão.

### Estado final dos ambientes

- **Hospedado:** Fase 6 aplicada. **`consumidor@` intocado** (1410, 3 linhas, 1 favorito —
  idêntico ao baseline). **`convidado@` 1510**, 9 linhas de ciclo (7 do baseline + 2 do cupom
  de teste), 1 favorito — rastro esperado, é conta de demonstração.
- **Vercel:** `45ce99c` em produção.
- **Catálogo: 21 cupons** (era 20). O cupom do ataque foi removido; ficou **um**, renomeado
  para a vitrine (ver abaixo).
- **Local:** `verify` verde do zero; banco no estado do seed.

### Cupom-exemplo que ficou no catálogo

**`Café do dia`** (`84e451a7-7cef-485d-9f66-6ccb8760b1b6`, Sabor & Cia) — ativo, R$ 8
**variável**, **ilimitado por usuário**, taxas entrega+serviço, formas no local+retirada. É o
único cupom que exercita os três recursos novos ao mesmo tempo, do mesmo jeito que o `c01` é a
demonstração viva da barreira de janela.

Renomeado após o smoke (id e as 2 linhas de histórico do `convidado@` preservadas): título
"F6 smoke — café do dia" → **"Café do dia"**; benefício → "Um expresso por visita — sem limite
de uso". Jargão técnico não aparece na vitrine do cliente.

**Achado durante a renomeação:** o bloco "Benefícios Exclusivos" do detalhe mostrava o texto
**duplicado**, porque `criarCupomAction` copia o benefício para `regras` (`regras: [beneficio]`)
e a tela concatena os dois. É **pré-existente** (vale para todo cupom criado pelo formulário,
desde a Fase 2) e não é regressão desta fase. Contornado no dado deste cupom (as `regras`
passaram a complementar: "Não acumulável com outras promoções."); a correção de código está no
backlog.

## 14. Backlog

**Limpo nesta fase:** 12.1 (horário falso) · 12.2 (`/cadastro` 404) · 12.3 (chips e filtros —
**parcial**: chips e as duas seções com lastro filtram de verdade; o filtro completo depende da
taxonomia) · 12.4 (validade divergente) · dívida da suíte-armadilha · auto-publish no INSERT.

**Fase 6.5 (cortada de propósito, na ordem em que se encaixam):**
- **C2 — editar cupom.** RPC de edição restrita ao dono + admin; imutabilidade pós-resgate
  (não reduzir limite abaixo do já consumido); política de re-moderação quando a edição for
  material. Desenho já existe em `docs/modelo/estabelecimento-mobile/Cupons ativos.png`
  (ícones lápis/lixeira). É o pré-requisito dos outros dois.
- **C5 — rejeição com motivo.** Coluna de motivo + `rejeitar_cupom` estendida (mudar a
  assinatura exige `DROP FUNCTION` + recriar, e **o `EXECUTE` precisa ser reconcedido**);
  motivo visível ao lojista, que **edita e reenvia** — e é aí que depende do C2.
- **C4 — upload de imagem/Storage.** Liga o Supabase Storage pela 1ª vez (hoje
  `[storage] enabled = false` no `config.toml`, sem bucket em migration nenhuma). Bucket
  dedicado, políticas dono-only provadas por teste negativo, validação de tipo/tamanho no
  servidor, input de arquivo isolado atrás de ponto trocável (no nativo vira picker/câmera).
  ⚠️ O `config.toml` registra que o container `storage-api` é instável no Windows — vale
  verificar isso antes de planejar a fase.

**Resta:** taxonomia Segmento→Categoria e o filtro completo (localização, promoção, frequência,
valor, relevância — as 5 seções removidas de `/m/filtros`) · validação por identidade nome+CPF ·
mural/indicadores no `/e` · destaque/banner no admin · exportar relatórios · animações
adicionais · relatório de NPS do lojista · QR scanner real · `/admin/configuracoes` salvando
`config_pontos` · `validar-cupom-dialog` sem o motivo `esgotado` · ~20 hex amarelos fora dos
tokens · assets órfãos em `public/lp/consumidores/`.

**Novos, achados nesta fase:**
- **⚠️ Periodicidade de uso ("1 por dia") — PENDENTE DE DECISÃO DO CLIENTE.** É o que o switch
  "Ilimitado" *não* cobre (ver §4.1): hoje "ilimitado" é literal, sem intervalo, e cada
  validação credita pontos e soma economia de novo. Precisa de coluna nova (`periodo_limite`)
  e de uma janela de contagem em `ativar_cupom`. **Se a resposta do cliente for "eu queria 1
  por dia", o switch entregue na Fase 6 não atende** e a periodicidade precisa entrar antes de
  o cupom ilimitado ir para uso comercial.
- **Benefício duplicado no detalhe.** `criarCupomAction` grava `regras: [beneficio]` e
  `/m/cupom/[id]` concatena `beneficio` + `regras[0]` — quando são o mesmo texto, a tela repete.
  Pré-existente desde a Fase 2; visível em todo cupom criado pelo formulário. Correção: ou a
  action para de copiar, ou a tela deduplica. Contornado no dado do cupom-exemplo.
- **Auto-cadastro de empresa** — o desenho já existe em
  `docs/modelo/estabelecimento-mobile/Cadastro-1..5.png` (razão social, CNPJ, ramo, documento,
  responsável). O H2 deliberadamente **não** o implementou: o papel `lojista` só é atribuído por
  `service_role`, e auto-cadastro abre superfície de auth que é fase própria.
- **Edição/exclusão de cupom pelo lojista** — desenho em
  `docs/modelo/estabelecimento-mobile/Cupons ativos.png` (ícones lápis/lixeira) → é o C2.
- **`cupom_eventos` do seed são todos anônimos** (20475 linhas sem `usuario_id`), o que torna
  as métricas absolutas de `test-rls.ts:109` estruturalmente frágeis no hospedado — registrado,
  não corrigido.
