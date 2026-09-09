# CLIENT-RETURNS-03 — Galeria do estabelecimento

**Data:** 09/09/2026 · **Branch:** `feat/estabelecimento-galeria` (a partir de `origin/main` `139d3c4`)
**Estado:** implementado e verificado **localmente**. Nada publicado, nada escrito no Supabase hospedado.

---

## 1. Pedido original e esclarecimento da call

Nos relatórios do cliente ficou pendente a **galeria de imagens do estabelecimento**. Na call de **02/09** o
cliente esclareceu o que ela é: um **complemento visual do PERFIL** — fotos do estabelecimento, do ambiente,
das opções, dos produtos, dos itens/cardápio e outras imagens do negócio.

Ela **não é**, e nada disso foi tocado:

| Coisa | Onde vive | Status nesta task |
|---|---|---|
| Imagem principal do cupom | `cupons.imagem` (Fase 7/C4) | intocada |
| Galeria **de cupom** | não existe | **não foi criada** |
| Logo do estabelecimento | `estabelecimentos.logo` (mig. 37) | intocada |
| **Galeria do perfil** | `estabelecimento_galeria` (mig. 43) | **entregue** |

A migration 37 (logo) tinha adiado este desenho por escrito — *"galeria (várias fotos do local/produto) NÃO
entra aqui: exigiria ordem, legenda e distinção lugar×produto — modelagem própria"*. É essa modelagem própria
que chega agora.

---

## 2. Uma premissa do WP estava errada — e isso mudou o escopo

> O WP dizia: *"página/detalhe do estabelecimento no consumidor já existe"*.

**Não existia.** O `/m` tinha:

* `/m/estabelecimentos` — a **lista** (card com nome, categoria, cidade e coração de favoritar);
* `/m/cupom/[id]` — o detalhe do **cupom**, que inclusive já dizia em voz alta *"é no perfil do
  estabelecimento que essas avaliações ficam"*, apontando para uma tela inexistente.

Como a galeria é **do perfil**, sem uma tela de perfil ela não teria onde aparecer para o consumidor e a
entrega ficaria pela metade (o requisito 5 do escopo — *exibição no consumidor* — não fecharia). Por isso
esta task criou **`/m/estabelecimentos/[id]`**, mínima e honesta:

* identidade (logo, nome, categoria hierárquica, bairro/cidade) + favoritar;
* **galeria** (a seção nova);
* ofertas visíveis daquele estabelecimento (mesmo filtro `ativo/indisponivel` do resto do `/m`);
* uma linha dizendo o que o cadastro **não** tem (telefone, endereço completo, avaliações) em vez de
  inventar.

Entradas para a rota: o card da lista passou a abrir o perfil, e o nome do estabelecimento no cabeçalho do
cupom virou link.

`GET` de estabelecimento `pendente` (`e4`), `suspenso` (`e6`) e inexistente devolve **404** — a rota não vira
oráculo do cadastro do cliente.

---

## 3. Modelo adotado

```
public.estabelecimento_galeria
  id                 uuid pk
  estabelecimento_id text  → estabelecimentos(id) on delete cascade
  imagem             text  -- CAMINHO no bucket, nunca URL
  ordem              int   -- 0 = primeira
  criado_em / atualizado_em
```

Constraints (é aqui que mora a segurança, não na Action):

* `imagem ~ '^[a-z0-9-]+/[0-9a-f]{32}\.(jpg|png|webp)$'` — espelha `PATH_IMAGEM_RE` e a policy de INSERT do
  storage (mig. 23);
* `starts_with(imagem, estabelecimento_id || '/')` — o arquivo é da pasta do **próprio** estabelecimento da
  linha;
* `unique (imagem)` — o mesmo arquivo não entra duas vezes.

Índice `(estabelecimento_id, ordem, criado_em, id)` — o caminho de leitura é sempre "a galeria deste
estabelecimento, em ordem".

**Reúso, não invenção:** nenhuma tabela ou coluna existente servia (a logo é uma coluna só; `cupons.imagem` é
do cupom). Não há JSONB compatível, e um JSONB aqui perderia o CHECK por linha e a FK.

