# Adendo da reunião de 05/08 — relatório (WP AD-1R, isolado)

> **Branch:** `fix/adendo-0508-finalizacao`, criada **a partir da `main`** (`f978d0c`).
> **Taxonomia fora de escopo.** Nenhuma linha de `categorias`, `categorias_folha` ou
> `cupons.categoria_folha_id` nesta branch.
> **Nada saiu da máquina:** sem push, sem PR, sem `db push`, sem hospedado, sem QA, sem deploy.

---

## 1. Branch, commits e prova de isolamento

| Commit | O quê |
|---|---|
| `4c0dbe6` | Z3 — depoimentos fictícios saem do `/m/cupom/[id]`; avaliação é do estabelecimento |
| `d8f35a4` | NPS ganha a terceira saída ("não responder") — migration, card, provider, action, testes |
| `8dfbd43` | Relatório dos itens 1–4, backlog da Fase 10, "1 por dia" arquivado |
| `84411c1` | **Correções da auditoria**: "não responder" vira regra de servidor + estado conhece a recusa |
| `f80aba3` | **Prova social fictícia sai das três superfícies públicas** |

**`c4f8ae0` (taxonomia E1) NÃO está na branch** — provado, não afirmado:

```
$ git merge-base --is-ancestor c4f8ae0 HEAD  &&  echo SIM || echo NAO
NAO

$ git diff --name-status main..HEAD -- supabase/migrations
A       supabase/migrations/20260821120000_adendo_nps_recusa.sql

$ ls scripts/test-fasee1.ts
ls: cannot access 'scripts/test-fasee1.ts': No such file or directory
```

Uma única migration nova; `test-fasee1.ts` não veio; `package.json` intocado (o `verify` desta
branch é o da `main`, com 14 suítes); `promofy.xml` continua **untracked**, como estava.

### Arquivos modificados (16, `git diff --stat main..HEAD`)

```
 MIGRATIONS.md                                      |  64 ++
 _promofy_handoff/ADENDO-0508-RELATORIO.md          | 212 ++
 scripts/adendo-cpf-consumidor.ts                   | 144 ++
 scripts/test-fase8.ts                              |  20 +-
 scripts/test-fase9.ts                              | 205 ++
 src/app/m/cupom/[id]/page.tsx                      |  37 +-
 src/app/page.tsx                                   |   3 -
 src/app/para-empresas/page.tsx                     |  75 +--
 src/app/para-voce/page.tsx                         |  74 +--
 src/components/coupon-state-provider.tsx           |  62 +-
 src/components/cupom-ativo-sheet.tsx               |   8 +-
 src/components/landing/sections.tsx                |  41 +-
 src/components/nps-pendente-card.tsx               | 116 +-
 src/lib/actions/cupons.ts                          |  36 +
 src/lib/supabase/database.types.ts                 |   4 +
 supabase/migrations/20260821120000_adendo_nps_recusa.sql | 355 +
```

*(o relatório e a migration aparecem com o tamanho cheio porque são arquivos novos)*

---

## 2. Z3 — avaliação não pertence ao cupom

O `/m/cupom/[id]` exibia um `FeedbackCarousel` alimentado por `mock-data.avaliacoes`: "Mariana
Alves" e "Rafael Souza", textos que ninguém escreveu, colados a um cupom **real**.

O commit preparado dizia *"ainda sem avaliações deste cupom… assim que houver respostas, elas
aparecem aqui"*. A decisão da reunião é o contrário — **feedback nunca volta ao cupom** —, então o
estado honesto foi reescrito para não prometer uma tela que, por decisão de produto, não vai
existir:

> **Cupom não recebe avaliação**
> Quem resgata avalia o estabelecimento, e não a oferta. É no perfil do estabelecimento que essas
> avaliações ficam.

Preservado, item a item: avaliação não pertence ao cupom · cupom não mostra depoimento · **não** foi
posto NPS do estabelecimento no lugar · o sistema futuro é do estabelecimento · `FeedbackCarousel`
fica no repositório **sem uso** (`grep -rn "FeedbackCarousel" src/` devolve só a própria definição) ·
nenhuma fonte falsa nova.

---

## 3. NPS — o contrato final

Migration **35** (`20260821120000_adendo_nps_recusa.sql`) — a única nova da branch.

| Saída | Peso | O que faz |
|---|---|---|
| **Responder** | primária | `responder_nps` — grava a nota e credita os pontos |
| **Responder mais tarde** | discreta | some **desta sessão**, volta na próxima abertura — **nada gravado** |
| **Não responder** | discreta | **encerramento definitivo**: grava `nps_recusado_em`, sai da fila para sempre, **sem pontos** |

