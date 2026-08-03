# FASE 6.5 — Relatório de Implementação (Editar · Motivo · Storage)

*Branch: `fase-6-5-editar-motivo-storage` (a partir da `main`) · Data: 2026-08-03 · Status: **concluída e verificada local; NÃO está no ar***

> A Fase 6 cortou de propósito três itens que compartilham a mesma superfície nova: **mutar um
> cupom que já nasceu**. Esta fase entregou **C2 (editar)** e **C5 (rejeição com motivo)**, mais
> a correção do **benefício duplicado** herdada da Fase 2.
>
> **C4 (upload/Storage) não entrou** — e isso foi uma decisão sua, tomada a partir de um gate
> empírico que **falhou** (§8). Nenhuma linha de C4 foi escrita "no escuro".
>
> **Nada foi aplicado no ambiente do cliente.** As migrations 20 e 21 existem só no local.

---

## 1. Escopo entregue e escopo adiado

| | Item | Situação |
|---|---|---|
| **C2** | Editar cupom (portal + `/e`) com matriz de imutabilidade no banco | ✅ entregue |
| **C5** | Rejeição com motivo + ler → editar → reenviar → aprovar | ✅ entregue |
| **EXTRA** | Benefício duplicado corrigido na raiz + legado deduplicado na exibição | ✅ entregue |
| **C4** | Upload de imagem (estreia do Supabase Storage) | ⏸ **adiado para a Fase 7** — gate empírico falhou (§8) |

## 2. Entregas (por commit)

| Commit | Entrega |
|---|---|
| `966f6f6` | **C2/DB** — migration 20: `moderacao_historico` + trigger `checar_edicao_cupom` (matriz de imutabilidade) + `hora_ou_null` |
| `0173fea` | **C2/app** — `editarCupomAction` com **contrato parcial** + `buscarCupomParaEdicao` (DTO fiel à linha) |
| `48064b1` | **C2/UI + C5** — editar no portal e no `/e`; migration 21 (rejeição com motivo, `reenviar_cupom_moderacao`); `Textarea`; `src/lib/moderacao.ts` |
| `d5b501e` | **C2/DB** — corrige o registro no histórico: vale para **qualquer** status (defeito meu, achado pelo teste do ciclo — §7) |
| `ae8d52c` | **C4** — registra o resultado do GATE do Storage no `config.toml` (§8) |
| `EXTRA_SHA` | **EXTRA** (benefício duplicado) + `src/lib/cupom-patch.ts` + `scripts/test-fase65.ts` + `test:fase65` no `verify` + call site da Fase 3 |

## 3. Critérios de aceite — como cada um foi provado

| # | Critério | Prova |
|---|---|---|
| C2 | Só o dono edita | `lojista2` e `consumidor` fazendo `PATCH` direto em cupom do `e1` → **0 linhas** (a policy filtra) |
| C2 | A matriz é do **banco**, não da Action | Todas as asserções da matriz passam **direto no PostgREST**, sem tocar na Server Action |
| C2 | Edição material rebaixa `ativo → pendente`; typo no título não | Suíte + smoke |
| C2 | Formulário reduzido **não apaga** o que não mostra | `montarPatchCupom({titulo})` → patch de **1 chave**; e, no banco, `horarios`/`validade_inicio`/`ocultar_ate_inicio`/`prazo_ativacao_horas`/`regras`/`imagem` **idênticos** depois da edição |
| C5 | Rejeitar exige motivo | `p_motivo = "  "` → `motivo_obrigatorio` |
| C5 | Ciclo fecha | Histórico do cupom após o ciclo: **`rejeitado,editado_material,reenviado,aprovado`** |
| C5 | Lojista não reescreve o próprio histórico | `PATCH moderacao_historico` → **42501** (coluna fora do grant) |
| EXTRA | Benefício não repete | Cupom novo nasce com `regras: []`; cupom legado com `regras[0] === beneficio` renderiza **uma vez** |
| Geral | Zero regressão | `npm run verify` verde: **401 PASS, 0 FAIL** + `next build` (46 rotas) |

## 4. A descoberta que definiu a arquitetura do C2

**O lojista já conseguia editar o próprio cupom antes desta fase, direto no PostgREST.** A policy
`"cupons: lojista atualiza os proprios"` (Fase 1) checa só posse, e o `grant update` por coluna
soma **24 colunas** depois da Fase 6. Fora do grant só ficaram `status`, `estabelecimento_id`,
`id`, `criado_em` e `publicado_em`.