---

## 4. Storage

**Bucket reutilizado: `cupom-imagens`. Zero bucket novo, zero policy de storage nova.**

O bucket já é, na prática, o bucket do estabelecimento: a pasta é `<estabelecimento_id>/` desde a mig. 22, a
logo já o reutiliza desde a 37, e as três policies (select/insert/delete) já provam posse por
`private.owns_estabelecimento((storage.foldername(name))[1])`. A mig. 23 já exige a forma do nome no INSERT.

Path: `<estabelecimento_id>/<32 hex>.<ext>` — montado **inteiro no servidor**. O cliente não fornece pasta,
nem nome, nem extensão: path traversal deixa de ser uma validação a acertar e passa a ser impossível por
construção.

Guardamos **caminho**, nunca URL. A URL é derivada por `urlPublicaImagem`, que devolve `null` quando o valor
não casa com o formato **ou** não pertence àquele estabelecimento — a mesma barreira de `cupons.imagem`.

### Efeito herdado da mig. 23, registrado em vez de contornado

O DELETE do objeto é recusado quando o caminho estiver referenciado por um cupom **já moderado**. Como a
Action grava caminhos novos e aleatórios, isso só acontece se o próprio lojista apontar `cupons.imagem` para
um arquivo da galeria — dentro do próprio tenant. Ver §9 (remoção).

---

## 5. RLS

| Quem | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `anon` | galeria de estabelecimento **`ativo`** | ✗ | ✗ | ✗ |
| consumidor | idem | ✗ | ✗ | ✗ |
| dono | a própria, **mesmo pendente/suspenso** | a própria | só `ordem` | a própria |
| outro lojista | só se o estab. for público e ativo | ✗ | ✗ | ✗ |
| admin | tudo | sim | sim | sim |

A leitura pública é **exatamente** o predicado do perfil (`estabelecimentos: publico le ativos`, mig. 3):
perfil escondido → galeria escondida. Sem um segundo contrato para divergir do primeiro.

O dono lê a própria mesmo com estabelecimento não-ativo, senão o portal e o `/e` quebrariam antes da
aprovação.

**UPDATE só de `ordem`:** `revoke all on table` + `grant update (ordem)` — nunca `revoke` por coluna, que é
*no-op* no Postgres quando existe grant de tabela. Repontar `imagem` de uma linha publicada trocaria o que o
consumidor vê sem passar por lugar nenhum; trocar foto é remover + adicionar.

---

## 6. Ownership

Três barreiras independentes, e nenhuma delas é o formulário:

1. **A Action nunca aceita `estabelecimento_id` do cliente.** Ele sai da sessão (adicionar) ou das próprias
   linhas (remover, reordenar). Um hidden input com o id do vizinho não muda nada.
2. **A RLS** prova `owns_estabelecimento(estabelecimento_id)` em insert/update/delete.
3. **O CHECK de pasta** prova que o arquivo é da mesma pasta da linha — sem ele, posse da linha não
   implicaria posse do arquivo.

O reorder é uma **RPC** (`reordenar_galeria_estabelecimento`), atômica, que deriva o estabelecimento das
linhas enviadas e só então confronta com a posse; exige que a lista seja a galeria **completa** de **um só**
estabelecimento. Ela **não** adivinha o estabelecimento pela sessão com `order by id limit 1` (como faz o
CRM) — ver §12.

---

## 7. Validação de arquivo

Reutiliza integralmente `src/lib/imagem-cupom.ts`, a mesma regra já aprovada para logo/cupom:

* tipo pelos **magic bytes**, nunca pela extensão nem pelo `Content-Type` (os dois são texto do cliente);
* whitelist JPEG/PNG/WebP — **SVG jamais** (script dentro de "imagem"); HTML renomeado cai fora;
* teto de 2 MiB checado **antes** de ler o conteúdo;
* `contentType` enviado ao Storage vem do tipo **detectado**;
* `allowed_mime_types` + `file_size_limit` do bucket são a segunda barreira;
* o `accept=""` do input é conveniência, nunca controle.

---

## 8. Crop