### 3.1 As duas direções fechadas **no servidor**

A auditoria pegou o buraco: `recusar_nps` tirava a linha da fila, mas `responder_nps` **continuava
aceitando nota nela**. "Definitivo" que só existe no React não é definitivo — bastava chamar a RPC
com o `row_id` para ressuscitar a pesquisa, gravar a nota e levar os pontos que a recusa dizia não
creditar.

| Sequência | Resultado |
|---|---|
| responder → responder | `ok: true`, `ja_respondido: true`, `pontos: 0` — **idempotente**, vale a primeira nota |
| responder → **recusar** | `ok: true`, `ja_respondido: true` — **não marca recusa** |
| recusar → recusar | `ok: true`, `ja_recusado: true` — **preserva o carimbo da PRIMEIRA** recusa |
| recusar → **responder** | `ok: false`, `motivo: 'nps_recusado'` — **nada escrito, nada creditado, nada no ledger** |

`'nps_recusado'` segue o vocabulário da casa (`nao_validado`, `nao_encontrado`, `cpf_invalido`,
`limite_usuario`). **Ordem dos ramos deliberada:** `nps is not null` vem **antes** da recusa, para
preservar byte a byte a idempotência que já estava no ar.

**Ownership** em ambas as RPCs: `where id = p_row_id and usuario_id = auth.uid() ... for update`. A
resposta para pendência alheia é `nao_encontrado` — a mesma de "não existe", sem oráculo. Ambas
`security definer` com `search_path = ''`, objetos schema-qualified, `revoke ... from public, anon`,
`grant ... to authenticated`.

**Pontos e ledger:** `recusar_nps` não tem `insert` em `pontos_transacoes` — não há como um clique em
"Não responder" creditar nem animar "+N". A asserção conta **linhas** do ledger, não saldo (dois
lançamentos que se anulassem dariam o mesmo saldo).

### 3.2 O estado do consumidor conhece a recusa

`estado_cupom_json` devolvia só `nps`, e `nps = null` mistura **"ainda pode responder"** com
**"encerrou de vez"**. A função ganha `nps_recusado_em` (chave nova, aditiva); o DTO, o provider e a
folha do cupom carregam o campo, e o CTA "Avaliar experiência" passa a exigir
`nps === null && npsRecusadoEm === null`.

**Isso é UX. A autoridade é a RPC** — e agora ela nega de verdade (3.1). O provider também carimba a
recusa no mapa de estados no momento em que ela é aceita, senão a folha seguiria oferecendo
avaliação até o próximo reload.

### 3.3 Fila com múltiplas pendências

Uma por vez, **mais recente primeiro** — antes garantido por leitura do SQL, agora **medido**: duas
pendências convivem, a mais recente é a cabeça, recusar a cabeça promove a seguinte, responder a
última esvazia a fila.

### 3.4 A tela

O "X" do canto saiu. Com duas saídas de significados opostos ("volta amanhã" e "nunca mais"), um
ícone ambíguo no canto era a pior forma de escolher entre elas — o dedo cai ali por reflexo. As duas
ganharam nome, e "Não responder" pede **confirmação inline** (não modal), dizendo as duas
consequências: não volta, e não credita. A linha só sai da fila local **depois** do `ok` do servidor.

---

## 4. Depoimentos fictícios — três superfícies públicas

**Regra aplicada:** dado inventado em tela real não é placeholder, é mentira ativa.

| Superfície | O que havia | Evidência de que era invenção | Ação |
|---|---|---|---|
| `/` (home) | `LandingReviews` com `mock-data.avaliacoes` — "Mariana Alves", "Rafael Souza", "Camila Ferreira", **assinando estabelecimentos reais** ("Sabor & Cia", "PowerFit Academia") | o array é mock versionado (`src/lib/mock-data.ts:561`) | **removida** |
| `/para-empresas` | faixa "Depoimentos de Parceiros": "Lanchonete Graciosa · Palmas-TO", "Restaurante do Chef · Palmas-TO", 5 estrelas, *"meu movimento cresceu 40%"* | **o modelo do Figma do cliente** (`src/images/lp-estabelecimentos/lp-modelo-estabelecimentos.png`) reserva a faixa com dois cards de **placeholder** rotulados **"Restaurante exemplo"** e texto de preenchimento — o cliente **não** entregou depoimento; o texto foi escrito por nós no commit `3a31c7f` | **removida** |
| `/para-voce` | `REVIEWS`: "Mariana A. · Palmas-TO", "Juliana R. · Palmas-TO", *"economizei mais de R$ 200 no primeiro mês"* | o modelo (`src/images/lp-consumidores/modelo-lp-consumidores.png`) mostra **"Nome exemplo lorem"** + lorem ipsum; e é a **mesma persona** que saiu do mock | **removida — ver ressalva** |