Consequência direta: **uma matriz de imutabilidade escrita só na Server Action seria decorativa** —
bastaria um `PATCH /rest/v1/cupons?id=eq.<meu-cupom>` para contorná-la. A barreira virou um
**trigger `BEFORE UPDATE`** (migration 20), mesmo raciocínio da migration 19 da Fase 6. A Action
ficou como camada de **mensagem**: ela repassa o texto do trigger, não reimplementa a regra.

**A matriz, com os dois estados que decidem tudo** — `V` = existe qualquer validação;
`A` = existe ativação viva (`status='ativo' and expira_em > now()`):

| Campo | Regra | SQLSTATE |
|---|---|---|
| `economia`, `economia_variavel` | imutáveis se **V** — `economia_consumidor()` soma em tempo de leitura; mudar reescreveria o total já exibido a quem validou | `P0601` |
| `beneficio`, `taxas`, `formas_consumo` | imutáveis se **A** — é o que o cliente está lendo na folha que vai apresentar no balcão | `P0602` |
| `limite_por_usuario` | nunca abaixo do máximo já consumido; `null` (ilimitado) sempre permitido | `P0603` |
| `limite_total` | nunca abaixo do total de validações | `P0604` |
| `validade_fim` | com **A**, só **estende** | `P0605` |
| `horarios` | com **A**, só **amplia** (dias superconjunto, faixa contendo a antiga) | `P0606` |
| demais | livres | — |

Toda mensagem diz **quantas** ativações vivas existem e **quando a última vence** — sem isso o
lojista fica sem saber quando poderá editar. Exemplo real da suíte:

> *"Benefício, taxas e formas de consumo não podem mudar agora: 1 cliente(s) têm este cupom
> ativo. A última ativação vence em 03/08 20:14."*

**Materialidade** (rebaixa `ativo → pendente`): `beneficio`, `economia`, `economia_variavel`,
`categoria_id`, `taxas`, `formas_consumo`, `horarios`, `regras`, `imagem`. `titulo` fica de fora
por decisão sua (typo não deve rebaixar) — e a compensação é que **toda** edição, material ou
não, entra no `moderacao_historico`, então o admin enxerga o que aconteceu mesmo sem rebaixamento.

## 5. O contrato de edição é PARCIAL — e é aqui que a fase quase perdeu dado

Este foi o achado que a revisão adversarial produziu **antes da primeira linha de código**, e ele
era real. O formulário do `/e` é um subconjunto **declarado** do cupom: ele não tem `useState`
para `dias`, `horaInicio`, `horaFim`, `dataInicio`, `ocultarAteInicio` nem `prazoAtivacao` — o
submit manda **literais** (`dias: []`, `horaInicio: "00:00"`, `horaFim: "23:59"`,
`prazoAtivacao: 5`). E a `criarCupomAction` acrescentava mais dois (`regras: [beneficio]`,
`imagem: ""`).

Se a edição espelhasse a criação recebendo o input completo, **corrigir um typo no título pelo
totem** apagaria a janela (viraria 00:00–23:59 todos os dias), o agendamento, o prazo (8h → 5h),
as regras curadas e a imagem. **E a matriz não barraria:** ampliar janela é permitido por
desenho, e `regras`/`imagem` são campos livres. Pior: como `horarios`, `regras` e `imagem` são
**materiais**, o cupom `ativo` ainda seria rebaixado a `pendente` e sumiria da vitrine. Três
canais independentes para o mesmo desastre silencioso, nenhum deles com mensagem de erro.

A correção é uma regra de uma frase — **"grava só o que veio"** — implementada em
`src/lib/cupom-patch.ts`:

- `undefined` nunca vira default, nunca vira `""`, nunca vira `[]`;
- `horarios` é jsonb **composto**: só é remontado se `dias` + `horaInicio` + `horaFim` vierem
  **juntos**; pela metade, a edição é **recusada** com mensagem (nunca grava uma janela que o
  lojista não pediu);
- cada saneador só roda se a chave veio — `prazoAtivacao` ausente não passa por
  `sanearPrazoAtivacao` (senão o form reduzido reescreveria 8h → 5h a cada edição).

**Por que isso virou módulo puro em vez de ficar dentro da Action:** é o construtor que pode
regredir, e dentro da Action ele seria inalcançável para o teste (a Action depende de `cookies()`
do Next). Puro, ele é provado direto — inclusive a propriedade mais forte, *"payload de uma chave
produz patch de uma chave"*, que nenhuma prova via banco consegue dar com a mesma precisão.

