# FASE 1 — Relatório de Implementação (Fundação Supabase)

*Branch: `fase-1-fundacao` · Data: 2026-07-12 · Status: **concluída e validada***

---

## 1. O que foi feito (por entrega/commit)

| Commit | Entrega |
|---|---|
| `698712b` | Setup: `@supabase/supabase-js` 2.110.2 + `@supabase/ssr` 0.12.0 (pinadas), `supabase init`, clients browser/server/middleware (padrão oficial `getAll/setAll` + `getClaims`), `.env.local.example` |
| `8636333` | Schema: 7 enums, 11 tabelas, 16 índices; `handle_new_user` (trigger de signup) e `gerar_codigo_cupom` (PRMF-XXXX-XXXX); `database.types.ts` gerado |
| `749f9bd` | RLS em **todas** as tabelas: policies por papel, helpers `security definer` em schema `private`, **grants por coluna** contra escalação |
| `a6e490f` | Seed completo (dados do mock, ids preservados, ~20,5k eventos) + `seed-users.ts` + `test-rls.ts` (23 asserções) |
| `fee93bd` | Auth real no `/m`: login/cadastro (visual intacto), logout, gate do "Usar cupom" |
| `ecf987b` | `/portal/login` e `/admin/login` + route groups `(painel)` (URLs inalteradas) + logout na sidebar |
| `2f6df74` | `src/middleware.ts`: `/portal`→lojista, `/admin`→admin, `/m/perfil`→sessão |
| `94b80e9` | Primeira leitura real: home `/m` e `/portal/cupons` via `src/lib/data/cupons.ts` |
| *(este)* | README + este relatório |

## 2. Critérios de aceite — como cada um foi provado

1. **`/admin` e `/portal` inacessíveis sem o papel correto** ✅
   `curl` anônimo: `/admin`→307 `/admin/login`, `/portal`→307 `/portal/login`, `/m/perfil`→307 `/m/login`. No browser: lojista logado em `/admin` é devolvido ao `/admin/login`; consumidor no `/portal/login` recebe "Esta conta não tem acesso a esta área"; lojista em `/portal/login` já logado vai direto ao `/portal`. Públicos (`/`, `/m`, logins) seguem 200.
2. **Cadastro real cria usuário e chega ao onboarding** ✅
   Playwright: formulário de cadastro → `/m/onboarding`; SQL confirmou a linha em `profiles` com nome/CPF/telefone/nascimento e `role='consumidor'`.
3. **Home `/m` e `/portal/cupons` exibem dados do banco** ✅
   `update cupons set titulo='TESTE BANCO REAL — pizza' where id='c01'` → home refletiu; revertido → voltou. Portal mostra as 4 campanhas do e1 com KPIs idênticos ao mock (12.440 visualizações / 1.395 resgates / 11% conversão / 2 ativos) — métricas **derivadas** da view `cupom_metricas`.
4. **RLS ativo em todas + policies testadas** ✅
   `select … from pg_tables where rowsecurity=false` ⇒ 0 linhas. `npm run test:rls` ⇒ **23 PASS, 0 FAIL** (método: sessões reais por papel via PostgREST; UPDATEs cross-tenant com `.select()` p/ distinguir 0-linhas de sucesso; negações por grant checando `42501`).
5. **Migrations reprodutíveis do zero** ✅
   `supabase db reset` rodado dezenas de vezes durante o desenvolvimento; `npm run verify:fase1` (reset+seed+testes+build) verde na validação final.

## 3. Estrutura do schema

```
profiles (1:1 auth.users)  role: consumidor|lojista|admin (+nome, cidade, cpf, telefone, nascimento)
categorias                 slugs do mock (alimentacao, fitness, …)
estabelecimentos           owner_id → profiles · status ativo|pendente|suspenso · rating agregado
cupons                     estabelecimento_id → estabelecimentos · validade_inicio/fim,
                           ocultar_ate_inicio, limite_total, limite_por_usuario,
                           prazo_ativacao_horas, regras jsonb, horarios jsonb,
                           status ativo|indisponivel|expirado|esgotado, destaque
                           (+ colunas-protótipo: distancia_km, imagem, ordem, rating, avaliacoes)
avaliacoes                 usuario_id → profiles (FK por id; usuario_nome p/ seed legado)
cupom_eventos              (cupom_id, usuario_id?, tipo visualizacao|clique|ativacao|validacao)
  └─ view cupom_metricas   (security_invoker) — métricas SEMPRE derivadas daqui
cupons_usuario             ciclo por usuário: status ativo|validado|expirado, codigo ÚNICO
                           (PRMF-XXXX-XXXX, alfabeto sem 0/O/1/I, default gerado no banco), nps 0–10
pontos_transacoes          ledger (saldo = SUM, jamais coluna editável)
config_pontos              FONTE ÚNICA da tabela de pontos (resolve duplicação
                           gamification.ts × admin/configuracoes)
planos / assinaturas       estrutura pronta (sem pagamento)
```

