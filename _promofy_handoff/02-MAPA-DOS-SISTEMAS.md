# 02 — MAPA DOS SISTEMAS

Cada "sistema" é um **domínio de rota** dentro de um único app Next.js (não é monorepo). Comandos de execução/build são os mesmos para todos (é um projeto só):

- **Rodar:** `npm run dev` (http://localhost:3000)
- **Build:** `npm run build` · **Servir:** `npm run start` · **Lint:** `npm run lint`
- Evidência: [`package.json`](../package.json) scripts.

Convenção: FATO / INFERÊNCIA / RECOMENDAÇÃO. "Tabelas acessadas" = **não se aplica** em todos os casos (não há banco); a fonte é sempre `src/lib/mock-data.ts`.

---

## 1) Portal de gestão do estabelecimento

- **Nome funcional:** Portal do estabelecimento (lojista)
- **Nome técnico / diretório:** `src/app/portal/` (rota `/portal`)
- **Finalidade:** dashboard do lojista — métricas, cupons, avaliações, dados do estabelecimento, configurações.
- **Usuários:** estabelecimentos parceiros.
- **Tecnologia:** Next.js App Router, React Client/Server Components, Tailwind, shadcn/ui.
- **Principais rotas/telas:** `/portal` (dashboard), `/portal/cupons`, `/portal/estabelecimento`, `/portal/avaliacoes`, `/portal/configuracoes`, `/portal/planos` (**oculto no menu**), `/portal/error.tsx` (error boundary).
- **Componentes centrais:** `DashboardShell`/`Sidebar` ([`src/components/sidebar.tsx`](../src/components/sidebar.tsx)), `MetricCard`, `BarChart`, `FunnelChart`, `ReviewCard`, `portal/coupon-portal-card`, `portal/novo-cupom-form`, `portal/validar-cupom-dialog`, `portal/cupons-seed`.
- **Serviços/dados:** `portalKpis`, `metricasCupom`, `funilConversao`, `receitaMensal`, `resgatesMensais`, `avaliacoes` de [`src/lib/mock-data.ts`](../src/lib/mock-data.ts).
- **Autenticação/Permissões:** **nenhuma** — acesso direto por URL. FATO: [`src/app/portal/layout.tsx`](../src/app/portal/layout.tsx) só envolve o `DashboardShell`, sem guard.
- **Integrações:** nenhuma.
- **Funcionalidades concluídas (UI):** dashboard, listagem de cupons, tela de estabelecimento, avaliações, configurações — navegáveis.
- **Parciais:** criação de cupom (`novo-cupom-form`) e validação (`validar-cupom-dialog`) existem como formulário/diálogo, **sem persistência**.
- **Simuladas:** todos os números e a validação de cupom.
- **Ausentes:** login do lojista, persistência, upload real de imagem, cobrança de plano.
- **Testes:** nenhum.
- **Status:** **UI navegável, mockado.**
- **Riscos:** sem auth (qualquer um acessa); regras de cupom só no front.
- **Arquivos mais importantes:** `src/app/portal/page.tsx`, `src/components/portal/*`, `src/components/sidebar.tsx`.

## 2) Painel administrativo global

- **Nome funcional:** Admin global · **Diretório:** `src/app/admin/` (`/admin`)
- **Finalidade:** operação da plataforma — KPIs, estabelecimentos, usuários, cupons, financeiro, avisos, configurações (inclui "tabela de pontos").
- **Usuários:** equipe operadora do Promofy.
- **Rotas/telas:** `/admin` (dashboard), `/admin/estabelecimentos`, `/admin/usuarios`, `/admin/cupons`, `/admin/financeiro`, `/admin/avisos`, `/admin/configuracoes`.
- **Componentes centrais:** `DashboardShell`/`Sidebar`, `admin/data-table`, `MetricCard`, `BarChart`, `FunnelChart`.
- **Dados:** `adminKpis`, `estabelecimentos`, `usuarios`, `cupons`, `receitaMensal`, `funilConversao`, tabela de pontos que espelha `PONTOS_POR_ACAO` em [`src/lib/gamification.ts`](../src/lib/gamification.ts).
- **Autenticação/Permissões:** **nenhuma** — acesso direto por URL ([`src/app/admin/layout.tsx`](../src/app/admin/layout.tsx)).
- **Concluídas (UI):** dashboard + 6 subtelas navegáveis com tabelas.
- **Parciais/Simuladas:** toda edição/gestão é de UI; nada persiste.
- **Ausentes:** login admin, RBAC, ações reais (aprovar/suspender estabelecimento), export.
- **Testes:** nenhum. · **Status:** **UI navegável, mockado.**
- **Riscos:** área mais sensível a segurança e a mais exposta hoje (sem qualquer barreira).
- **Arquivos-chave:** `src/app/admin/page.tsx`, `src/app/admin/configuracoes/page.tsx` (tabela de pontos), `src/components/admin/data-table.tsx`.

## 3) Landing page de estabelecimentos

- **Nome funcional:** Landing "para empresas" · **Diretório:** `src/app/para-empresas/` (`/para-empresas`)
- **Finalidade:** captar estabelecimentos (marketing/conversão de lojista).
- **Usuários:** leads lojistas.
- **Componentes centrais:** `landing/header`, `landing/hero`, `landing/sections`, `landing/faq-accordion`, `landing/footer`, `landing/estabelecimento/fluxo-solucao`, `landing/styles`.
- **Dados:** `landingStats` (mock-data). · **Auth:** não se aplica (público). · **Integrações:** nenhuma (sem formulário de lead real).
- **Status:** **UI, mockado.** CTAs levam ao portal/telas internas.
- **Arquivos-chave:** `src/app/para-empresas/page.tsx`, `src/components/landing/estabelecimento/fluxo-solucao.tsx`.

## 4) Landing page de clientes (+ tela de acesso)

- **Nome funcional:** Landing "para você" + tela de acesso ("chooser") · **Diretórios:** `src/app/para-voce/` (`/para-voce`) e `src/app/page.tsx` (`/`)
- **Finalidade:** captar consumidores e direcionar cada público à sua frente.
- **Componentes centrais:** `landing/hero`, `landing/sections`, `landing/como-usar-carrossel`, `landing/faq-accordion`, `landing/acesso-chooser` (tela de escolha de acesso), `app-mockup`, `feedback-carousel`, `banner-carousel`.
- **Dados:** `landingStats`, `avaliacoes`. · **Auth:** público.
- **Status:** **UI, mockado.**
- **Arquivos-chave:** `src/app/page.tsx`, `src/app/para-voce/page.tsx`, `src/components/landing/acesso-chooser.tsx`.

## 5) App do cliente (consumidor)

- **Nome funcional:** App do consumidor · **Diretório:** `src/app/m/` (`/m`)
- **Finalidade:** experiência principal de descoberta/uso de cupons + gamificação + planos. É a frente mais completa.
- **Usuários:** consumidores. · **Layout:** mobile-first dentro de `PhoneFrame` ([`src/app/m/layout.tsx`](../src/app/m/layout.tsx)).
- **Rotas/telas:** `/m` (home), `/m/buscar`, `/m/filtros`, `/m/estabelecimentos`, `/m/cupom/[id]`, `/m/favoritos`, `/m/planos`, `/m/premiacoes`, `/m/perfil` (+ `dados`, `preferencias`, `notificacoes`, `pagamento`, `convide`), `/m/onboarding`, `/m/login`, `/m/cadastro`.
- **Componentes centrais:** `coupon-card`, `coupon-list-item`, `coupon-gallery`, `bottom-nav`, `home-header`, `home-search-bar`, `home-category-chips`, `cupom-acao-usar`, `cupom-ativo-sheet`, `qr-fake`, `nps-dialog`, `tutorial-dialog`, `points-card`, `points-summary`, `podium`, `ranking-block`, `plan-card`, `favorite-button`, `star-rating`, `mobile-page-header`.
- **Estado/Providers:** `CouponStateProvider`, `FavoritesProvider`, `MobileFlowProvider` (todos em `src/components/`), montados no `m/layout.tsx`.
- **Dados:** `cupons`, `categorias`, `estabelecimentos`, `usuarios`, `usuarioAtual`, `planosMobile`, gamificação.
- **Autenticação:** **apenas visual** — `/m/login` faz `router.push("/m")` sem validar (comentário `// mock — sem auth real`). FATO.
- **Concluídas (UI + estado de sessão):** navegação completa; **ciclo do cupom** (disponível → ativo → validado → NPS → pontos) funciona em memória/storage local.
- **Parciais:** perfil/pagamento/notificações são telas sem backend; planos sem checkout.
- **Simuladas:** código/QR do cupom, validação pelo estabelecimento, saldo de pontos (derivado do estado + `SALDO_BASE`).
- **Ausentes:** auth real, persistência de conta, pagamento, push, geolocalização real.
- **Testes:** nenhum. · **Status:** **UI navegável mais rica, mockado.**
- **Riscos:** lógica de gamificação no front; migração mobile precisará de backend.
- **Arquivos-chave:** `src/app/m/page.tsx`, `src/app/m/cupom/[id]/page.tsx`, `src/components/coupon-state-provider.tsx`, `src/lib/gamification.ts`.

## 6) App do estabelecimento (candidato a mobile)

> **INFERÊNCIA (FATO de que só há um diretório):** não existe uma aplicação de estabelecimento **separada** do `/portal`. O "app do estabelecimento candidato a mobile" **é o próprio `/portal`** (sistema #1). Ao planejar mobile do lojista, use `/portal` como base. Não há PWA/manifest específico versionado.

## 7) Backend e módulos compartilhados

- **Nome funcional:** "Backend" (na prática: camada de dados mock + estado de UI + utilitários).
- **Diretórios:** `src/lib/` e providers em `src/components/`.
- **Conteúdo:**
  - [`src/lib/types.ts`](../src/lib/types.ts) — tipos de domínio (`Cupom`, `Estabelecimento`, `Usuario`, `Plano`, `Avaliacao`, `MetricasCupom`, KPIs…). **É o melhor ponto de partida para um schema de banco.**
  - [`src/lib/mock-data.ts`](../src/lib/mock-data.ts) — todos os "dados" (615 linhas): categorias, 6 estabelecimentos, cupons, 4 planos + 4 planosMobile, 8 usuários (ranking), avaliações, funil, séries, KPIs, `landingStats`.
  - [`src/lib/gamification.ts`](../src/lib/gamification.ts) — regras: `PONTOS_POR_ACAO` (resgate 50 / nps 30 / indicacao 100 / visita 10), níveis (`calcularNivel`), `SALDO_BASE = 1250`.
  - [`src/lib/utils.ts`](../src/lib/utils.ts) — `cn`, formatadores pt-BR (`formatBRL`, `formatNumber`, `formatDistance`) e `formatShortDate` **à prova de hidratação UTC×BR**.
  - Providers: `coupon-state-provider` (usa `localStorage`/`sessionStorage`), `favorites-provider` (memória), `mobile-flow-provider` (memória).
- **Autenticação/Permissões/Integrações:** **nenhuma.**
- **Status:** **mock/estado de UI, sem servidor.**
- **Riscos:** é a "fonte de verdade" hoje; qualquer backend real deve derivar dos tipos aqui e mover a gamificação para o servidor.

---

## Matriz consolidada dos sistemas

| Sistema | Diretório | Tecnologia | Público | Frontend | Backend | Banco | Auth | Testes | Deploy | Status | Evidência principal |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Portal estabelecimento | `src/app/portal/` | Next.js/React/TW/shadcn | Lojista | ✅ | ❌ | ❌ (mock) | ❌ | ❌ | não versionado | UI mockada | `portal/*`, `sidebar.tsx` |
| Admin global | `src/app/admin/` | idem | Operador | ✅ | ❌ | ❌ (mock) | ❌ | ❌ | não versionado | UI mockada | `admin/*`, `data-table.tsx` |
| Landing estabelecimentos | `src/app/para-empresas/` | idem | Lead lojista | ✅ | ❌ | ❌ | n/a | ❌ | não versionado | UI mockada | `landing/estabelecimento/*` |
| Landing clientes + acesso | `src/app/para-voce/`, `src/app/page.tsx` | idem | Lead consumidor | ✅ | ❌ | ❌ | n/a | ❌ | não versionado | UI mockada | `landing/acesso-chooser.tsx` |
| App consumidor | `src/app/m/` | idem (mobile-first) | Consumidor | ✅ | ❌ | ❌ (mock+storage) | ❌ (visual) | ❌ | não versionado | UI mockada (mais rica) | `coupon-state-provider.tsx` |
| App estabelecimento | = `/portal` | idem | Lojista | ✅ | ❌ | ❌ | ❌ | ❌ | não versionado | = Portal | `src/app/portal/` |
| Backend/compartilhado | `src/lib/`, providers | TS puro + React Context | — | n/a | ❌ | mock | ❌ | ❌ | n/a | mock/estado | `types.ts`, `mock-data.ts` |

Legenda: ✅ existe / ❌ ausente / n/a não se aplica / "mock" = dados estáticos em `mock-data.ts`.