**Decisão de produto registrada:** o `/e` é **edição rápida**. Janela, agendamento e prazo são
**preservados** (nunca entram no payload) e aparecem num bloco de leitura *"Preservado nesta
edição — ajuste pelo portal"*. O portal continua editando tudo.

**DTO novo:** `ItemCupomPortal` não servia para re-hidratar o formulário. `linhaParaCupom`
**colapsa o status** (`row.status === "indisponivel" ? … : "ativo"`), então um cupom `rejeitado`
chegaria ao form como `ativo` — o que também quebraria a UI do C5. Entrou
`buscarCupomParaEdicao(id)`, fiel à linha (`prazo_ativacao_horas`, `status` real, `regras`,
`imagem`, dias/início/fim).

## 6. Revisão adversarial (4 lentes) — 8 achados, 2 sobreviveram

Cada achado foi submetido a um cético independente instruído a **refutar**. Seis caíram; dois
sobreviveram e foram verificados no código antes de virarem plano:

1. **O formulário compartilhado apagaria dado em silêncio** (§5). Confirmado lendo
   `novo-cupom-form.tsx:65-72` — o próprio arquivo já se documentava como "form reduzido, campos
   avançados vão com defaults sensatos". Virou o contrato parcial.
2. **A policy de `SELECT` do bucket público não podia ficar aberta.** Em bucket público a
   *leitura da imagem* é servida por `/object/public` e **não passa por RLS**; a policy de
   `SELECT` governa a **listagem** (`.list()` → `storage.search`). Liberá-la não compraria nada
   para a exibição e publicaria o índice: com a `ANON_KEY` (que está no bundle), qualquer um
   faria `.list('')` e receberia **todos os `cupom_id` com imagem, inclusive de cupons
   `pendente`/`rejeitado` de outros lojistas**, que a RLS de `cupons` esconde. Achado
   incorporado ao desenho do C4 — que agora vai para a Fase 7 com essa correção já dentro.

Os seis refutados incluíam suspeitas sobre o trigger barrar seed/service_role (não barra: sai
cedo com `auth.uid() is null`), sobre o `DROP FUNCTION` deixar a RPC inacessível (o efeito real é
o **oposto** — Postgres dá `EXECUTE` a `PUBLIC` por padrão, então esquecer o re-grant abriria a
superfície) e sobre a `reenviar_cupom_moderacao` ser barrada pelo próprio trigger (não é: ela só
mexe em `status`, que o trigger nem considera).

## 7. O defeito que eu mesmo introduzi — e como o teste o pegou

A primeira versão do trigger registrava a edição no histórico **dentro** do bloco que rebaixa o
cupom, ou seja: só cupons `ativo`. O teste do ciclo completo do C5 falhou com

```
rejeitado,reenviado,aprovado    (esperado: rejeitado,editado_material,reenviado,aprovado)
```

O buraco é exatamente o caso que o C5 existe para cobrir: um cupom **rejeitado** que volta para a
fila **sem** registro de que o lojista corrigiu alguma coisa — o moderador reabre no escuro.
Corrigido no commit `d5b501e`, separando as duas decisões: **registrar** vale para qualquer
status; **rebaixar** só para `ativo`.

> A migration 20 foi **editada**, não emendada, e isso é deliberado: ela nunca saiu desta máquina
> (não está na `main`, não está no hospedado). A regra "nunca editar migration aplicada" continua
> valendo para tudo que já foi empurrado.

## 8. C4 — o GATE empírico falhou, e por isso o Storage não entrou

O plano previa: **antes de qualquer código de C4**, ligar o Storage, dar `db:reset` e observar. O
gate foi executado em 03/08/2026. Resultado, com evidência:

**O que funciona:** o `storage-api` v1.67.8 sobe e **responde** — os logs mostram `GET /bucket`
200 e `POST /bucket` 200 criando o `cupom-imagens` exatamente com a config declarada (público,
2 MiB, jpeg/png/webp). O schema `storage` **passa a existir** depois do reset (10 tabelas), o que
responde favoravelmente à árvore de decisão do plano — bucket e policies poderiam ir para uma
migration normal.

**O que quebra:** o **healthcheck do container**. O `wget http://127.0.0.1:5000/status` de dentro
dele leva `Connection refused` mesmo com o servidor logando *"Started Successfully"* e atendendo
requisições. O CLI 2.100.1 aborta com `container is not ready: unhealthy` e **derruba o stack
inteiro**.

