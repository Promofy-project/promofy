# 03 — ARQUITETURA, "BANCO" E AUTENTICAÇÃO

*Marcações: FATO / INFERÊNCIA / RECOMENDAÇÃO / NÃO COMPROVADO.*

---

## 1. Estrutura do repositório

> **FATO COMPROVADO:** é um **repositório único, um app Next.js** — **não** é monorepo. Não há `apps/`, `packages/`, workspaces, Turborepo/Nx nem múltiplos `package.json`. Evidência: um único [`package.json`](../package.json); `next.config.mjs` padrão.

```
promofy/
├── src/
│   ├── app/                    # App Router (rotas + layouts)
│   │   ├── layout.tsx          # layout raiz (html, fonte Inter, globals.css)
│   │   ├── globals.css         # design tokens (variáveis CSS)
│   │   ├── page.tsx            # / landing raiz + tela de acesso
│   │   ├── para-voce/          # landing consumidor
│   │   ├── para-empresas/      # landing estabelecimento
│   │   ├── m/                  # app consumidor (+ layout com providers e PhoneFrame)
│   │   ├── portal/             # dashboard estabelecimento (+ error boundary)
│   │   └── admin/              # dashboard admin
│   ├── components/
│   │   ├── ui/                 # primitivos shadcn (button, card, input, switch, …)
│   │   ├── portal/             # componentes do portal
│   │   ├── admin/              # componentes do admin
│   │   ├── landing/            # componentes de landing (+ estabelecimento/)
│   │   └── *.tsx               # componentes de consumo/compartilhados + providers
│   └── lib/                    # types.ts, mock-data.ts, gamification.ts, utils.ts
└── public/                     # imagens/assets
```

- **Aplicações:** conceitualmente 4 frentes (landings, `/m`, `/portal`, `/admin`) — **fisicamente 1 app**.
- **Pacotes:** nenhum pacote interno publicável; "compartilhamento" é via imports relativos (`@/lib`, `@/components`). Alias `@/*` → `src/*` em [`tsconfig.json`](../tsconfig.json).
- **Módulos compartilhados:** `src/lib/*` e `src/components/ui/*` + providers.
- **Serviços/bibliotecas externas de runtime:** nenhuma (sem SDK de DB/auth/pagamento).

## 2. Fluxo de dados e comunicação

> **FATO:** não há comunicação de rede. As telas importam arrays de `src/lib/mock-data.ts` em build/render e usam React Context para estado de sessão.

```
Usuário (navegador)
  → Rota Next.js (Server/Client Component)
  → import estático de src/lib/mock-data.ts  (os "dados")
  → React Context (estado de sessão)
        • CouponStateProvider  → localStorage + sessionStorage
        • FavoritesProvider    → memória (Set)
        • MobileFlowProvider   → memória
  → Render (Tailwind/shadcn)
  ✗ (não há) API / Supabase / Banco / Integrações externas
```

- **Backend compartilhado?** Não existe backend. As quatro frentes compartilham os **mesmos mocks e tipos**.
- **Regras de negócio:** vivem no front — principalmente `src/lib/gamification.ts` (pontos/níveis) e `coupon-state-provider.tsx` (ciclo do cupom, derivação de pontos).
- **APIs / chamadas diretas ao banco:** nenhuma. Sem route handlers (`app/api/*`), sem server actions de dados.
- **Duplicações/acoplamentos notáveis:**
  - `planos` (landing) × `planosMobile` (`/m/planos`) — dois conjuntos de planos (INTENCIONAL, ver comentário em mock-data.ts).
  - Tabela de pontos aparece em **dois lugares** que precisam ser mantidos em sincronia manualmente: `gamification.ts` e `src/app/admin/configuracoes/page.tsx` (há comentário explícito "Mudou lá → mudar aqui"). **Acoplamento por convenção**, sem fonte única.
- **Dependências circulares:** nenhuma observada (fluxo `app → components → lib`, unidirecional).
- **Pontos de segurança:** ver seção 4.

## 3. "Banco de dados" — o que existe hoje

> **FATO COMPROVADO:** **não há banco de dados.** Não existem migrations, views, enums SQL, funções, triggers, policies, RLS, foreign keys, índices ou buckets. O que existe são **arrays TypeScript** e **tipos**.

O modelo de dados **conceitual** (base para um schema real) está em [`src/lib/types.ts`](../src/lib/types.ts):

| Entidade (tipo) | Campos-chave | "Tabela" futura sugerida |
|---|---|---|
| `Categoria` | id, label, icon, gradiente | `categorias` (ou enum) |
| `Cupom` | id, titulo, estabelecimentoId, categoria, economia, precoDe/Por, distanciaKm, rating, avaliacoes, validade, status, regras[], horarios, destaque | `cupons` |
| `Estabelecimento` | id, nome, categoria, cidade, rating, avaliacoes, cuponsAtivos, resgatesMes, status(ativo/pendente/suspenso) | `estabelecimentos` |
| `Usuario` | id, nome, cidade, pontos, economiaTotal, cuponsUsados, nivel | `usuarios` |
| `Avaliacao` | id, usuario, rating, comentario, data, estabelecimento | `avaliacoes` |
| `MetricasCupom` | visualizacoes, cliques, ativacoes, resgates | métricas/eventos |
| `Plano` | id, nome, preco, periodo, beneficios[], bloqueado, badge | `planos` |
| KPIs / séries | `Kpi`, `SerieMensal`, `FunilEtapa` | derivados/relatórios |