**Nenhum segundo cropper foi escrito.** `src/components/crop-imagem.tsx` ganhou três props **opcionais** —
`aspecto`, `larguraExport`, `titulo` — que caem exatamente nos valores do cupom quando ninguém passa nada.
Quem já usava não mudou em nada.

A galeria usa **4:3** (`ASPECTO_IMAGEM_GALERIA`), não a faixa 2:1 do card de cupom: a faixa existe porque o
card do cupom é uma faixa; num grid de fotos de ambiente e produto ela decapitaria metade do enquadramento.
Export em até 1200px.

---

## 9. Remoção — ordem operacional e falha parcial

Banco e Storage **não são uma transação**. As ordens foram escolhidas, não sorteadas:

* **Adicionar:** objeto → linha. Se o insert falhar, o objeto recém-subido é apagado (mesmo padrão de
  `criarCupomAction`). O inverso mostraria imagem quebrada no perfil.
* **Remover:** linha → objeto. A linha é o que o consumidor vê; derrubá-la primeiro garante que a foto some
  do perfil mesmo que o Storage recuse.

Quando o objeto não pode ser removido, a Action devolve `arquivoRemovido: false` e a UI diz: *"Imagem
removida da galeria — ela já não aparece no seu perfil. O arquivo em si continuou no armazenamento."* O
texto **não afirma a causa** (policy da mig. 23 ou Storage fora do ar), porque nomear uma das duas erraria
metade das vezes. Resultado: órfão possível no bucket (invisível, custa bytes), nunca uma foto fantasma no
perfil.

---

## 10. Guard técnico de quantidade

`MAX_IMAGENS_GALERIA = 12`. **Não é regra comercial e não veio do cliente** — é proteção operacional contra
uma galeria de 500 fotos derrubando o perfil. Vive em **dois** lugares e só dois, citados um no outro:

* `private.checar_limite_galeria` (trigger `before insert`) — a fronteira real, `security definer`;
* `src/lib/galeria-estabelecimento.ts` — a mensagem ao lojista e o `disabled` do botão.

A suíte prova que o teto é imposto **pelo banco**, não só pela Action.

---

## 11. Superfícies e UX

### Portal — `/portal/estabelecimento`
Seção **"Galeria do estabelecimento"** dentro do card de cadastro, abaixo do formulário: grid 2/3 colunas,
contador `N de 12`, adicionar (com recorte), remover, mover ←/→, estado de carregando, erro, empty state.
Copy: *"Mostre seu espaço, produtos e outras opções para seus clientes."*

A frase antiga *"…e galeria ainda não têm cadastro neste app"* foi corrigida — agora tem.

### `/e` — `/e/perfil`
**Paridade por compartilhamento, não por cópia:** as duas superfícies montam o **mesmo** componente
`src/components/estab/galeria-estabelecimento.tsx` (`compacto` só troca o grid e o espaçamento). Dois
componentes iguais divergiriam na primeira correção feita num só. O `/e/perfil` também ganhou a logo, que
antes não aparecia ali.

### Consumidor — `/m/estabelecimentos/[id]`
Seção **"Fotos do estabelecimento"**, adicional, que não desloca a logo nem a identidade:

* **0 imagens:** o componente devolve `null` — sem título órfão, sem retângulo cinza;
* **1 imagem:** largura inteira, sem virar "carrossel de 1";
* **N imagens:** faixa com `overflow-x-auto` + `snap`, CSS puro, sem biblioteca e sem JS.

---

## 12. Reordenação

**Botões ← / → em vez de drag-and-drop.** O projeto não tem dependência de DnD, e a alternativa acessível de
um DnD (teclado, leitor de tela) é exatamente este par de botões — ou seja, o caminho simples já é o caminho
acessível. Um clique = uma troca = uma chamada.

A ordem inteira vai numa **RPC transacional**; a UI aplica otimista e reverte no erro. A ordem de leitura é
determinística por construção: `ordem`, desempate por `criado_em`, desempate por `id` — dois critérios
totais, então nunca sobra empate (o que impediria a mesma galeria de aparecer em ordens diferentes entre um
SSR e o seguinte).

