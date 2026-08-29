# Adendo da reunião de 05/08 — relatório

> Branch `fase-estrutural-e1-taxonomia-schema`. Itens pequenos, em voo, aplicados **sem desviar do fio da
> taxonomia**: a E1 (migration 35) continua intocada e o trabalho abaixo não encosta em `categorias`,
> `categorias_folha` nem `cupons.categoria_folha_id`.
>
> **Nada foi a produção.** Migrations 35 e 36 são LOCAL ONLY até OK explícito, e o merge para a `main` não
> foi feito.

---

## 1. Z3 liberado — depoimentos fictícios saem da página do cupom

Commit `f86dee1` (cherry-pick de `bc52d0f`, da branch `fase-9-z3-depoimentos`, com o texto ajustado).

O `/m/cupom/[id]` exibia um `FeedbackCarousel` alimentado por `mock-data.avaliacoes`: "Mariana Alves" e
"Rafael Souza", textos que ninguém escreveu, colados a um cupom **real** — a única das três telas com dado
fictício que o **consumidor** via.

**O que mudou em relação ao commit preparado.** Ele dizia *"ainda sem avaliações deste cupom… assim que
houver respostas, elas aparecem aqui"*. A decisão que veio na reunião é o contrário: **feedback nunca volta
ao cupom — a avaliação é do estabelecimento**. Manter aquele texto seria prometer uma tela que, por decisão
de produto, não vai existir. O estado honesto agora diz de quem é a avaliação e onde ela mora:

> **Cupom não recebe avaliação**
> Quem resgata avalia o estabelecimento, e não a oferta. É no perfil do estabelecimento que essas avaliações
> ficam.

O `FeedbackCarousel` continua no repositório, **sem uso** — ele serve quando houver comentário em texto de
verdade, no perfil do estabelecimento (Fase 10).

---

## 2. NPS — a terceira saída

Commit `587fa4c`. Migration **36** (`20260821120000_adendo_nps_recusa.sql`), com a entrada no `MIGRATIONS.md`
no mesmo commit.

| Saída | Peso na tela | O que faz |
|---|---|---|
| **Responder** | primária | `responder_nps` — grava a nota e credita os pontos (já existia, Fase 2) |
| **Responder mais tarde** | discreta | some **desta sessão** e volta na próxima abertura — **nada é gravado** |
| **Não responder** | discreta | **encerramento definitivo**: grava a recusa, a linha sai da fila para sempre, **sem pontos** |

### O desenho de menor custo (era o que o adendo pedia para propor)

Só a terceira saída precisa de banco. "Mais tarde" já era o `dispensarNpsPendente` do provider — estado de
sessão, sem escrita — e "responder" já existia.

**Uma coluna nullable, `cupons_usuario.nps_recusado_em (timestamptz)`.** As alternativas e por que caíram:

- **Sentinela em `nps` (`-1` ou `0`)** — descartada. `indicadores_estabelecimento` (migration 25) monta a
  base do NPS com `nps is not null` e classifica **0–6 como detrator**. Quem recusou viraria detrator, o
  oposto do que "não quis responder" significa. `nps` continua querendo dizer uma coisa só.
- **Boolean** — mesmo custo de escrita e de leitura que o timestamp, mas responde menos: `timestamptz` dá o
  "quando" de graça, como `validado_em`, e nasce NULL em todas as linhas sem DEFAULT nem backfill.
- **Tabela nova de recusas** — cara demais para um fato 1:1 com a linha que já existe.

**Sem grant novo.** A migration 2 revogou `insert, update` de `cupons_usuario` para `authenticated`: toda
escrita passa por RPC `security definer`. A coluna entra nesse regime — não há PATCH por PostgREST para
marcar **nem para desmarcar** a recusa. Há asserção disso na suíte.

**Aditiva.** `estados`, `usos`, `saldo`, `config` e `usuario` saem idênticos; o código publicado que não
conhece a coluna se comporta como antes. É a janela banco-antes-código de sempre.

### A tela

O **"X" do canto saiu**, e essa é a decisão de desenho central. Com duas saídas de significados muito
diferentes — "volta amanhã" e "nunca mais" —, um ícone ambíguo no canto seria a pior forma de escolher entre
elas: o dedo cai ali por reflexo. As duas passam a ter nome, e o nome é o mesmo que a pessoa leu antes de
tocar.

**"Não responder" pede confirmação inline, não modal.** É irreversível, e o custo de um toque errado é uma
avaliação perdida para sempre mais os pontos que vinham com ela. A confirmação diz as duas consequências
("esta avaliação não volta a aparecer, e os N pontos não são creditados") e cabe no próprio card — um modal
para encerrar uma pesquisa que a pessoa está tentando dispensar seria justamente a perseguição que o card
existe para evitar.

A linha só sai da fila local **depois** do `ok` do servidor: uma recusa engolida pela rede que sumisse da tela
reapareceria no próximo reload sem que ninguém entendesse por quê.