**O impacto que decidiu o gate:** com o Storage ligado, **`npm run db:reset` não completa**
(4m30s até abortar) — e ele é o **primeiro passo do `npm run verify`**, que é o critério de
aceite da fase. Intermitente ainda por cima: um `supabase start` falhou e o seguinte passou.

Conclusão levada a você: entregar C4 assim seria exatamente o *"funciona na minha máquina"* que a
missão proibiu. **Sua decisão: adiar C4 para a Fase 7.** O `config.toml` ficou com o registro
completo (e o comentário da Fase 1, *"container storage-api é instável no Windows"*, foi
**corrigido** — o motivo real é outro e está escrito lá), e o bloco do bucket ficou comentado,
pronto e **comprovadamente funcional**. Reativar exige CLI mais novo (2.111.0 disponível) ou
`storage-api` com o healthcheck corrigido.

**Efeito colateral verificado, que vale registrar:** o bucket **não sobrevive** ao `db reset` — o
CLI o recria a partir do `config.toml` no `start`. Isso reforça a decisão do plano de asserir
bucket **e** policies na suíte: se sumirem, o teste falha alto em vez de o upload ficar aberto.

## 9. EXTRA — benefício duplicado, corrigido na raiz

Desde a Fase 2 a `criarCupomAction` gravava `regras: [beneficio]` e `/m/cupom/[id]` concatenava os
dois — o mesmo texto aparecia duas vezes em todo cupom criado pelo formulário.

- A action **parou de copiar** (`regras: []`).
- A folha passou a exibir **benefício** e **regras** como seções distintas.
- O legado (cupons já gravados) é deduplicado **na exibição**, por `regrasParaExibir()` em
  `src/lib/cupom-campos.ts` — comparação normalizada (trim + minúsculas), porque a cópia antiga
  passava pelo `.trim()` da action. **Sem migration de dados.**
- A mesma dedupe entrou na tela de moderação do admin, que sofria do mesmo sintoma.

## 10. Verificação

`npm run verify` do zero (`db:reset` → 7 suítes → `next build`), exit **0**:

| Suíte | Asserções |
|---|---|
| `test:rls` (Fase 1) | 25 |
| `test:fase2` | 27 |
| `test:fase3` | 22 |
| `test:fase4` | 42 |
| `test:fase5` | 64 |
| `test:fase6` | 177 |
| **`test:fase65`** (nova) | **44** |
| **Total** | **401 PASS, 0 FAIL** |

`next build` verde — **46 rotas**, uma nova (`/e/cupom/[id]/editar`). `tsc --noEmit` e
`next lint` limpos.

**As 357 asserções das fases 1–6 seguem verdes. Nenhuma assertiva foi alterada** — a única
mudança em suíte antiga foi um *call site* (§11).

As 44 novas, por bloco: posse (2) · construtor do patch (7) · contrato parcial no banco (2) ·
matriz sem consumo (1) · matriz com validação (4) · matriz com ativação viva (9) · trigger não
barra admin/service_role (2) · ciclo C5 completo (12) · histórico protegido (1) · EXTRA (4).

**Smoke em runtime (local, `next dev` + navegador real):**

| O que | Resultado |
|---|---|
| **Editar só o título pelo `/e`** num cupom com janela Ter–Dom 18:00–23:00, prazo 8h, `validade_inicio` futuro com `ocultar_ate_inicio`, 2 regras e imagem | **Conferido no banco:** só `titulo` mudou. `horarios`, `validade_inicio`, `ocultar_ate_inicio`, `prazo_ativacao_horas` (8h), `regras` (as duas) e `imagem` **idênticos**; `status` continua `ativo`; histórico registra `editado` |
| O `/e` mostra o que preserva | Bloco *"Preservado nesta edição"* com dias/horário, prazo 8h e início 01/12 + *"Ajuste esses campos pelo portal"* |
| **Matriz com ativação viva, na tela** | Editar o benefício → *"Benefício, taxas e formas de consumo não podem mudar agora: **1 cliente(s)** têm este cupom ativo. A última ativação **vence em 03/08 18:52**."* — a frase do trigger, com contagem e horário em BRT, chegando intacta ao totem |
| **Editar pelo portal** (form completo) | Título alterado; `regras` e `imagem` — que o portal **não** expõe — preservados; janela e prazo intactos; `status` segue `ativo` |
| **Ciclo C5 inteiro pela UI** | Admin rejeita ("Rejeitar cupom" **desabilitado** com motivo em branco) → o lojista vê *"Motivo da recusa: …"* no card do `/e` → edita o benefício (o cupom **continua** `rejeitado`, motivo ainda visível) → "Reenviar para análise" → vira **"Em análise"** e o motivo **some** do card → admin aprova. Histórico final no banco: **`rejeitado,editado_material,reenviado,aprovado`** |
| **Benefício sem duplicata no `/m`** | Cupom com `regras[0]` = cópia do benefício (com caixa e espaços diferentes) + uma regra complementar: a folha mostra o benefício **uma vez** e só *"Válido só no balcão."* na lista |
| Cupom agendado não vaza | `/m/cupom/<agendado com ocultar_ate_inicio>` → **404**, como a Fase 5 definiu |