---

## 13. Acessibilidade

* `alt` **não inventa o conteúdo da foto**: `"Imagem 2 de 5 do estabelecimento Sabor & Cia"`. Uma imagem só
  não vira "1 de 1"; nome vazio degrada sem quebrar a frase.
* `aria-label` explícito em todo botão de ícone: *"Mover a imagem 3 para a esquerda"*, *"Remover a imagem 3
  da galeria"*.
* Primeiro item tem "esquerda" `disabled`; último tem "direita" `disabled` (medido no browser).
* Erro em `role="alert"`.
* **Todo botão é `type="button"`** — a armadilha da Fase 8 (botão cru dentro de `<form>` faz submit). A
  galeria do Portal fica **fora** do `<form>` de cadastro, e há teste estático que falha se um `<button>`
  sem `type` aparecer no componente.

---

## 14. Performance e cache

* **Nada de base64 no banco**, nada de bytes em JSON: a coluna guarda caminho.
* `loading="lazy"` + `decoding="async"` em toda imagem da galeria (gestão e consumidor).
* Export do recorte limitado a 1200px de largura.
* `next/image` **não** é usado — não é usado em lugar nenhum do repo e exigiria `remotePatterns` para o host
  do Storage; fora do escopo, e o `eslint-disable` está declarado com o motivo.
* Toda mutação chama `revalidatePath` em `/portal/estabelecimento`, `/e/perfil`,
  `/m/estabelecimentos/[id]` e `/m/estabelecimentos`; o componente ainda faz `router.refresh()` para vencer
  o Router Cache do cliente na aba que agiu.

---

## 15. Testes

Suíte nova `scripts/test-client-returns-estab-galeria.ts`, ligada ao `verify`
(`npm run test:client-returns-galeria`). **74 PASS, 0 FAIL.**

### Onde o Storage NÃO é exercitado — dito em voz alta
O `[storage]` local está **desligado** (gate da Fase 7: o healthcheck do `storage-api:v1.67.8` derruba o
stack e com ele o `db:reset`, primeiro passo do `verify`). A suíte **não sobe bytes**: prova o que o BANCO
garante (linha, CHECK de forma, CHECK de pasta, policies, teto, RPC) e assere por **fonte** que a galeria
reutiliza `cupom-imagens` sem bucket novo e sem policy de storage nova. Um verde que não roda no alvo é pior
que um vermelho, então isto fica escrito aqui e impresso no topo da própria suíte.

O upload/remoção via UI foi exercitado **no navegador** contra o banco local (ver §16).

### Segurança (1–10)
1. dono adiciona no próprio ✓ · 2. dono **não** adiciona em estab. alheio ✓ (+ 2b: linha própria apontando
para pasta alheia é recusada pelo CHECK) · 3. dono **não** remove de B ✓ (+ 3b `PATCH` de ordem em linha de
B, + 3c RPC devolve `nao_autorizado`) · 4. consumidor não escreve (insert e delete) ✓ · 5. anon não escreve
e não executa a RPC ✓ · 6. traversal, subpasta, caminho absoluto e URL recusados no módulo puro **e** pelo
banco ✓ · 7. SVG, HTML renomeado, vazio e >2 MB recusados ✓ · 8. imagem válida persiste ✓ · 9. remoção apaga
o registro ✓ · 10. remoção não afeta imagem alheia (galeria de B intacta ao fim) ✓.

Extras: `imagem` é imutável para o dono (grant por coluna); anon **não** vê galeria de estabelecimento
suspenso mas o dono vê a própria; o teto de 12 é imposto pelo banco.

### Funcional (11–20)
11. galeria vazia não quebra o perfil ✓ · 12/13. uma e múltiplas imagens ✓ · 14. ordem determinística, com
desempate total e sem mutar a fonte ✓ · 15. reorder aceito no próprio, recusado parcial / misturado / de
terceiro ✓ · 16/17. upload no Portal e no `/e` pelo mesmo componente ✓ · 18/19. remoção nas duas superfícies
✓ · 20. consumidor lê a galeria e vê a nova ordem ✓.

