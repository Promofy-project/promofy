# FASE 5 — Relatório de Implementação (Ajustes rápidos e correções de alta visibilidade)

*Branch: `fase-5-ajustes-rapidos` (a partir da `main`) · Data: 2026-07-30 · Status: **concluída e verificada local; ainda NÃO no ar***

> Sete itens pequenos levantados pelo cliente e pelos devs na reunião. Um deles **não era cosmético** e corrigia perda de cupom (§3). Nenhum exigiu refatorar o que já funcionava.
>
> **Pendente de decisão do usuário:** `supabase db push` no hospedado e deploy (coreografia banco-antes-código). Nada foi aplicado no ambiente do cliente.

---

## 1. Entregas (por commit)

| Commit | Entrega |
|---|---|
| `feat(fase5-db)` `d758a6b` | Migration 15: `dentro_da_janela`, `ativar_cupom` com motivo `fora_da_janela`, `responder_nps.pontos`, `meu_estado_consumidor.usos` + `pontos_resgate`; espelhos puros `src/lib/janela.ts` e `src/lib/codigo-cupom.ts`; `_janela-fixture.ts`; `test-fase5.ts` (64 asserções) |
| `feat(fase5-1)` `5a64a74` | **Item 1** — grafismo do fundo amarelo no motivo da marca |
| `feat(fase5-2)` `56376da` | **Item 2** — início à esquerda / validade à direita + saneamento de horário |
| `feat(fase5-3)` `0ef33b7` | **Item 3** — "visualizar senha" nas 5 telas de login, num componente só |
| `feat(fase5-7)` `c997faf` | **Item 7** — `/e/validar` aceita o código com e sem hífens |
| `feat(fase5-5)` `0dfc32e` | **Item 5** — botão esmaecido fora do intervalo de consumo |
| `feat(fase5-4-6)` `9074f4c` | **Itens 4 e 6** — selo "utilizado" + animação "+N pontos" |

35 arquivos, +1.795 / −88. Nenhuma migration aplicada foi editada.

## 2. Critérios de aceite — como cada um foi provado

| # | Critério | Prova |
|---|---|---|
| 1 | Fundo amarelo corrigido, de forma central | `wave-background.tsx` reescrito; 2 call sites e a assinatura **intocados**; cores em tokens novos. Screenshot de `/m/login` (§7) |
| 2 | Início à esquerda, validade à direita; nada muda no que é salvo | `novo-cupom-form.tsx:201-218` com os blocos trocados; `criarCupomAction` continua gravando `validade_inicio`/`validade_fim`. Horários **já estavam certos** — sem mudança (§6) |
| 3 | "Visualizar senha" nas 5 telas, via 1 componente | Playwright nas 5 rotas: olho presente e `password → text` ao clicar, sem erro de página |
| 4 | "Utilizado" na home, exceto com uso disponível | `test-fase5`: limite 2 com 1 ativa → `restantes=1` (sem selo); 2 validadas → `restantes=0` (com selo). E2E: selo aparece na home **sem F5** |
| 5 | Ativar fora da janela é **recusado pelo servidor**, com motivo próprio, e o botão aparece desabilitado | `test-fase5`: `fora_da_janela` por dia e por hora, **sem criar linha** em `cupons_usuario`. Runtime: `c02` às 20h de quinta esmaecido + mensagem |
| 6 | Animação "+pontos" após resgate e após NPS, com valor real | E2E: **+50** no resgate e **+30** no NPS, batendo com `config_pontos`. `test-fase5` prova a origem dos dois números no banco |
| 7 | `/e/validar` aceita com e sem hífens; normalização pura e testada | E2E: lojista digitou `PRMFLV65HUJX` e validou. 9 asserções puras de `normalizarCodigoCupom` |
| 8 | Suítes anteriores verdes + novos testes; build verde; zero regressão | `npm run verify` = **25 + 27 + 22 + 42 + 64 = 180 PASS, 0 FAIL** + `next build` (46 páginas) |

## 3. O item que não era cosmético — janela de consumo