> **RESSALVA, para o líder decidir.** `/para-voce` **não foi nomeada no WP**. Removi porque é
> idêntica em tipo, origem, autoria e prova às duas que foram nomeadas, e manter a mesma persona
> falsa a uma página de distância das que acabaram de ser limpas seria contradição, não escopo.
> **Reverter é um comando** (`git revert` parcial ou restaurar o bloco do `f80aba3`).

**Nada foi colocado no lugar** — e isso é deliberado: outro nome, uma frase genérica, um número de
"usuários satisfeitos" ou o NPS disfarçado de depoimento seriam a mesma mentira com roupa nova.
Enquanto não houver depoimento **real**, com autorização de quem falou, as seções não existem.

**Consequência visual, declarada:** na home a seção `frentes` passa a encostar na `LandingCta`, que
carrega o próprio cartão `bg-primary` e já fazia a quebra sozinha; na `/para-empresas` a faixa
amarela do CTA logo acima continua sendo o destaque de cor; **a `/para-voce` perde sua única faixa
amarela cheia**, entre Planos e FAQ. Re-equilibrar cor é decisão de design, não de conteúdo — não
inventei seção nenhuma para tapar o buraco.

`ReviewCard` fica no repositório **sem uso**, como o `FeedbackCarousel`.

**Não virou faxina geral de mock-data:** `landingStats`, `cupons`, `planos`, `resgatesMensais`,
`funilConversao` e os KPIs do dashboard **continuam onde estavam**. O que saiu foi prova social
atribuída a pessoas e a estabelecimentos.

---

## 5. CPF — estado conhecido, **sem escrita nesta rodada**

Nada foi executado contra o hospedado neste WP. O que a medição anterior (29/08) já provou:

| campo | valor |
|---|---|
| perfil | `consumidor@promofy.test` — Lucas Orlandi |
| `cpf` guardado | `"123.456.789-09"` (formatado) |
| DV | **válido** (`cpfValido` e `cpf_dv_valido` concordam) |
| origem | é o `CPF_DEMO` do `scripts/seed-users.ts:44` — sintético, versionado |
| ambiguidade | nenhum outro perfil usa esses dígitos |
| escrita necessária | **nenhuma** — antes → depois: sem mudança |

O formato com pontuação não atrapalha: `buscar_ativacoes_por_cpf` compara
`regexp_replace(p.cpf,'\D','','g')` (migration 26) e `mascarar_cpf` normaliza igual (migration 6).
Isso deixou de ser leitura de código e virou asserção em `test-fase8` (CPF guardado formatado
continua sendo encontrado, e a máscara sai correta).

Para a demo: digitar `123.456.789-09` (ou `12345678909`); a máscara devolvida é `123.***.***-09`.
`scripts/adendo-cpf-consumidor.ts` **confere** e só oferece escrita (com `--aplicar`) se o perfil
estiver sem CPF utilizável.

---

## 6. "1 por dia" — ARQUIVADO

O cliente confirmou o modelo atual: **limites de uso são estratégia do estabelecimento, e
"ilimitado" é intencional**.

A pendência nasceu na Fase 6, quando o switch "Ilimitado" entregou `limite_por_usuario` (nulo =
ilimitado), e foi carregada como ⚠️ nos relatórios das Fases 6, 6.5, 7 e 8 sempre com a mesma frase:
*"se a resposta for 'eu queria 1 por dia', o switch entregue não atende"*. **A resposta veio, e é
não.** O que existe hoje — limite por usuário, limite total e janela de consumo — é o modelo
desejado. A pendência fecha **sem código**.

---

## 7. Backlog da Fase 10 — registrado, **não implementado**

