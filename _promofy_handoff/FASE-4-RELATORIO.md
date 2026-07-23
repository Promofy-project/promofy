# FASE 4 — Relatório de Implementação (Descoberta + Favoritos + 2 bugfixes de produção)

*Branch: `fase-4-descoberta-favoritos` (mesclada à `main`, fast-forward) · Data: 2026-07-23 · Status: **concluída, no ar e validada***

**URL de produção:** **https://promofy-pro.vercel.app** · Supabase hospedado `bpeqpxvxgdyjjdcoycgp` (sa-east-1) · deploy `dpl_9CRBv1cu7…` (commit `eb736bc`, build ~77s).

> Continuação da Fase 3. Além das entregas de descoberta (multi-categoria, favoritos, novidades, busca real com filtro de dia), esta fase **corrigiu dois bugs de produção** e registrou um **incidente de processo** (premissa de restauração errada) com a lição correspondente. Diretriz mantida: o cliente (Lucas) usa o ambiente ao vivo — **erro visível é inaceitável**.

---

## 1. Entregas (por commit)

| Commit | Entrega |
|---|---|
| `feat(fase4-db)` `c216b1e` | Migrations: `estabelecimento_categorias` (N categorias/estab, junção admin-managed), `favoritos`, `novidades` (`novidades_visto` + RPCs) |
| `feat(fase4-a)` `09480ec` | Seletor de N categorias no cadastro de cupom (lê o conjunto do estabelecimento) + escrita da junção só-admin |
| `feat(fase4-b)` `6380640` | `/m/buscar` **sai do mock** (catálogo real do banco) + **filtro por dia da semana** (`src/lib/dias.ts`, fuso BRT) |
| `feat(fase4-c)` `d293c69` | Favoritar estabelecimento **persistido no banco** + home reordenada (favoritos no topo) |
| `feat(fase4-d)` `84d07a1` | Notificação in-app de cupom novo de favorito (sino + `/m/novidades`) |
| `test(fase4)` `ec37ef9` | Suíte `test-fase4.ts` (multi-categoria/favoritos/novidades/dias) + `verify` |
| `test(fase4)` `66b583e` | **Cobertura do fix do Bug 1** (`buscarCupomPorId` por anon) + guarda de paridade mock↔banco |
| `fix(fase4-bug2)` `eb736bc` | **AuthSync** (fix do Bug 2) |

Fecha duas pendências da Fase 3 (§10): **multi-categoria por estabelecimento** e **`/m/buscar`/`/m/favoritos` ainda no mock**.

## 2. Os dois bugs de produção corrigidos

**BUG 1 — cupom recém-aprovado dava 404 no `/m`.**
- **Causa raiz:** em `main` (Fase 3), `src/app/m/cupom/[id]/page.tsx` era **SSG mock-only** (`generateStaticParams` + `getCupom`). Um cupom criado no `/e` e aprovado no admin vive no **banco**, nunca no mock → `getCupom` retornava `undefined` → `notFound()` → 404. Não era o SSG em si; era a **fonte de dado mock-only**.
- **Fix (já presente na fase-4):** `export const dynamic = "force-dynamic"` + fallback `getCupom(id) ?? await buscarCupomPorId(id)` (mesma regra de visibilidade do catálogo; invisível/expirado → `null` → 404 legítimo).
- **Caso de borda checado:** cupom-seed abre pelo mock e renderiza `<FavoriteButton estabelecimentoId="e1">`; **sem regressão** — o schema mantém os ids do mock como TEXT (`e1`/`c01`), então `"e1"` é um estabelecimento real e ativo. Favoritar pelo detalhe funciona.
- **Prova:** 3 novos asserts em `test-fase4` (pendente→404, aprovado→lido por anon, expirado→404) + guarda de paridade mock↔banco; e **no ar** (§4).