**Antes:** `ativar_cupom` checava só `validade_inicio`/`validade_fim`. Um cupom "Seg a Sex, 11h às 15h" podia ser ativado num **domingo às 3h**: o código nascia com 5h de prazo e o consumidor **perdia o cupom**. `horarios.dias`/`inicio`/`fim` eram usados só para exibição e para o filtro de dia da busca (Fase 4) — nunca como regra.

**Agora:** `dentro_da_janela(jsonb)` + checagem em `ativar_cupom` → motivo **`fora_da_janela`**. A UI só espelha: botão esmaecido com `aria-disabled` (e **não** `disabled`, senão o toque não dispararia nada e o usuário ficaria sem saber por quê), mensagem "Cupom fora do intervalo de consumo." — a mesma frase nos dois caminhos.

**Decisão de design que vale registrar: `horarios` malformado é "SEM RESTRIÇÃO", nunca "fora" e nunca exceção.** Os `<input type="time">` do portal não são `required`, então dava para gravar `{"inicio":"","fim":""}`; a coluna não tem `CHECK` e o lojista ainda pode escrever `horarios` direto via PostgREST (grant por coluna da Fase 3). Um `''::time` dentro de `ativar_cupom` — `security definer`, **sem** bloco `exception` — abortaria a transação, viraria 500, e a Server Action devolveria `motivo:'erro'`: **o cupom aprovado ficaria permanentemente inativável**, com "Não foi possível usar o cupom agora" e nenhum diagnóstico. O saneamento cobre `""`, lixo, `dias` não-array, `horarios` array/null. Defesa em profundidade no form (§6) impede gravar a sujeira em primeiro lugar.

**Idempotência preservada:** o ramo `ja_ativo` fica **antes** da checagem — quem ativou dentro da janela reabre o mesmo código mesmo depois de ela fechar. Provado em teste.

**`validar_cupom` não mudou:** ativou dentro da janela, tem as 5h para resgatar no balcão.

## 4. O bloqueador que quase passou — `verify` impossível de ficar verde

Encontrado ao verificar o plano, **antes** de escrever código.

As suítes das fases 1–3 ativam cupons do seed que **têm** janela:

| Suíte | Linha | Cupom | Janela |
|---|---|---|---|
| `test-rls.ts` | 169 | `c01` | Ter–Dom, 18:00–23:00 |
| `test-fase2.ts` | 84, 95 · 154, 162 · 176 | `c01` · `c02` · `c03` | — · Seg–Sex 11:00–15:00 · Seg–Sáb 06:00–22:00 |
| `test-fase3.ts` | 166, 170 | `c02`, `c01` | — |

As janelas de `c01` e `c02` são **disjuntas** (c01 exclui Seg; c02 exclui 18h–23h): com a barreira ligada **não existiria hora do dia** em que `npm run verify` ficasse verde. Não seria "flaky às vezes" — seria sempre vermelho.

**Correção:** `scripts/_janela-fixture.ts` — `abrirJanela` antes dos testes, `restaurarJanela` em `try/finally` devolvendo o jsonb original. Aditivo: **nenhuma asserção existente foi tocada**. As suítes voltam a provar o que sempre quiseram provar (o ciclo do cupom) sem depender do relógio; quem prova a janela é `test-fase5`, com fixtures próprios (`f5-*`) e sem tocar no seed.

Confirmado empiricamente: as três suítes passaram às 19h40 de uma quinta, horário em que `c02` está **fora** da janela.

## 5. Revisão adversarial (4 lentes) — o que ela mudou

Antes de implementar, o plano passou por 4 lentes (segurança/RLS · Next.js/não-quebrar · reprodutibilidade · migração-nativa), cada achado submetido a um verificador cético independente. **3 defeitos reais sobreviveram**, todos corrigidos no plano antes da primeira linha de código:

| Defeito | Onde foi corrigido |
|---|---|
| `horarios` com `""`/lixo faria `''::time` explodir dentro de uma `security definer` sem `exception` → cupom aprovado vira tijolo | Saneamento em `dentro_da_janela` + espelho TS + defesa no form + 8 casos de teste |
| `usos` seria descartado no `layout.tsx` (monta `EstadoInicial` campo a campo) e nunca atualizado in-session → selo só apareceria após F5 | Propagação nos 3 pontos + `usos` devolvido por `consultarCupomAction` |
| Fixture de janela de 1 min derivado do relógio do **host** tem margem zero contra o `now()` do **Postgres** | Fixture de 1h ancorado no relógio do banco (lido de `ativado_em`) |