Zero erro de console em toda a sessão (fora o 404 esperado acima).

## 11. A regressão que o `verify` pegou (e que só ele pegaria)

A migration 21 trocou a assinatura de `rejeitar_cupom(text)` para `rejeitar_cupom(text, text)`.
O `tsc` apanhou o call site da aplicação (`src/lib/actions/admin.ts`) na hora — mas **não** o da
suíte da Fase 3, porque `.rpc()` aceita argumentos por objeto e o tipo gerado não reprovou a
chamada antiga em tempo de compilação. No `verify`, `test-fase3` caiu com **2 FAIL**:

```
FAIL  consumidor NÃO rejeita cupom (RPC) → sem_permissao
FAIL  admin rejeita pendente → ok, status rejeitado — null
```

Corrigido passando o motivo nos dois call sites. **Nenhuma assertiva foi alterada** — o que mudou
foi a chamada, não a expectativa.

> Detalhe operacional que também virou aprendizado: rodar `npm run verify | tail -80` devolve o
> exit code do **`tail`**, não do `verify`. A primeira leitura disse "exit 0" com 2 FAIL na tela.
> As execuções seguintes foram feitas com redirecionamento para arquivo e `echo $?`.

## 12. IMPACTO NA MIGRAÇÃO NATIVA

Princípio permanente: regra no servidor, lógica pura em `src/lib` sem API de navegador, só-web
isolado atrás de ponto trocável.

**Contratos de servidor que o app nativo herda prontos — o ganho maior desta fase:**
- **A matriz de imutabilidade é do banco.** O app nativo não vai precisar (nem conseguir)
  reimplementá-la: qualquer cliente que edite um cupom recebe o mesmo `P06xx` com a mesma frase
  em português, pronta para exibir. É o padrão da fase inteira — o cliente traduz, não decide.
- **`reenviar_cupom_moderacao`** é o único caminho de `rejeitado → pendente`, e é `security
  definer` restrita ao dono. O nativo chama a mesma RPC.
- **`rejeitar_cupom` exige motivo no servidor.** Um cliente nativo não consegue rejeitar em
  branco nem por engano.

**Módulos puros novos, reaproveitáveis como estão (sem DOM, sem `server-only`, sem `Intl`):**
- **`src/lib/cupom-patch.ts`** — o contrato de edição parcial. **Este é o mais importante da
  fase para o nativo:** o app nativo *também* vai ter um formulário reduzido (tela pequena, menos
  campos), e é exatamente esse cenário que apagaria dado em silêncio. A barreira já está escrita e
  testada, fora de qualquer camada web.
- **`src/lib/moderacao.ts`** — `historicoDeJson()` e `motivoAtual()`, defensivos no padrão de
  `economiaDeJson`: formato inesperado vira lista vazia, nunca exceção. `motivoAtual` embute a
  decisão de produto de só mostrar o motivo enquanto o status **for** `rejeitado` (o histórico é
  append-only; mostrar motivo antigo seria acusar o lojista de algo que ele já resolveu).
- **`regrasParaExibir()`** em `src/lib/cupom-campos.ts` — a dedupe do legado.

**Só-web, isolado:** as rotas `/e/cupom/[id]/editar` e a alternância `view` do portal são
navegação web; o contrato por trás (`carregarCupomParaEdicaoAction` → form → `editarCupomAction`)
é o mesmo que o nativo repete com o seu próprio roteador. O `Textarea` novo é primitivo de UI web
(padrão do `Input` já existente) e tem equivalente direto no RN.