**BUG 2 — `/m` aparecia logado sem sessão; "Perfil" deslogava.**
- **Causa raiz:** o `/m` é SPA App Router; ao voltar à home por link interno/botão-voltar, o Next serve o payload do **Router Cache** do cliente. Se a sessão caiu nesse meio-tempo, a home reaparecia **logada com pontos velhos** — o servidor renderiza certo (carga completa = anônima), mas o cache do cliente mentia. **Nada em `/m` revalidava a sessão** (não existia nenhum `onAuthStateChange` no código). Descartadas as hipóteses iniciais: `force-dynamic` já estava presente; o provider de pontos não lê `localStorage`. Camada confirmada empiricamente (build de prod + Playwright): link interno/voltar → payload velho; carga completa → anônima.
- **Fix:** componente client `AuthSync` montado estável no layout `/m`, que compara a sessão real do browser com o que o servidor renderizou (`serverLogado`) e, no descompasso (`SIGNED_OUT` por expiração ou logout em outra aba), chama `router.refresh()` — invalida o Router Cache e re-renderiza. Guarda anti-loop por `serverLogado`. Sessão coerente → nenhum refresh (caminho feliz e `TOKEN_REFRESHED` intocados). Sem mexer em `staleTimes`/perf.
- **Prova:** build de produção + Playwright (2 abas): logout na aba B → home logada da aba A vira **anônima sem F5**, mostra o card de login, **estável** (0 re-render em 2,5s, sem loop); caminho logado-válido intacto. Deployado (`onAuthStateChange` presente no bundle de produção).

## 3. Verificação local — 116/116 + build

`npm run verify` na `fase-4` com os fixes: **RLS 25 · Fase 2 27 · Fase 3 22 · Fase 4 42 = 116 PASS, 0 FAIL** + `next build` (46 páginas). (Fase 4 subiu de 38→42 com os 4 asserts do Bug 1.)

## 4. Validação no ar (Passo 6) — resumo

| Item | Resultado |
|---|---|
| Bug 1 | ✅ cupom novo pendente → **404**; aprovado no admin → `/m/cupom/…` **200** + título renderiza. Moderação do admin OK (sem regressão). |
| Bug 2 | ✅ deployado (`onAuthStateChange` no bundle) + servidor correto (anon→anônima). Heal exaustivamente provado local no commit idêntico. **Não** fiz logout-global ao vivo (revogaria a sessão do Lucas). |
| Fluxo principal | ✅ entrada do ciclo ao vivo no `convidado@`: `ativar_cupom` gerou código `PRMF-KK8P-8U6Q`. Validação+NPS+pontos é código **não tocado pela Fase 4** (provado local `test:rls` 25/25 + estado real `c01 validado`). Ativação de teste removida pontualmente. |
| Features Fase 4 | ✅ seletor de categoria · ✅ favoritar **persiste em reload** (DB-backed) · ✅ busca real (11 resultados) + filtro de dia interativo · `/m/novidades` 200 + lógica provada local. |

## 5. Incidente de processo — premissa de restauração errada (honestidade + lição)

A ordem de teste no hosted incluía "rodar `test:rls:hosted`+`test:fase4:hosted` e **restaurar para 1.250 pts / R$0 / 0 favoritos**" (baseline de seed pré-reunião).

- **Descoberta (checagem antes de executar):** as contas compartilhadas tinham **atividade real do cliente** — `consumidor@` e `convidado@` em **1.330 pts / R$45 / c01 `validado`** (fluxo principal completo, feito pelo Lucas ao vivo).
- **Risco evitado:** o cleanup das suítes faz **delete EM BLOCO por usuário** (`cupons_usuario`, `pontos_transacoes` não-bônus, `favoritos`, `cupom_eventos`). Rodá-las teria **apagado a demo do Lucas**, e "restaurar para 1.250/0" teria **confirmado a destruição como sucesso**.
- **Decisão:** **não** rodar as suítes destrutivas nas contas do cliente. RLS das tabelas novas provada por: (a) local **116/116** exercitando as mesmas policies, (b) `db push` aplicando **DDL idêntico**, (c) checagens comportamentais **read-only** no hosted (anon `42501` em `favoritos`/`novidades_visto`; junção **filtra** e4 pendente vs e1 ativo).
- **Lição:** instrução destrutiva que assume um "estado esperado" deve ter a **premissa verificada contra o estado real** antes de executar — o número dado pelo humano pode estar desatualizado.