As 4 lentes também redescobriram o bloqueador da §4 de forma independente — os verificadores as rejeitaram como duplicata por já estar no plano.

**Levantado e descartado:** `grant update (horarios)` ao lojista é comportamento pretendido (a defesa é o saneamento, não mexer em RLS); `Intl` do `diaSemanaBrt` não quebra hoje (não há runtime RN no repo e o cálculo é server-side).

## 6. Detalhes por item

**Item 1 — grafismo.** Não existe manual de identidade no repo. Existe asset de marca: `public/lp/*/wave-amarela.png`, já no ar na `/para-empresas`. O que estava no `/m` era outra coisa — riscos diagonais rotacionados −14° com hex chapado (`#E6A700`/`#FFE08A`), desenhados à mão. Refeito em **SVG** no motivo da marca (ondas amplas irradiando de um foco fora do quadro), com as cores em tokens novos (`--promofy-wave-deep`, `--promofy-wave-light`). SVG e não o PNG: 197 KB de raster na tela de login, esticado ~2,9× num 390×844, borraria e pesaria no LCP. **O grafismo definitivo do manual entra trocando só `src/components/wave-background.tsx`.**

**Item 2 — datas.** Trocada a ordem das duas caixas em `novo-cupom-form.tsx:201-218`. **Os horários já estavam corretos** (Início → Fim) — verificado, sem mudança. O `/e/cupom/novo` tem só "Válido até", sem par de datas: nada a inverter (cadastro completo no `/e` segue pendente, §9).

**Item 3 — senha.** `PasswordInput` novo, plugado no `Field`, que já é o primitivo comum das 5 telas — nenhuma delas mudou. Ficou em arquivo próprio (e não dentro do `Field`) para o `Field` continuar **server-safe**: `/m/perfil/dados` é server component e usa `Field` sem senha.

**Item 4 — selo.** `usos` (consumidos/limite/restantes) com a **mesma expressão** de `ativar_cupom`. `CouponCard`/`CouponListItem` ganharam a prop `overlay` (ReactNode — elemento serializa entre RSC; *função* de componente não, lição do bug do `/e` na Fase 3) e seguem server components. Landing e portal não passam overlay → inalterados.

**Item 6 — animação.** `pontos_resgate` por linha e `responder_nps.pontos` (o que o `RETURNING` creditou de fato). Resposta repetida devolve 0 e **não anima**. O chip ficou ancorado no alto: centrado, cobria justamente a frase que diz quantos pontos foram ganhos.

**Item 7 — código sem hífens.** `normalizarCodigoCupom` limpa, tira o prefixo e reconstitui `PRMF-XXXX-XXXX`. Comprimento diferente devolve só o texto limpo — **não inventa formato**, para não arriscar casar com o cupom de outra pessoa. `toUpperCase` (não `toLocaleUpperCase`): no turco o "i" viraria "İ" e corromperia o código. Aplicado também no dialog do portal. **A RPC e o formato gravado não mudaram.**

## 7. Verificação

**`npm run verify` do zero:** `db:reset` (15 migrations + seed + seed-users) → RLS **25** · Fase 2 **27** · Fase 3 **22** · Fase 4 **42** · Fase 5 **64** = **180 PASS, 0 FAIL** → `next build` **46 páginas**. `tsc --noEmit` e `next lint` limpos.

**Smoke em runtime (dev + Playwright), não só build** — lição da Fase 3, em que o bug de RSC do `/e` passou pelo build e quebrou em produção:

- `/m/login`, `/m/cadastro`, `/m/filtros`, `/para-voce`: renderizam sem erro de hidratação (carga limpa).
- 5 telas de login: olho presente, `password → text`, sem erro de página.
- `/m/cupom/c02` (Seg–Sex 11h–15h) às 20h de quinta: **esmaecido** + "Cupom fora do intervalo de consumo."; `c01` (dentro) e `c07` (legado) seguem ativáveis.
- **Ciclo completo em dois contextos de navegador:** consumidor ativa `c01` → lojista digita o código **sem hífens** em `/e/validar` → validado → **+50** no resgate → NPS abre sozinho → **+30** → volta para `/m` **sem F5** → selo "Utilizado" aparece. **Zero erro de página.**

## 8. IMPACTO NA MIGRAÇÃO NATIVA

Princípio permanente: regra no servidor, lógica pura em `src/lib` sem API de navegador, só-web isolado atrás de ponto trocável.

**Reaproveitável no RN, sem reescrever:**
- `src/lib/codigo-cupom.ts` — `normalizarCodigoCupom` é puro, sem DOM, sem `server-only`. É **no nativo que ele mais importa**: digitar hífen em teclado de celular é o pior caso.
- `src/lib/janela.ts` — `dentroDaJanela` puro. Import relativo (`./dias`) de propósito, para não depender do alias de path do tsconfig do Next.
- **Os contratos de servidor**, que são o ganho maior: o motivo `fora_da_janela`, a chave `usos` e os campos `pontos_resgate` / `responder_nps.pontos`. O app nativo chama **as mesmas RPCs** e recebe **o mesmo jsonb** — a barreira de janela, a cota por usuário e o valor dos pontos já estão prontos para ele. Nada disso precisa ser reimplementado.
- `getUsos` do provider e o padrão Context em geral.

**Só-web, será reescrito (mas isolado num ponto de troca cada):**
- `src/components/pontos-pop.tsx` — keyframe CSS + overlay no DOM → `Animated`/Reanimated. **O gatilho migra; o arquivo não.**
- `src/components/password-input.tsx` — `<input type>` + ícone → `TextInput secureTextEntry` + `Pressable`.
- `src/components/wave-background.tsx` — SVG inline; o **motivo** migra (via `react-native-svg`), o arquivo não.
- O layout `grid sm:grid-cols-2` do formulário → flex nativo.
- `foraDaJanela` calculado no servidor e passado por prop: no RN não há render de servidor, então o app chamará `dentroDaJanela` local (o mesmo módulo puro) e continuará tratando a RPC como barreira real.

**Cuidado herdado e confirmado nesta fase:** `Intl.DateTimeFormat` com `timeZone` é a dependência mais frágil do `src/lib/janela.ts` no Hermes. Hoje não há runtime RN no repo e o cálculo é server-side; ao iniciar o app nativo, **validar `Intl` com `America/Sao_Paulo` no Hermes antes de confiar em `dentroDaJanela` no cliente** (e, se faltar, usar build com `intl` habilitado ou passar o offset). O `hourCycle: "h23"` já está lá por um motivo parecido: com `hour12: false` algumas versões do ICU devolvem "24" à meia-noite.

## 9. Pendências para as próximas fases (honesto)

**Não feitas nesta fase, por escopo:**
- **Cadastro de cupom completo no `/e`** (hoje só título/benefício/validade/limites; sem par de datas, sem horário, sem imagem).
- **Economia variável** por cupom/uso.
- **Taxonomia Segmento → Categoria** e os filtros correspondentes.
- **Mural de avisos e indicadores no `/e`** (`docs/modelo/estabelecimento-mobile/Mural de informações.png`, `NPS.png`).
- **Destaque/banner no admin.**
- **Validação por identidade** no balcão.
- **Editar cupom / rejeitar com motivo.**

**Herdadas e ainda abertas:**
- Relatório de NPS do lojista; QR scanner real (câmera) e upload de imagem (storage desligado); `/admin/configuracoes` salvando `config_pontos`.
- **Cleanup das suítes com escopo restrito** (Fase 4 §9) — `test-rls`/`test-fase2`/`test-fase3` ainda deletam **em bloco por usuário**. Seguro só porque o banco local é descartável.
- Contas `qa-*` descartáveis no hosted como padrão para qualquer teste mutante.

