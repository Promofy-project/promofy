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
2. **O espelho pode envelhecer.** `foraDaJanela` é calculado na renderização do servidor; quem deixa a tela aberta atravessando o fim da janela vê o botão habilitado e leva o `fora_da_janela` da RPC — com a mensagem certa. Aceito: a barreira é o servidor.
3. **`test:rls:hosted` passa a mutar `cupons.horarios`** transitoriamente (abre e restaura em `finally`). É a única suíte que o projeto roda no hospedado. A regra permanente continua: **nenhuma suíte contra as contas/dados que o cliente usa** sem decisão explícita.
4. **`/m/cupom/[id]` faz uma consulta a mais** — passou a buscar `buscarCupomPorId` sempre (antes só quando o mock não tinha o id), porque a janela precisa vir do banco. Um `maybeSingle()` por PK numa página que já é `force-dynamic`.

## 11. Estado dos ambientes

- **Local:** `npm run verify` verde do zero; banco no estado do seed (o `db:reset` do verify foi a última operação).
- **Hospedado (`bpeqpxvxgdyjjdcoycgp`):** **intocado.** Nenhuma migration aplicada, nenhum dado alterado, nenhuma suíte rodada.
- **Vercel:** **sem deploy.** A `main` segue com a Fase 4 no ar.
- **Próximo passo (com seu OK):** `supabase db push` da migration 15 no hospedado (com dry-run antes) → deploy → smoke no ar.

*(Nota de ferramenta: `playwright` foi instalado com `npm install --no-save` só para o smoke em runtime. `package.json` e `package-lock.json` **não** foram alterados.)*