Relacionamentos implícitos (INFERÊNCIA a partir dos campos): `Cupom.estabelecimentoId → Estabelecimento.id`; `Avaliacao.estabelecimento` referencia estabelecimento por **nome** (não por id — inconsistência a corrigir num schema real); `Cupom.categoria → Categoria.id`.

- **Tabelas legadas / sem uso:** não aplicável (não há banco).
- **Inconsistências banco × frontend:** `Avaliacao` liga-se ao estabelecimento por nome; `usuarioAtual` (consumidor "logado") é um objeto à parte de `usuarios[]`. São pontos a normalizar ao modelar o banco real.

## 4. Autenticação e autorização — o que existe hoje

> **FATO COMPROVADO:** **não há autenticação nem autorização.** Sem provider (NextAuth/Clerk/Supabase Auth), sem sessão, sem cadastro/login/recuperação reais, sem middleware, sem guards, sem RLS.

- **Cadastro/Login/Recuperação:** apenas telas visuais em `/m/login` e `/m/cadastro`. O submit navega:
  - login → `router.push("/m")` (comentário `// mock — sem auth real`) — FATO, [`src/app/m/login/page.tsx`](../src/app/m/login/page.tsx).
  - cadastro → `router.push("/m/onboarding")` — FATO, [`src/app/m/cadastro/page.tsx`](../src/app/m/cadastro/page.tsx).
- **`/portal` e `/admin`:** **sem porta de login** — os layouts só renderizam o `DashboardShell`. Qualquer pessoa com a URL acessa. FATO: `src/app/portal/layout.tsx`, `src/app/admin/layout.tsx`.
- **Papéis/perfis:** o tipo `Usuario` tem `nivel` (Bronze…Diamante) — **nível de gamificação, não papel de acesso**. Não há RBAC.
- **Middleware / rotas protegidas:** não existe `middleware.ts`.
- **"CPF" na conferência do cupom ativo:** `usuarioAtual.cpfMascarado = "123.***.***-09"` — **mock mascarado, nunca um CPF real** (comentário no código). FATO.
- **Elevação de privilégio / verificações só no front:** como não há back nem auth, **toda** a "segurança" é inexistente hoje; num produto real, nenhuma verificação pode ficar só no cliente.

## 5. Observação técnica real já tratada: hidratação SSR (UTC × BR)

> **FATO COMPROVADO:** há um problema real de SSR documentado no código. `new Date("2026-06-30")` é meia-noite **UTC**; formatado no fuso local (UTC-3) volta o dia anterior. No SSR isso diverge entre servidor (UTC na Vercel) e navegador (UTC-3), causando erro de hidratação do React (#418/#423/#425). Mitigado em [`src/lib/utils.ts`](../src/lib/utils.ts) `formatShortDate` (lê componentes da string ISO, sem criar `Date`).

Implicação (RECOMENDAÇÃO): qualquer novo valor dependente de fuso/locale renderizado no SSR precisa do mesmo cuidado determinístico. Ver memória do projeto sobre "Vercel UTC vs BR — hidratação".

## 6. O que precisa ser verificado no ambiente real (NÃO COMPROVÁVEL com este pacote)

Executar **apenas** com acesso seguro e autorizado; **não** execute às cegas:

1. **Existe backend/banco em outro lugar?** Verificar se há um repositório de API, projeto Supabase/Postgres, ou serviço externo fora deste repo. (Nada disso aparece aqui.)
2. **Deploy publicado?** Conferir no provedor (ex.: Vercel) se há projeto/deploy e em que branch/estado. Comando sugerido *se* houver CLI e login: `vercel projects ls` / `vercel deployments ls`.
3. **Variáveis de ambiente:** hoje **não há** uso de `process.env` no código. Se um backend for adicionado, definir e nunca versionar `.env`.
4. **Segredos:** confirmar que nenhuma chave foi adicionada fora do controle de versão.
5. **Se e quando um banco existir:** validar schema real × `src/lib/types.ts`, checar RLS/policies, FKs e índices — nada disso é verificável a partir deste pacote.

## 7. Recomendações de arquitetura-alvo (RECOMENDAÇÃO)

- **Backend/banco:** Supabase (Postgres + Auth + Storage + RLS) encaixa bem no stack (Next.js) e cobre auth, dados e uploads de uma vez. Alternativa: API própria + Postgres/Prisma. Derivar o schema de `src/lib/types.ts`.
- **Auth + papéis:** três papéis (consumidor, lojista, admin) com autorização **serverside** e RLS por papel/estabelecimento. Adicionar `middleware.ts` para proteger `/portal` e `/admin`.
- **Regras de negócio:** mover gamificação (pontos/níveis) e ciclo do cupom para o servidor; o front consome, não decide.
- **Fonte única da "tabela de pontos":** hoje duplicada (`gamification.ts` × admin/configuracoes) — centralizar no backend.