IDs de `cupons`/`estabelecimentos`/`categorias` são `text` com os valores do
mock (`c01`, `e1`, slugs) — compat com `/m/cupom/[id]` que segue no mock.
Migração para uuid fica para quando o detalhe ler do banco (Fase 2).

## 4. Decisões relevantes (e por quê)

| # | Decisão |
|---|---|
| D1 | **Local-only** nesta fase (CLI+Docker); hosted via `supabase link + db push` na Fase 2 |
| D2 | Gate de rota: `/m/perfil` no middleware; "Usar cupom" client-side (`getSession`, sem rede) — preserva a demo pública |
| D4 | Papel no middleware via claim `app_metadata.role` (só a admin API escreve); `profiles.role` é a fonte de verdade e o RLS usa ela |
| D12 | **Revoke de tabela + grant por coluna** (revoke por coluna é no-op no Postgres): usuário não muda o próprio `role`; lojista não muda `status/rating` do estabelecimento; consumidor só insere `(usuario_id, cupom_id)` e só atualiza `nps` em `cupons_usuario`. Efeito colateral aceito: o admin via API também fica limitado nessas colunas na Fase 1 (escreve-se via service_role/SQL; a UI do admin segue mock) |
| D14 | `statusPortal` deriva só da coluna `status` — derivar por data mudaria o chip do c01 (validade 2026-06-30, já passada) e quebraria a paridade visual |
| D15 | Sem INSERT client-side em `cupom_eventos`/`pontos_transacoes` (eventos forjáveis corromperiam métricas do lojista) |
| — | Stack local nas portas **553xx** para conviver com os stacks sigo-clinicas (543xx) e faithx (554xx); storage/analytics desligados (instáveis no Windows, sem uso na fase) |
| — | GoTrue cria o usuário **antes** de mesclar `app_metadata` no admin-create → o trigger via role vazio; `seed-users.ts` corrige `profiles.role` explicitamente após criar lojista/admin |

## 5. Como rodar

Ver README (seção "Como rodar"). Resumo: `supabase start` → `.env.local` →
`npm run db:reset` → `npm run dev`. Validação completa: `npm run verify:fase1`.

### Credenciais de teste (somente local)

`consumidor@promofy.test` / `lojista@promofy.test` / `admin@promofy.test` — senha `promofy123`.

## 6. Segurança — resumo do modelo

- **RLS em 100% das tabelas** (checado por query em `pg_tables`); anon não lê
  `profiles`/`pontos`/`cupons_usuario` e não vê cupons de estabelecimento
  pendente/suspenso.
- Escalação de privilégio bloqueada em nível de **grant de coluna** (não só
  policy): testes provam `42501` ao tentar `role='admin'`, auto-reativação de
  estabelecimento e auto-validação de cupom.
- `SUPABASE_SERVICE_ROLE_KEY` só em `scripts/` (Node local); nunca importado
  por código do app.
- Middleware é UX (redirects); nenhuma regra de segurança vive só no front.

## 7. O que ficou para a Fase 2

- Persistir o **ciclo do cupom** e os **pontos** no banco (tabelas prontas:
  `cupons_usuario`, `pontos_transacoes`, `config_pontos`); validação real pelo
  lojista (o `ValidarCupomDialog` segue mock de formato).
- Eventos escritos pelo app (`visualizacao`/`clique` com WITH CHECK restrito;
  `ativacao`/`validacao` só server-side).
- Criar cupom no portal **persistindo** (hoje o form continua em memória).
- Demais telas saindo do mock (busca, favoritos, perfil, planos, admin,
  landings); escrita administrativa via server actions/service_role.
- `statusPortal` derivado por data/limite com fuso America/Sao_Paulo;
  semântica completa de agendamento.
- Projeto Supabase **hosted** + `db push`; e-mail confirmation; migração de
  ids text→uuid; unificação dos planos landing×app; recálculo de rating.
- Pagamento/assinaturas.

## 8. Correções de registro

- Os documentos `00-LEIA-PRIMEIRO.md` e `03-ARQUITETURA-BANCO-E-AUTH.md` deste
  pacote afirmavam que o `CouponStateProvider` usava localStorage/sessionStorage
  — **incorreto**: o provider é 100% em memória (comentário no próprio arquivo).
  Este relatório corrige o registro; os documentos originais foram mantidos
  como estavam por serem um snapshot histórico.
- Há um arquivo **`.env` órfão na raiz** com chaves de OUTRO projeto
  (sigoclinicas: Resend, project ref etc.). Foi adicionado ao `.gitignore`
  para nunca ser commitado, mas recomenda-se **removê-lo** do repositório
  local (`.env.local` é o único arquivo de env que o Promofy usa).
