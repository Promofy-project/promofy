# 04 — STATUS, RISCOS E ROADMAP

*Classificação usada: **Pronta e validada** · **Funcional com ressalvas** · **Parcial** · **Apenas interface** · **Simulada** · **Protótipo** · **Quebrada** · **Não iniciada** · **Desconhecida**.*

> Contexto-base (FATO): repositório **100% front mockado**, sem backend/banco/auth/testes/deploy versionado. Portanto, em toda a matriz: **Backend = Não iniciada**, **Banco = Não iniciada (mock)**, **Auth = Não iniciada**, **Testes = Não iniciada**, **Deploy = Desconhecida/não versionado**, salvo indicação.

---

## 1. Matriz de status por funcionalidade

| Sistema | Funcionalidade | Frontend | Backend | Banco | Auth | Testes | Deploy | Status | Evidência | Pendências |
|---|---|---|---|---|---|---|---|---|---|---|
| Landings | Páginas de marketing (`/`, `/para-voce`, `/para-empresas`) | ✅ | ❌ | ❌ | n/a | ❌ | ❔ | Apenas interface | `src/app/page.tsx`, `para-*` | Formulário de lead real |
| Landings | Tela de acesso ("chooser") | ✅ | ❌ | ❌ | n/a | ❌ | ❔ | Apenas interface | `landing/acesso-chooser.tsx` | Roteia para frentes sem auth |
| Consumidor `/m` | Home/descoberta, categorias, busca, filtros | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada (dados mock) | `m/page.tsx`, `m/buscar` | Busca/filtro reais no servidor |
| Consumidor `/m` | Detalhe do cupom | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada | `m/cupom/[id]/page.tsx` | Dados reais |
| Consumidor `/m` | **Ciclo do cupom** (ativar→validar→NPS→pontos) | ✅ | ❌ | ❌(storage local) | ❌ | ❌ | ❔ | Funcional com ressalvas (só cliente) | `coupon-state-provider.tsx` | Persistir/validar no servidor |
| Consumidor `/m` | Favoritos | ✅ | ❌ | ❌(memória) | ❌ | ❌ | ❔ | Funcional com ressalvas (zera no reload) | `favorites-provider.tsx` | Persistência |
| Consumidor `/m` | Gamificação (pontos/níveis/ranking/premiações) | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada (regra no front) | `gamification.ts`, `podium.tsx` | Mover regra ao backend |
| Consumidor `/m` | Planos/assinatura | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Apenas interface | `m/planos`, `plan-card.tsx` | Checkout/pagamento |
| Consumidor `/m` | Perfil (dados/pagamento/notificações/convide) | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Apenas interface | `m/perfil/*` | Backend + auth |
| Consumidor `/m` | Login/Cadastro | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada (só navega) | `m/login/page.tsx` | Auth real |
| Consumidor `/m` | Onboarding + tutorial | ✅ | ❌ | ❌(memória) | ❌ | ❌ | ❔ | Funcional com ressalvas | `mobile-flow-provider.tsx` | Persistir "já viu" |
| Portal | Dashboard/KPIs/funil | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada | `portal/page.tsx`, `portalKpis` | Métricas reais |
| Portal | Criar/editar cupom | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Parcial (form sem persistir) | `portal/novo-cupom-form.tsx` | CRUD real + upload |
| Portal | Validar cupom | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada | `portal/validar-cupom-dialog.tsx` | Validação serverside |
| Portal | Estabelecimento/Avaliações/Config | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Apenas interface | `portal/estabelecimento`, `avaliacoes` | Backend |
| Admin | Dashboard/KPIs | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Simulada | `admin/page.tsx`, `adminKpis` | Dados reais |
| Admin | Gestão (estab/usuários/cupons/financeiro/avisos) | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Apenas interface | `admin/*`, `data-table.tsx` | CRUD + RBAC |
| Admin | Config "tabela de pontos" | ✅ | ❌ | ❌ | ❌ | ❌ | ❔ | Apenas interface (duplica regra) | `admin/configuracoes/page.tsx` | Fonte única no backend |
| Plataforma | SSR data/fuso (hidratação) | ✅ | n/a | n/a | n/a | ❌ | ❔ | Funcional com ressalvas (mitigado) | `utils.ts` `formatShortDate` | Cuidado contínuo |

✅ existe · ❌ ausente · ❔ desconhecido/não versionado · n/a não se aplica.

---

## 2. Registro de riscos