**Cuidados herdados e ainda válidos:** validar `Intl` com `America/Sao_Paulo` no Hermes antes de
confiar em `dentroDaJanela` no cliente; e o alerta operacional de sempre conferir `wc -l` de
`src/lib/supabase/database.types.ts` depois de `db:types` (a Fase 6.5 já viu o arquivo sair
truncado em 178 linhas depois de uma falha transitória de container — o `tsc` fica verde e o erro
só aparece muito depois).

## 13. Deploy — o que precisa acontecer, na ordem

**Nada foi aplicado no hospedado.** Quando você aprovar, a coreografia é a mesma da Fase 6
(banco antes do código), com um detalhe novo:

1. **`db push` das migrations 20 e 21.**
2. **Janela conhecida entre o push e o deploy do código:** o app antigo chama
   `rejeitar_cupom(p_cupom_id)` — assinatura que deixa de existir. **A rejeição no admin fica
   indisponível nessa janela** (ação só-admin, de minutos). Aprovar continua funcionando; o
   lojista não é afetado.
3. **O trigger da migration 20 passa a valer para o código antigo também.** Isso é seguro: o
   portal atual não tem caminho de edição, então na prática o trigger só passa a proteger o
   `PATCH` direto — que hoje está aberto. **A janela banco-antes-código aqui *melhora* a
   segurança em vez de piorar.**
4. **Rollback só de código** (com o banco novo) devolve o comportamento da Fase 6, exceto a
   rejeição do admin, que precisa do código novo para passar o motivo.
5. Smoke em produção com `convidado@` — **`consumidor@` nunca tocado**.

## 14. Backlog

**Limpo nesta fase:** C2 (editar cupom) · C5 (rejeição com motivo) · benefício duplicado no
detalhe (achado da Fase 6) · o comentário desatualizado do `config.toml` sobre o Storage.

**Fase 7 (o que sai daqui):**
- **C4 — upload de imagem/Storage.** Desenho **pronto e revisado** (bucket público
  `cupom-imagens`, caminho `<cupom_id>/<32 hex>.<ext>`, **as quatro policies com o mesmo
  predicado — `SELECT` inclusive**, validação por magic bytes e 2 MB no servidor,
  `src/components/campo-imagem.tsx` como ponto trocável). **Bloqueado por ambiente, não por
  desenho:** ver §8. Primeiro passo da Fase 7 é reexecutar o gate com CLI 2.111.0.
- **Aviso na UI ao trocar a imagem** ("isso manda o cupom para nova análise") — a imagem é
  material pela matriz, então o rebaixamento é correto, mas não pode ser surpresa.
- **Redimensionamento de imagem no servidor**, se o peso incomodar (fora do C4 original).

**Continua pendente de decisão do cliente:**
- **⚠️ Periodicidade de uso ("1 por dia").** É o que o switch "Ilimitado" da Fase 6 *não* cobre:
  hoje "ilimitado" é literal, sem intervalo, e cada validação credita pontos e soma economia de
  novo. Precisa de coluna (`periodo_limite`) e janela de contagem em `ativar_cupom`. **Se a
  resposta for "eu queria 1 por dia", o switch entregue não atende** e a periodicidade precisa
  entrar antes de o cupom ilimitado ir para uso comercial.

**Resta (sem mudança nesta fase):** taxonomia Segmento→Categoria e o filtro completo · validação
por identidade nome+CPF · mural/indicadores no `/e` · destaque/banner no admin · exportar
relatórios · relatório de NPS do lojista · QR scanner real · `/admin/configuracoes` salvando
`config_pontos` · `validar-cupom-dialog` sem o motivo `esgotado` · ~20 hex amarelos fora dos
tokens · assets órfãos em `public/lp/consumidores/` · auto-cadastro de empresa · exclusão de
cupom pelo lojista (o desenho tem lápis **e lixeira**; esta fase entregou só o lápis) ·
`cupom_eventos` do seed todos anônimos, o que torna as métricas absolutas de `test-rls.ts`
estruturalmente frágeis no hospedado.

**Novo, achado nesta fase:**
- **Ambiente local sob contenção.** Com 3 stacks Supabase simultâneos (20 containers) em 8 vCPU /
  9,3 GB, o `supabase start` do promofy passou a falhar por `studio unhealthy`. Os outros stacks
  foram **parados temporariamente** com o seu OK e **religados ao fim da fase**. Se voltar a
  acontecer, é contenção de recurso, não defeito do projeto.