| # | Item | Notas |
|---|---|---|
| a | **Avaliações do estabelecimento**: estrelas 1–5 públicas; texto privado (estabelecimento + admin); moderação pelo admin com justificativa ao consumidor; sem réplica | **Decisão pendente:** derivar as estrelas do NPS (0–10 → 1–5) ou sistema próprio. Derivar economiza uma pesquisa, mas mistura duas perguntas ("indicaria?" ≠ "quantas estrelas?"). É aqui que `FeedbackCarousel` e `ReviewCard` voltam a ter uso |
| b | **Dias × validade coerentes** no cadastro de cupom | Validação **no banco**, não só no formulário — o lojista fala PostgREST |
| c | **Código em caixinhas 4-4** com hífen fixo e pulo automático no `/e/validar` + máscara de CPF | `<button>` cru em `<form>` é submit, e `type="button"` não cobre o Enter (CLAUDE.md §4) |
| d | **Cadastro direto de estabelecimento** com fila anti-fraude no admin | Toca RLS e onboarding — o mais pesado da lista |
| e | **Edição de cupom pelo ADMIN** | Reaproveita `montarPatchCupom`/`cupom-campos`; muda quem pode e o histórico de moderação |
| f | **Congelamento da animação de pontos** visto na demo | Suspeito: `pontos-pop` remontado por `seq` durante um poll |

---

## 8. Verify

`npm run verify` na branch, alvo **local**, log completo em
`…/scratchpad/verify-ad1r.log`.

| Métrica | Valor |
|---|---|
| **`VERIFY_EXIT`** | **0** (lido do `verify`, nunca de um `tail` — CLAUDE.md §4) |
| Suítes | **14** (`rls, fase2, fase3, fase4, fase5, fase6, fase65, fase7, fase8, fase9, fase9c, fase9d1, fase9d2, qa`) + `db:reset` + `next build` |
| Asserções PASS | **750** (`grep -c '^  PASS  '` = 750, idêntico à soma das 14 linhas "Resultado") |
| FAIL | **0** (`grep -c '^  FAIL'` = 0) |
| Build | `Creating an optimized production build` → `Compiled with warnings` → `✓ Generating static pages (50/50)` |
| Lint/typecheck | dentro do `next build`: "Linting and checking validity of types…" — só **warnings pré-existentes** de `<img>` (4 arquivos, nenhum deles tocado aqui) |

Resultado por suíte: `rls 25 · fase2 28 · fase3 22 · fase4 42 · fase5 64 · fase6 177 · fase65 44 ·
fase7 31 · fase8 57 · fase9 57 · fase9c 72 · fase9d1 87 · fase9d2 20 · qa 24` — **todas com 0 FAIL**.

> **Sobre o "Compiled with warnings".** O aviso é `A Node.js API is used (process.version) which is
> not supported in the Edge Runtime`, com import trace `@supabase/supabase-js → @supabase/ssr →
> src/lib/supabase/middleware.ts`. **Nenhum arquivo desse trace foi tocado nesta branch**
> (`git diff --name-only main..HEAD` não lista `middleware.ts` nem `next.config.mjs`); é emissão
> dependente de cache de build do webpack, não regressão do adendo.

As asserções novas do NPS (`[Z1b]` e `[Z1c]`), todas verdes:

```
PASS  "responder mais tarde" não grava nada — a fila reoferece na próxima leitura
PASS  recusar a pendência de outra pessoa é recusado
PASS  "não responder" é aceito
PASS  recusada, a pendência SAI da fila para sempre
PASS  recusar NÃO credita pontos
PASS  a recusa fica carimbada e a nota continua nula
PASS  recusar de novo é idempotente e preserva o carimbo da PRIMEIRA recusa
PASS  recusar uma já respondida não marca recusa nem mexe na nota
PASS  PostgREST não consegue desfazer a recusa por PATCH (sem grant de UPDATE)
PASS  responder DEPOIS de recusar é recusado com motivo próprio
PASS  …e a nota continua NULL (nada foi gravado)
PASS  …e a recusa continua carimbada
PASS  …e o saldo não muda
PASS  …e o ledger não ganha lançamento de nps
PASS  estados[] expõe nps_recusado_em para a linha recusada
PASS  …e a linha RESPONDIDA sai com nps preenchido e recusa nula
PASS  as DUAS pendências convivem na fila
PASS  a mais RECENTE vem primeiro (B antes de A)
PASS  recusada a cabeça, a fila passa a oferecer a SEGUINTE
PASS  NPS normal continua respondendo e creditando UMA vez depois de tudo isso
PASS  respondida a última, a fila fica vazia
```

Nenhum teste foi apagado, afrouxado ou mascarado. `database.types.ts` foi regenerado do banco local
(**966 linhas**, sem `categorias_folha`) com `--db-url` explícito — ver risco R3.

---

## 9. Riscos restantes