| # | Risco | Tipo | Evidência | Impacto | Prob. | Sev. | Sistemas | Recomendação | Depend. | Prioridade |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | Sem autenticação/autorização | Segurança | `portal/layout.tsx`, `admin/layout.tsx`, `m/login` mock | Crítico | Alta (100% hoje) | Crítica | Todos | Implementar auth + papéis + `middleware.ts` antes de qualquer dado real | Backend | P0 |
| R2 | Sem backend/banco/persistência | Arquitetura | Ausência de API/DB/env | Crítico | Alta | Crítica | Todos | Escolher backend (ex.: Supabase), modelar a partir de `types.ts` | — | P0 |
| R3 | Regras de negócio no front | Arquitetura/Regra | `gamification.ts`, `coupon-state-provider.tsx` | Alto | Alta | Alta | `/m`, `/portal`, `/admin` | Mover gamificação/ciclo do cupom p/ servidor | R2 | P1 |
| R4 | "Tabela de pontos" duplicada sem fonte única | Manutenção/Duplicação | `gamification.ts` × `admin/configuracoes` (comentário "mudar nos dois") | Médio | Média | Média | `/m`, `/admin` | Centralizar no backend/config única | R2 | P1 |
| R5 | Números/KPIs ilustrativos confundidos com reais | Negócio/Dados | `mock-data.ts` (KPIs, funil, MRR) | Médio | Média | Média | `/portal`, `/admin`, landings | Rotular claramente como demo; nunca usar para decisão | — | P1 |
| R6 | Sem testes automatizados | Testes | nenhum arquivo de teste no repo | Alto | Alta | Alta | Todos | Introduzir testes junto com o backend (TDD nos fluxos) | R2 | P1 |
| R7 | Deploy não versionado/confirmado | Deploy | sem config de deploy versionada | Médio | Desconhecida | Média | Todos | Definir CI/CD (ex.: Vercel) e proteger branches | — | P2 |
| R8 | Hidratação SSR por fuso/locale | Estabilidade | `utils.ts` (mitigação documentada) | Médio | Baixa (mitigado) | Média | Todas com data | Padrão determinístico para novos valores fuso-dependentes | — | P2 |
| R9 | Dados sensíveis em telas (CPF/pagamento) sem backend seguro | Segurança/Privacidade (LGPD) | `usuarioAtual.cpfMascarado`, `m/perfil/pagamento` | Alto | Média (ao virar real) | Alta | `/m` | Tratar PII no servidor, LGPD, mascarar sempre | R1,R2 | P1 |
| R10 | Inconsistências de modelo (avaliação por nome, usuarioAtual à parte) | Banco/Modelagem | `types.ts`, `mock-data.ts` | Médio | Alta (ao modelar) | Média | Backend | Normalizar por id ao criar o schema | R2 | P1 |
| R11 | Acoplamento a APIs de navegador/DOM (migração mobile) | Migração mobile | `localStorage`/`sessionStorage`, `PhoneFrame`, `next/*` | Médio | Média | Média | `/m`, `/portal` | Abstrair storage/navegação antes de portar | R2 | P2 |
| R12 | Escalabilidade de dados mock em memória | Escalabilidade | arrays estáticos | Baixo (hoje) | — | Baixa | Todos | Resolvido naturalmente com backend | R2 | P3 |

Prioridades: **P0** bloqueia produto real; **P1** essencial no MVP; **P2** importante; **P3** posterior.

---

## 3. Roadmap até produção (work packages)

> Ordem recomendada geral: **WP1 → WP2 → WP3 → (WP4, WP5, WP6 em paralelo) → WP7 → WP8**. Cada WP é pequeno e auditável.

### WP1 — Backend + banco + modelo de dados
- **Objetivo:** provisionar backend/banco e materializar o schema a partir de `src/lib/types.ts`.
- **Sistemas:** todos. · **Dependências:** nenhuma.
- **Escopo:** escolher stack (RECOMENDAÇÃO: Supabase); tabelas de `Estabelecimento`, `Cupom`, `Usuario`, `Avaliacao`, `Plano`, categorias, métricas/eventos; FKs por id; seed a partir de `mock-data.ts`.
- **Fora de escopo:** UI nova, pagamento.
- **Arquivos prováveis:** novo `src/lib/db/` ou cliente Supabase; migrations.
- **Aceite:** ler cupons/estabelecimentos do banco em uma tela real. · **Testes:** integração de leitura. · **Riscos:** R2, R10. · **Prioridade:** P0.

### WP2 — Autenticação + papéis + proteção de rotas
- **Objetivo:** login/cadastro/recuperação reais; 3 papéis; `middleware.ts` protegendo `/portal` e `/admin`; RLS por papel.
- **Sistemas:** todos. · **Dependências:** WP1.
- **Escopo:** substituir `m/login`/`m/cadastro` mock por auth real; guardas de rota; sessão.
- **Fora de escopo:** SSO corporativo.
- **Arquivos:** `src/app/m/login`, `m/cadastro`, novo `middleware.ts`, layouts de `/portal` e `/admin`.
- **Aceite:** `/admin` inacessível sem sessão admin. · **Testes:** autorização por papel. · **Riscos:** R1, R9. · **Prioridade:** P0.