### Regressão
`npm run verify` — **29 suítes, 0 FAIL, EXIT 0, build PASS.**

Um ajuste foi necessário em suíte alheia: `test-fase9c` contava `4×` o filtro
`.in("status", ["ativo","indisponivel"])` em `src/lib/data/cupons.ts`. A query nova do perfil público é a
**5ª** e **nasce com o mesmo filtro** — o número foi para 5 e o comentário explica o que a asserção protege
(nenhuma query de consumidor perde o filtro). A intenção do teste foi preservada, não afrouxada.

---

## 16. Mobile (390×844, navegador real)

| Superfície | Resultado |
|---|---|
| `/m/estabelecimentos/[id]` com 5 imagens | **sem overflow horizontal** (355 = 355); a faixa rola dentro de si (1330 > 355) |
| `/m/estabelecimentos/[id]` sem imagem | seção não renderiza; sem overflow |
| `/e/perfil` com 5 imagens | **sem overflow** (355 = 355); 17 botões, todos `type="button"`, todos 36×36 dentro da tela |
| Reorder pelo botão | ordem persistiu no banco e **o consumidor viu a nova ordem** |
| Remoção pelo botão | contador 5 → 4, `alt` renumerados, aviso de falha parcial correto (Storage local off) |
| `/portal/estabelecimento` | galeria renderiza; **overflow pré-existente** — ver §17 |

---

## 17. Pendências e achados

**Nada disto é regressão desta task, e nada disto foi consertado aqui.**

1. **`/portal/estabelecimento` estoura na horizontal a 390px (pré-existente).** Medido: 364 > 341, e o
   estouro **persiste com a seção da galeria escondida**. A causa é o campo de **logo** (`CampoImagem`): o
   preview `h-20 w-40 shrink-0` ao lado do bloco de texto força ~348px de min-content. É a superfície *web*
   do lojista e o componente é compartilhado com os formulários de cupom — mexer nele sem medir os outros
   usos seria trocar um problema conhecido por um desconhecido. `/e/perfil`, que é a superfície de celular,
   está limpo.

2. **Multi-estabelecimento (pré-existente, o WP mandou não consertar).** `lojista@promofy.test` é dono de
   **seis** estabelecimentos no seed local (`e1` + o backfill `e3..e6` da mig. 39). Todo o lado do lojista
   resolve o estabelecimento com `.eq("owner_id", uid).maybeSingle()`, que devolve `PGRST116 → null` com
   mais de uma linha — então `/e/perfil` e `/portal/estabelecimento` já apareciam **vazios** para essa conta
   em `origin/main`, antes desta task. A galeria herda exatamente o mesmo caminho de resolução: **não piora
   o problema, e também não escapa dele.** Com `lojista2@` (dono só do `e2`) tudo funciona ponta a ponta.
   A RPC de reorder é a única peça nova que **não** depende dessa resolução — ela deriva o estabelecimento
   das próprias linhas, então já está pronta para o dia em que o multi-estab for resolvido.

3. **Sem legenda por imagem.** O `alt` é derivado do nome do estabelecimento. Legenda editável era parte do
   motivo pelo qual a mig. 37 adiou a galeria; entra quando o produto pedir, e a coluna cabe sem migration
   destrutiva.

4. **Storage não exercitado na suíte automatizada** (ver §15). O smoke com bytes reais depende de um
   ambiente com Storage ligado — o gate de publicação.

---

## 18. Confirmações

* A galeria implementada é do **perfil do estabelecimento**, não do cupom.
* O estabelecimento só altera a própria galeria.
* O consumidor não tem permissão de escrita.
* Outro estabelecimento não altera nem remove as imagens.
* O Storage não confia em path arbitrário do client — o caminho é montado no servidor e provado por policy
  e por CHECK.
* Imagens não são armazenadas como base64 no banco.
* Portal e `/e` têm paridade de gestão, pelo mesmo componente.
* Galeria vazia não gera bloco quebrado.
* **Nenhuma galeria de cupom foi criada.**
* **Nenhuma escrita foi feita no Supabase hospedado.** Nenhum push, PR, merge ou deploy.