**Achadas nesta fase e deixadas de fora de propósito:**
- `validar-cupom-dialog.tsx` (portal) **não mapeia o motivo `esgotado`** — cai na mensagem genérica. O `/e` trata certo. Uma linha, mas fora do escopo pedido.
- ~20 hex amarelos espalhados (`points-summary.tsx`, `banner-carousel.tsx`, `podium.tsx`, `cta` no `tailwind.config.ts`, `#8a6d0b` em 6 arquivos) **não seguem os tokens**. Não são "o grafismo", mas travam um rebrand futuro.
- `public/lp/consumidores/wave-amarela.png` e `sombra-radial.png` são **assets órfãos** (~590 KB sem referência em `src/`).

## 10. Riscos conhecidos e o que decidir antes do deploy

1. **A barreira muda comportamento no ar.** `c01` ("Ter a Dom, 18h–23h") e `c02` ("Seg a Sex, 11h–15h") passam a **recusar ativação fora da janela** — inclusive numa demo às 10h. É exatamente o que o item 5 pediu. Os cupons legados (só `{descricao}`) seguem sem restrição, então **sempre há cupom ativável** no catálogo. No hospedado, `c03` e `c05` também ganharam `dias` no embelezamento da Fase 4. **Ajustar a janela dos cupons de demo é um passo separado, só com o seu OK** — nenhum dado do cliente foi tocado.

   **DECIDIDO em 31/07/2026 (aplicado no hospedado).** `c02`, `c03` e `c05` foram alargados para **todos os dias, 00:00–23:59**. A mecânica segue **engajada**, não desligada: `dias` continua sendo um array com os 7 rótulos canônicos e `inicio`/`fim` continuam presentes, então `dentro_da_janela` avalia os dois ramos (dia e hora) como sempre — só os valores alargaram. `descricao` foi atualizada junto ("Todos os dias, 00:00 às 23:59") para o rótulo da vitrine não mentir sobre o botão.

   **`c01` ("Rodízio de pizza em dobro", Ter a Dom 18h–23h) foi MANTIDO restrito de propósito: é o cupom de exemplo com janela — a demonstração viva da barreira.** Fora de Ter–Dom 18h–23h ele é o item do catálogo que mostra o botão esmaecido com "Cupom fora do intervalo de consumo." e cuja RPC recusa com `fora_da_janela`. Quem for rodar o roteiro de smoke: **use `c01` para demonstrar a barreira e qualquer um dos alargados (`c02`/`c03`/`c05`) para o ciclo principal** — e note que um `c01` **já ativo** reabre normalmente mesmo fora da janela (o ramo idempotente vem antes da checagem).

   Não tocados: `c04`, `c06`–`c12`, os cupons do cliente (`c2ff55a5`, `093cb015`, `40b297aa`, `ae1fa920`) e os rejeitados. Diff sobre os 20 cupons do hospedado confirmou **3 linhas alteradas, exatamente as autorizadas**. Atenção: o `seed.sql` **não** foi alterado, então um `db:reset` local devolve `c02`/`c03`/`c05` às janelas estreitas — a partir daqui, os dados de vitrine local e hospedado divergem de propósito.
2. **O espelho pode envelhecer.** `foraDaJanela` é calculado na renderização do servidor; quem deixa a tela aberta atravessando o fim da janela vê o botão habilitado e leva o `fora_da_janela` da RPC — com a mensagem certa. Aceito: a barreira é o servidor.
3. **`test:rls:hosted` NÃO PODE rodar no hospedado como está — BLOQUEADOR (achado em 31/07/2026).** Além de mutar `cupons.horarios` transitoriamente (abre e restaura em `finally`), a suíte **loga como `consumidor@promofy.test`** — conta do cliente — em `scripts/test-rls.ts:125`, e a limpeza do fim (linhas 257–260) apaga **por `usuario_id`, não pelas linhas que ela criou**:

   ```
   svc.from("cupons_usuario").delete().eq("usuario_id", meuId);
   svc.from("cupom_eventos").delete().eq("usuario_id", meuId);
   svc.from("pontos_transacoes").delete().eq("usuario_id", meuId).neq("acao", "bonus");
   svc.from("profiles").update({ cidade: null }).eq("id", meuId);
   ```

   Medido no hospedado (leitura): rodá-la apagaria **3 linhas de `cupons_usuario`, 12 de `cupom_eventos` e 4 de `pontos_transacoes`** do `consumidor@`, derrubando o saldo de **1.410 → 1.250**. É destruição de dado de demonstração do cliente, irreversível sem restauração manual. O `finally` protege `horarios`, **não** protege a conta. Para provar RLS no hospedado é preciso **parametrizar a conta de consumo da suíte e usar uma conta `qa-*` descartável** — hoje o e-mail é literal. Regra permanente reafirmada: **nenhuma suíte contra as contas/dados que o cliente usa.**