### WP3 — Migrar regras de negócio para o servidor
- **Objetivo:** mover gamificação e ciclo do cupom para o backend (fonte única da "tabela de pontos").
- **Sistemas:** `/m`, `/portal`, `/admin`. · **Dependências:** WP1, WP2.
- **Escopo:** endpoints/serviços de pontos/níveis; validação de cupom serverside; eventos (visualização/clique/resgate).
- **Arquivos:** `gamification.ts` (vira consumidor de API), `coupon-state-provider.tsx`, `admin/configuracoes`.
- **Aceite:** validar cupom credita pontos no servidor. · **Testes:** regras de pontos. · **Riscos:** R3, R4. · **Prioridade:** P1.

### WP4 — Fluxo do consumidor com dados reais
- **Objetivo:** substituir mocks do `/m` por dados/persistência reais (favoritos, cupom, perfil).
- **Dependências:** WP1–WP3. · **Aceite:** favoritos persistem entre sessões. · **Riscos:** R5, R9. · **Prioridade:** P1.

### WP5 — Portal do lojista com CRUD real
- **Objetivo:** CRUD de cupons + upload de imagem + validação; métricas reais.
- **Dependências:** WP1–WP3. · **Aceite:** cupom criado no portal aparece no `/m`. · **Prioridade:** P1.

### WP6 — Admin operacional
- **Objetivo:** CRUD/ações reais (aprovar/suspender estabelecimento), financeiro/relatórios reais, RBAC.
- **Dependências:** WP1–WP3. · **Aceite:** suspender estabelecimento reflete no catálogo. · **Prioridade:** P1.

### WP7 — Integrações
- **Objetivo:** pagamento (planos), geolocalização/mapa (distância real), notificações/e-mail.
- **Dependências:** WP1–WP5. · **Aceite:** assinatura paga muda o plano do usuário. · **Prioridade:** P2.

### WP8 — Qualidade + CI/CD
- **Objetivo:** testes (unit/integr./e2e), lint em CI, pipeline de deploy protegido, monitoramento de hidratação.
- **Dependências:** paralelo aos anteriores. · **Aceite:** PR sem testes/lint não mescla. · **Riscos:** R6, R7, R8. · **Prioridade:** P1–P2.

---

## 4. Preparação para mobile nativo

### Reaproveitável × preso à web (FATO/INFERÊNCIA)

| Categoria | Reaproveitável em nativo | Preso à web / precisa adaptação |
|---|---|---|
| Lógica pura | `types.ts`, `gamification.ts` (níveis/pontos), formatadores de `utils.ts` (exceto `cn`) | — |
| Modelo mental de telas/fluxos | Sim (fluxo do cupom, perfil, planos) | — |
| Estado | Padrão Context é portável | Persistência via `localStorage`/`sessionStorage` (`coupon-state-provider`, `mobile-flow-provider`) → trocar por storage nativo |
| UI | Estrutura/telas | `next/*` (Link, font, Image), Tailwind/CSS, shadcn/Radix, `PhoneFrame`, DOM |
| Navegação | Conceito de rotas | Roteamento App Router → navegação nativa |
| Dados | — | Hoje é import estático de mocks → precisa backend/API (WP1) |

- **Dependência do DOM / APIs de navegador:** `localStorage`/`sessionStorage` (2 providers), CSS/Tailwind, componentes Radix/shadcn — todos web-only.
- **Auth mobile / deep links / push / câmera / galeria / localização / offline:** **nenhum** implementado hoje. Serão novos (o QR/“scanner” de validação é `qr-fake`; a distância é um número no mock).
- **Bibliotecas incompatíveis com nativo:** `next`, `@radix-ui/*`, `tailwindcss`, `lucide-react` (web) — precisam de equivalentes RN.
- **Regras que deveriam migrar para backend antes do mobile:** gamificação, ciclo/validação do cupom, planos (WP3) — assim o app nativo só consome API.

### Comparação de abordagens (RECOMENDAÇÃO)

| Critério | 1) PWA | 2) Híbrido (WebView/Capacitor) | 3) Nativo (React Native/Expo) |
|---|---|---|---|
| Reuso do código atual | **Altíssimo** (é o próprio app) | Alto (empacota o web) | Médio (reusa lógica pura/tipos; reescreve UI) |
| Experiência/perf | Boa | Média | **Melhor** |
| Push/câmera/geoloc | Limitado (iOS restrito) | Bom (plugins) | **Completo** |
| Presença nas lojas | Não/limitada | Sim | **Sim** |
| Esforço | **Baixo** | Médio | Alto |
| Recomendado para | Validar rápido pós-backend | Ponte intermediária | Produto consumidor de longo prazo |

- **RECOMENDAÇÃO:** primeiro **WP1–WP3** (backend/auth/regras). Depois, **PWA** para validar em mobile com baixo custo; evoluir para **React Native/Expo** no app do consumidor quando push/geoloc/lojas forem prioridade. O `/portal` pode permanecer web por mais tempo (uso desktop-first).
- **NÃO COMPROVADO:** não há, no repositório, manifest PWA, config Expo/Capacitor ou qualquer artefato mobile — a decisão está totalmente em aberto.