### Asserções (`test-fase9`, bloco `[Z1b]`)

- "Responder mais tarde" **não grava nada** — a leitura seguinte do servidor reoferece a mesma pendência;
- recusar **tira da fila** e o saldo **não muda**;
- recusar de novo é idempotente e **preserva o carimbo da primeira** recusa;
- recusar uma **já respondida** não marca recusa nem mexe na nota;
- recusar pendência **de outra pessoa** devolve `nao_encontrado`;
- **PATCH direto** por PostgREST não desfaz a recusa;
- a fila com múltiplos **acumula** e é oferecida **uma por vez, mais recente primeiro** — já era o desenho
  (migration 28), e continua coberto pelo bloco `[Z1]`.

---

## 3. CPF de teste — **a premissa não se sustentou, e nada foi escrito**

O pedido era gerar um CPF sintético com DV válido e gravá-lo no perfil de `consumidor@promofy.test`. Antes de
escrever em conta do cliente, a regra da casa é medir o estado real (CLAUDE.md §1). Medido em **produção**,
29/08:

```
ANTES  consumidor@promofy.test
       nome: Lucas Orlandi
       cpf : "123.456.789-09"
       DV  : válido
       busca do balcão compara por dígitos: 12345678909
       nenhum outro perfil usa estes dígitos
```

**O campo não estava vazio, e o que está lá já é exatamente o que o pedido queria:** um CPF sintético, com DV
válido — o mesmo `CPF_DEMO` que o `seed-users.ts` grava desde a Fase 2.

Ele está guardado **formatado** (com pontos e hífen), e isso **não atrapalha**: os dois caminhos normalizam os
dígitos dentro do banco — `buscar_ativacoes_por_cpf` compara
`regexp_replace(p.cpf,'\D','','g') = v_digitos` (migration 26) e `mascarar_cpf` normaliza antes de mascarar
(migration 6). Isso era leitura de código; agora é **asserção** (`test-fase8`: CPF guardado formatado continua
sendo encontrado, e a máscara sai correta).

**Antes → depois: sem mudança.** Escrever um número novo por cima trocaria um CPF de teste que funciona por
outro, mexendo em dado do cliente sem ganho nenhum.

Ficou no repositório o script `scripts/adendo-cpf-consumidor.ts`, que **confere** (não escreve): mede o estado,
valida o DV, recusa a operação se outro perfil tiver os mesmos dígitos, e só oferece escrita — com `--aplicar`
— se o perfil estiver sem CPF utilizável, que é a única situação em que o pedido original ainda faria sentido.

**O que o cliente usa na demo:**

| campo | valor |
|---|---|
| CPF para digitar no `/e/validar` | `123.456.789-09` (ou `12345678909` — a máscara aceita os dois) |
| máscara que o balcão devolve | `123.***.***-09` |

Falta só o passo **no ar**: conferir máscara e busca na preview depois do deploy desta fase — está na lista de
smoke abaixo.

---

## 4. "1 por dia" — **ARQUIVADO**

O cliente confirmou o modelo atual: **limites de uso são estratégia do estabelecimento, e "ilimitado" é
intencional**. A periodicidade ("1 café por dia", "1 por semana") **sai do backlog**.

**Justificativa registrada.** A pendência nasceu na Fase 6, quando o switch "Ilimitado" entregou
`limite_por_usuario` (nulo = ilimitado) e ficou a dúvida se o cliente queria contagem por período. Ela foi
carregada como ⚠️ nos relatórios das Fases 6, 6.5, 7 e 8 sempre com a mesma frase — *"se a resposta for
'eu queria 1 por dia', o switch entregue não atende"*. **A resposta veio, e é não.** O que existe hoje —
limite por usuário, limite total e janela de consumo — é o modelo que o cliente quer. Nenhuma coluna nova,
nenhuma migration, nenhum campo de formulário: a pendência fecha **sem código**.

Este relatório é o registro; os relatórios anteriores ficam como estão (são histórico, não backlog vivo).

---

## 5. Backlog da Fase 10 — registrado, **não implementado**