4. **`/m/cupom/[id]` faz uma consulta a mais** — passou a buscar `buscarCupomPorId` sempre (antes só quando o mock não tinha o id), porque a janela precisa vir do banco. Um `maybeSingle()` por PK numa página que já é `force-dynamic`.

## 11. Estado dos ambientes

- **Local:** `npm run verify` verde do zero; banco no estado do seed (o `db:reset` do verify foi a última operação).
- **Hospedado (`bpeqpxvxgdyjjdcoycgp`) — 31/07/2026:** DDL da migration 15 **aplicada** e **registrada** no histórico (`supabase_migrations.schema_migrations`, versão `20260730120000`, via `migration repair --status applied`). **A fidelidade da linha foi provada por experimento, não por suposição:** o `repair` lê o próprio `.sql` e usa o mesmo `parser.SplitAndTrim` do `db push`; rodá-lo em cima da linha LOCAL — que o `db push` tinha escrito — deixou `md5(statements::text)` inalterado (`164c6a6d839fcf637001e419d0cc3e42`, `name=fase5_janela_pontos_usos`, 9 statements). Logo a linha do hospedado é idêntica à que um `db push` teria gravado. `migration list` mostra a 15 com `local` e `remote` preenchidos **nos dois bancos** (`--linked` e `--local`); `db push --dry-run` responde `{"upToDate":true,"migrations":[]}`. Dados: só a janela de `c02`/`c03`/`c05` (ver seção 10, item 1). Nenhuma suíte rodada ainda.
- **Vercel:** **sem deploy.** A `main` segue com a Fase 4 no ar.

### Divergência local × hospedado na vitrine — INTENCIONAL, não é bug

A partir de 31/07/2026 os dados de vitrine **divergem de propósito** entre os dois ambientes:

| | `seed.sql` (local, após `db:reset`) | Hospedado |
|---|---|---|
| `c02` | Seg–Sex, 11:00–15:00 | **Todos os dias, 00:00–23:59** |
| `c03` | Seg–Sáb, 06:00–22:00 | **Todos os dias, 00:00–23:59** |
| `c05` | Ter–Sáb, 09:00–19:00 | **Todos os dias, 00:00–23:59** |
| `c01` | Ter–Dom, 18:00–23:00 | Ter–Dom, 18:00–23:00 *(igual — é a demo da barreira)* |

**Por quê:** no hospedado a vitrine precisa ser demonstrável a qualquer hora, e `c01` sozinho basta para exibir a barreira. No local, as janelas estreitas do seed são o material de teste. **Não "conserte" essa diferença achando que é bug.** Se um dia quisermos convergir, é um commit à parte alterando o `seed.sql` — e aí o local perde as janelas estreitas que as suítes usam como fixture.

- **CONCLUÍDO em 31/07/2026:** ~~`test:rls:hosted`~~ pulado por decisão registrada (seção 10, item 3 — a migration 15 não altera policy nenhuma, a RLS já está verde no local, e o que a Fase 5 muda é comportamento de RPC, melhor coberto pelo smoke). Merge `--no-ff` `fase-5` → `main` (`23846ac`), push `05c3071..23846ac`, build no ar e confirmado, smoke completo com `convidado@`. Rollback (deployment da Fase 4, `05c3071`) ficou de prontidão e **não foi necessário**.

## 12. BACKLOG CONFIRMADO EM PRODUÇÃO

Os quatro achados abaixo foram observados **no ar**, em `promofy-pro.vercel.app`, durante o smoke de 31/07/2026. **Nenhum é regressão da Fase 5** — para cada um, `git diff 05c3071..HEAD` prova que o arquivo (ou a constante) não foi tocado pela fase. Ficam aqui para a Fase 6 puxar.