## 6. Regras registradas na memória do projeto

1. **`verify-premises-before-destructive-ops`** — antes de delete/reset/restore com "estado esperado", capturar o estado real (read-only) e comparar; divergiu → parar e mostrar.
2. **`no-suites-on-shared-client-accounts-hosted`** — REGRA PERMANENTE: nenhuma suíte automatizada (`test:*:hosted`) roda contra contas compartilhadas com o cliente no hosted. Se precisar testar no hosted, criar contas descartáveis dedicadas (ex.: `qa-consumidor@promofy.test`) e usar só elas.

## 7. Ambiente hospedado — estado final

- **Schema:** `supabase db push` das 3 migrations Fase 4 (dry-run antes; sem drift — remoto estava exatamente na Fase 3). Checkpoint verificado logo após a escrita: junção com backfill 1 linha/estab (categoria principal), `favoritos`/`novidades_visto` criadas e vazias, RLS habilitada, contagens intactas (6 estab / 16 cupons).
- **Embelezamento pós-deploy (via service_role = caminho admin-managed da junção):** `e1` ganhou a 2ª categoria **fitness** (exemplo multi-categoria "restaurante fitness"); **dias** preenchidos em `c01`/`c02`/`c03`/`c05` (variação real para o filtro de dia).
- **Contas do cliente restauradas ao baseline** (o que o Lucas vê): `consumidor@` e `convidado@` = **1.330 pts / R$45 / c01 `validado` / 0 favoritos / 0 novidades**. `consumidor@` intocada; `convidado@` restaurada (favoritar desfeito, ativação de teste apagada pontualmente).
- **Cupom de teste QA removido** por completo (catálogo = 16). `e1` ativo, `e4` pendente, `e6` suspenso (como antes).
- **Rollback à mão:** `dpl_492V6mir…` (Fase 3), `isRollbackCandidate:true` — não foi necessário.

## 8. Credenciais (estado atual)

**URL base:** `https://promofy-pro.vercel.app` · **Senha (todos):** `promofy123`

| Papel | E-mail | Estado atual |
|---|---|---|
| Consumidor | `consumidor@promofy.test` | 1.330 pts, R$45, c01 validado |
| Consumidor (convidado) | `convidado@promofy.test` | 1.330 pts, R$45, c01 validado |
| Lojista (Sabor & Cia / e1) | `lojista@promofy.test` | agora em **2 categorias** (alimentação + fitness) |
| Lojista 2 (PowerFit / e2) | `lojista2@promofy.test` | — |
| Admin | `admin@promofy.test` | moderação |

*(Auth: confirmação de e-mail segue DESLIGADA para a demo — religar antes do lançamento público.)*

## 9. Follow-ups (honesto)

- **Cleanup das suítes com escopo restrito:** adaptar o `try/finally` de `test-rls`/`test-fase4` para deletar **só o que o próprio teste criou**, em vez de delete em bloco por usuário. Hoje é seguro só porque o banco local é descartável; em ambiente compartilhado é uma arma carregada (ver §5).
- **Contas `qa-*` descartáveis** no hosted como padrão para qualquer teste mutante da próxima fase (inclui um Bug 2 ao vivo, se desejado, sem risco pro cliente).
- **Pendências herdadas da Fase 3** (fora do escopo da Fase 4): relatório de NPS do lojista, mural de avisos, QR scanner real (câmera) + upload de imagem (storage), `/admin/configuracoes` salvando `config_pontos`.