| # | Risco | Estado |
|---|---|---|
| R1 | **A migration 35 não está no hospedado.** A preview fala com o banco de produção: enquanto ela não for aplicada, "Não responder" existe na tela e a RPC não existe no banco — o botão erra com "Não foi possível encerrar agora". | Esperado. Banco antes do código, com OK por passo. |
| R2 | **Asserção por regex na fonte do provider** (o "dispensar não chama action") quebra com reformatação. | Aceito: é auxiliar; ao lado dela há a prova comportamental (a fila reoferece). |
| R3 | **`npm run db:types` truncou `database.types.ts` para 0 linha**: `supabase gen types --local` conectou na porta **5432** (outra stack Docker) e o `>` do npm escreveu o resultado vazio. Regenerei com `--db-url postgresql://…@127.0.0.1:55422/postgres`. | O `wc -l` que o CLAUDE.md manda conferir é o que pegou. **Vale corrigir o script** em WP próprio — não mexi aqui por disciplina de escopo. |
| R4 | `/para-voce` perdeu sua única faixa amarela; a página fica com um trecho longo sem respiro de cor. | Declarado em §4. Decisão de design, não de conteúdo. |
| R5 | O `NpsDialog` (fluxo ao vivo) mostra erro genérico se a RPC recusar. Hoje inalcançável para linha recusada (o CTA está fechado), mas o texto não explica "você encerrou esta avaliação". | Cosmético; anotado. |

---

## 10. IMPACTO NA MIGRAÇÃO NATIVA

- **A regra viajou para o banco, que é o destino certo.** "Não responder" não é uma condição de tela:
  é `nps_recusado_em` + dois ramos de RPC. O app React Native herda o comportamento inteiro sem
  reimplementar nada — e não tem como afrouxá-lo por engano, porque a UI nunca foi a fronteira.
- **O contrato de estado ficou explícito.** `estado_cupom_json` passa a distinguir os três estados
  (não respondeu / respondeu / recusou). O cliente nativo lê os mesmos três campos que o web lê; não
  há inferência local do tipo "`nps` nulo então pergunte".
- **Nada de novo depende de API de navegador.** O card de NPS é composição de estado + três ações;
  "responder mais tarde" é estado em memória do provider (não `localStorage`), o que atravessa para o
  RN sem ponto de troca.
- **Sem `Intl` novo.** Os carimbos (`nps_recusado_em`) são comparados por nulidade, nunca formatados
  na camada pura — a dependência mais frágil da Fase 5 continua fora de `src/lib`.
- **As telas removidas simplificam o porte:** três seções de prova social a menos para reimplementar,
  e nenhuma delas voltará com dado inventado.

---

## TAXONOMIA — ESTADO

- **A taxonomia NÃO foi implementada neste WP.** Nenhuma migration, nenhum seed, nenhuma tela.
- **`c4f8ae0` NÃO é arquitetura oficial.** Ele segue existindo apenas na branch
  `fase-estrutural-e1-taxonomia-schema`, fora desta.
- **Os dois desenhos continuam candidatos:**
  - **(A)** plano estrutural original (`~/.claude/plans/contexto-voc-o-fuzzy-stream.md`, 05/08):
    `public.segmentos` (14) + `public.categorias` reaproveitada como as **75 folhas**, id `text` =
    slug qualificado, `cupons.categoria_id` apontando para a folha, de-para nominal e **DELETE** dos
    6 ids legados;
  - **(B)** desenho de `c4f8ae0`: `public.categorias` continua sendo os **6 segmentos** (+`ativo`),
    `public.categorias_folha` nova com **PK UUID**, e `cupons.categoria_folha_id` como FK paralela
    nullable.
- **Os dados atuais do Promofy são de desenvolvimento/demo/teste e podem ser resetados.** Isso muda o
  peso do critério: a escolha **não** deve ser feita para preservar as linhas que existem hoje.
- **O critério é a melhor arquitetura de longo prazo** — identidade estável, custo de evolução do
  catálogo, clareza de "quem é o dono da folha", filtros da parte 2 (§5.2–5.7 do PDF), e o que fica
  mais simples de portar para o nativo. Quando houver cliente real, o rigor de migração volta a ser
  máximo; **é agora que ainda dá para escolher livre**.
- **Pré-requisito comum aos dois:** o "risco 1" do T4 (fim do `as CategoriaId`, `getCategoria` com
  fallback que nunca lança, visual vindo do banco) vale em qualquer um dos desenhos — é a única
  tarefa da taxonomia que dá para começar antes da decisão.