### 12.1 — ALTA · `horariosTabela` hardcoded contradiz a barreira real

[`src/app/m/cupom/[id]/page.tsx:26`](../src/app/m/cupom/%5Bid%5D/page.tsx) — a tabela "Regras de Uso" é uma constante literal: `{ dia: "Hoje, Quinta", manha: "09:00 - 16:00", noite: "09:00 - 16:00" }`. Não lê `cupons.horarios`.

**Por que é ALTA e não cosmético:** desde a Fase 5 a MESMA tela barra o cupom fora da janela. Observado no ar numa **sexta-feira** às 14h: a tabela anunciava "Hoje, Quinta" e "09:00 – 16:00" todos os dias, enquanto o servidor aplicava Ter–Dom 18h–23h no `c01`. O consumidor lê um horário, o botão obedece a outro. É a única contradição visível que a barreira introduziu, e ela mora ao lado do botão. Corrigir = alimentar a tabela a partir de `horarios` (`dias` + `inicio`/`fim`), reusando `DIAS_SEMANA` e `diaSemanaBrt` (`src/lib/dias.ts`), que já acertam o dia — o chip "HOJE" do `/m/buscar` marcou **Sex** corretamente no mesmo instante.

### 12.2 — `/cadastro` é 404 e está linkado em 5 pontos públicos

A rota não existe (confirmado: `curl` → 404) e é alvo de `<Link href="/cadastro">` em:

| Arquivo | Linha |
|---|---|
| [`src/app/page.tsx`](../src/app/page.tsx) | 54 |
| [`src/app/para-empresas/page.tsx`](../src/app/para-empresas/page.tsx) | 306, 320, 742 |
| [`src/app/para-voce/page.tsx`](../src/app/para-voce/page.tsx) | 275 |

Sintoma colateral: o prefetch RSC do Next dispara um erro de console na landing (`/cadastro?_rsc=… 404`). Decidir se a rota passa a existir ou se os links apontam para `/m/cadastro` / `/portal/cadastro`.

### 12.3 — Filtros de categoria decorativos (não filtram nada)

- [`src/components/home-category-chips.tsx:11,21`](../src/components/home-category-chips.tsx) — `active` é `React.useState` local e o `onClick` só alterna a cor do próprio chip. Não há callback, query param, nem refetch: a lista da home **não muda**. Observado no ar: com "Beleza" em `aria-pressed="true"`, os 6 cupons continuaram na tela, incluindo os de alimentação.
- [`src/app/m/filtros/page.tsx:11`](../src/app/m/filtros/page.tsx) — as opções são literais (`["Todos","Alimentação","Lazer","Compras","Serviços"]`), divergentes das categorias reais do banco (faltam `fitness`, `beleza`, `eletronicos`, `educacao`, `pet`); e o "Aplicar" da linha 104 é um `<Link href="/m">` sem parâmetro — navega de volta e descarta a seleção.

O filtro que **funciona** é o de `/m/buscar` (busca textual + dias). A junção multi-categoria da Fase 4 está correta no banco e é aplicada no portal (o form do `lojista@`/e1 oferece só "Alimentação" e "Fitness"); o que falta é ligá-la a estas duas telas.

### 12.4 — Validade divergente banco × mock

[`src/lib/mock-data.ts:180`](../src/lib/mock-data.ts) — o mock do `c02` traz `validade: "2026-08-12"`, enquanto o banco tem `2026-08-20`. A home renderiza do banco ("Válido até 20/08") e a folha do cupom ativado ([`src/components/cupom-ativo-sheet.tsx`](../src/components/cupom-ativo-sheet.tsx)) renderiza do mock ("Válido até 12/08"). O mesmo cupom exibe duas validades em duas telas do mesmo fluxo — e a folha é justamente a tela que o consumidor mostra no caixa.

*(Nota de ferramenta: `playwright` foi instalado com `npm install --no-save` só para o smoke em runtime. `package.json` e `package-lock.json` **não** foram alterados.)*