| # | Item | Notas de desenho já conhecidas |
|---|---|---|
| a | **Avaliações do estabelecimento**: estrelas 1–5 **públicas** no perfil; **texto privado** (estabelecimento + admin); moderação pelo admin **com justificativa ao consumidor**; **sem réplica**. | **Decisão pendente:** derivar as estrelas do NPS existente (0–10 → 1–5) ou sistema próprio. O NPS de hoje é nota sem texto e é **do estabelecimento**, não do cupom — é o mesmo eixo. Derivar economiza uma pesquisa nova, mas mistura duas perguntas diferentes ("indicaria?" ≠ "quantas estrelas?"). Recomendo decidir **antes** de qualquer schema. É aqui que o `FeedbackCarousel` (item 1) volta a ter uso. |
| b | **Dias × validade coerentes** no cadastro de cupom: as datas definem quais dias ficam selecionáveis (e a exibição idem). | Regra derivada de dado que já existe (`validade_inicio`/`validade_fim` × `horarios.dias`). Vale como validação **no banco**, não só no formulário — o lojista fala PostgREST. |
| c | **Campo de código em caixinhas 4-4**, hífen fixo e pulo automático no `/e/validar`, **+ máscara automática de CPF** (prometida na call). | Cuidado já pago: `<button>` cru dentro de `<form>` é submit, e `type="button"` **não** cobre o Enter — campo de texto em form dispara submissão implícita (CLAUDE.md §4). Um campo dividido em caixinhas multiplica esse risco. |
| d | **Cadastro direto de estabelecimento** (3ª opção na página de empresa) com **fila de validação anti-fraude** no admin. | Toca RLS e onboarding — é o item mais pesado da lista. |
| e | **Edição de cupom pelo ADMIN** (a do lojista já existe — F6.5). | Reaproveita `montarPatchCupom` / `cupom-campos`; o que muda é quem pode e o que fica no histórico de moderação. |
| f | **Investigar o congelamento da animação de pontos** visto na demo ao vivo. | Suspeito principal: `pontos-pop` remontado por `seq` durante um poll — reproduzir com a animação em curso e um `consultarCupom` no meio. |

---

## 6. Verificação

| Passo | Estado |
|---|---|
| `npm run verify` (db:reset + 15 suítes + `next build`) | **VERDE** — `VERIFY_EXIT=0`, **761 PASS / 0 FAIL** nas 15 suítes, build compilado. Exit code lido do `verify`, não de um `tail` (CLAUDE.md §4). |
| `npm run db:types` | ⚠️ **não use o script como está**: `supabase gen types --local` conectou na porta 5432 (outra stack) e o `>` do npm **truncou** `database.types.ts` para 0 linhas. Regenerado com `--db-url postgresql://…@127.0.0.1:55422/postgres` → 1017 linhas, diff de **4 linhas** (a coluna nova em 3 lugares + `recusar_nps`). O `wc -l` que o CLAUDE.md manda conferir é exatamente o que pegou isso. |
| Smoke na preview | pendente — ver abaixo |

### Smoke da preview (com `qa-*` ou `convidado@`, **nunca** `consumidor@`)

1. `/m` com uma validação de balcão em aberto → o card mostra **três** saídas.
2. "Responder mais tarde" → o card some; **recarregar a página** → o card volta.
3. "Não responder" → confirmação inline; confirmar → o card some; **recarregar** → **não volta**; saldo de
   pontos **inalterado**.
4. "Responder" com nota → pontos creditados uma vez (animação com valor do servidor).
5. `/m/cupom/<id>` → seção **Avaliações** com o estado honesto novo, sem depoimento fictício.
6. `/e/validar` → buscar `123.456.789-09` na conta do cliente **apenas para conferir máscara e busca**
   (leitura; **não** confirmar validação sobre cupom do cliente).

---

## 7. Para levar ao ar (nada disso foi feito — **parado antes da produção**)

1. **As migrations 35 e 36 viajam juntas.** `db push --linked` aplica a fila inteira: autorizar a 36 é
   autorizar a 35 antes dela. As duas são aditivas e inertes para o código publicado (a 35 cria tabela vazia e
   coluna NULL; a 36 cria coluna NULL e uma RPC que ninguém em produção chama ainda).
2. **A preview fala com o banco de PRODUÇÃO.** O item 3 do smoke acima **não funciona na preview** enquanto a
   36 não estiver aplicada no banco hospedado — o botão existiria e a RPC não. Ou se aplica o banco antes
   (fluxo normal da casa: banco antes do código, com OK por passo), ou se aceita que "Não responder" fica
   inerte na preview.
3. Ordem de sempre: banco → push da branch → preview → smoke → **OK do Neemias** → merge `--no-ff` → produção,
   com o id do deployment atual anotado (`npm run vercel:deployments`) como candidato a Instant Rollback.

---

## 8. O que ficou de fora, e por quê

O adendo pede, depois dos itens 1–4, retomar **o fio das Ondas 1–2** (`T4-risco1 → T1 → T2 → T3 ensaio QA →
T4 telas → T5 seed`) "exatamente como aprovado". **Esse plano não está no repositório** — não existe em
`docs/superpowers/plans/`, em `docs/taxonomia/` nem em `.superpowers/sdd/` (o que há ali é de outra fase, de
junho). O que está versionado da fase estrutural é a migration 35 e a seção nova do `MIGRATIONS.md`, que
descrevem o **schema** da E1 e listam o que fica para E2+, mas não os tais T1–T5.

Executar "exatamente como aprovado" a partir de reconstrução minha seria adivinhar o conteúdo de um plano que
o Neemias aprovou — e a T5 (seed) e a T2 escrevem no catálogo. **Parei aqui, com os itens 1–4 completos**, e
preciso do plano (ou do arquivo, ou de colá-lo aqui) para retomar o fio sem inventá-lo.
