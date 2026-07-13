# Promofy

Plataforma SaaS de **cupons e promoções locais** com fundação real em
**Supabase local** (Postgres + Auth + RLS). Na **Fase 2**, o servidor virou a
única fonte de verdade do **ciclo do cupom** (ativar → validar → NPS → pontos)
e da **criação de cupom** — via RPCs `security definer` chamadas por Server
Actions. O front consome, não decide; nenhuma regra vive só no cliente. As
demais telas ainda usam mocks de `src/lib/mock-data.ts` (migração gradual —
ver `_promofy_handoff/FASE-1-RELATORIO.md` e `FASE-2-RELATORIO.md`).

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (primitives em `src/components/ui`)
- **Supabase** (Postgres 17 + Auth + RLS) via `@supabase/ssr`
- **lucide-react** para ícones

## Como rodar (local)

Pré-requisitos: Node 20+, Docker Desktop rodando, Supabase CLI 2.x.

```bash
npm install
supabase start                 # sobe o stack local (portas 553xx)
cp .env.local.example .env.local   # e preencha com as chaves do `supabase status`
npm run db:reset               # migrations + seed + usuários de teste
npm run dev                    # http://localhost:3000
```

> **Windows/PowerShell 5.1:** use sempre os npm scripts (rodam no cmd.exe).
> `&&` não funciona no PowerShell 5.1 e `>` gera arquivo UTF-16 (quebra o build).

Scripts úteis:

| Script | O que faz |
| --- | --- |
| `npm run db:reset` | `supabase db reset` (migrations + seed) **+** usuários de teste |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |
| `npm run test:rls` | 25 asserções de RLS por papel (anon/consumidor/lojista/admin) |
| `npm run test:fase2` | 27 asserções de fluxo do ciclo do cupom (RPCs) |
| `npm run verify` | reset + RLS + fase 2 + build (validação completa do zero) |
| `npm run verify:fase1` | reset + RLS + build (subset da Fase 1) |

### Credenciais de teste (apenas local)

| E-mail | Senha | Papel | Acessa |
| --- | --- | --- | --- |
| `consumidor@promofy.test` | `promofy123` | consumidor | `/m` (app do consumidor; começa com 1250 pts de bônus) |
| `lojista@promofy.test` | `promofy123` | lojista | `/portal` (Sabor & Cia — e1) |
| `lojista2@promofy.test` | `promofy123` | lojista | `/portal` (PowerFit — e2; prova isolamento) |
| `admin@promofy.test` | `promofy123` | admin | `/admin` |

Todo `npm run db:reset` recria os usuários (o banco é zerado).

## Rotas (4 frentes num só projeto)

| Rota | O que é | Autenticação |
| --------- | ------------------------- | --- |
| `/`, `/para-voce`, `/para-empresas` | Landing pages públicas | — |
| `/m` | App do consumidor (mobile-first) | Livre p/ navegar; `/m/perfil` e "Usar cupom" exigem login |
| `/portal` | Portal do estabelecimento | Exige papel **lojista** (`/portal/login`) |
| `/admin` | Painel administrativo | Exige papel **admin** (`/admin/login`) |

A proteção de rotas fica em `src/middleware.ts` (com `src/`, o Next ignora
middleware na raiz do repo). A fronteira de segurança real é o **RLS** no
banco — nenhuma regra vive só no front.

## Banco de dados

- Migrations versionadas em `supabase/migrations/` (schema → funções/triggers
  → RLS → views). `supabase db reset` reproduz tudo do zero.
- Seed em `supabase/seed.sql` (dados transcritos do mock, ids preservados) +
  `scripts/seed-users.ts` (usuários via admin API — encadeado no `db:reset`).
- Métricas de cupom são **derivadas** de `cupom_eventos`
  (view `cupom_metricas`), nunca contadores soltos.
- `config_pontos` é a fonte única da tabela de pontos (o front ainda usa as
  constantes de `src/lib/gamification.ts` nesta fase).

## O que já lê do banco (Fase 1)

- Home do `/m` (grid de cupons) — server component.
- `/portal/cupons` (lista + métricas do estabelecimento do lojista logado).
- Login/cadastro/logout reais nas três frentes.

O ciclo do cupom no `/m` (ativar → validar → NPS → pontos) segue **mockado em
memória** nesta fase, por decisão de escopo.

## Design System

Tokens em `src/app/globals.css` (variáveis CSS) e `tailwind.config.ts`:

| Token                   | Valor     | Uso                                  |
| ----------------------- | --------- | ------------------------------------ |
| `--promofy-blue`        | `#1414DC` | Primária — botões, logo, destaques   |
| `--promofy-blue-dark`   | `#0F0FA8` | Hover da primária                    |
| `--promofy-yellow`      | `#FAC81E` | CTAs secundários, "Oferta exclusiva" |
| `--promofy-yellow-soft` | `#FFF3CC` | Fundos de destaque                   |
| `--bg-app`              | `#F5F6FB` | Fundo do app                         |
| `--text-primary`        | `#1A1A2E` | Texto principal                      |
| `--text-muted`          | `#6B7280` | Texto secundário                     |
| `--success`             | `#16A34A` | Status "Ativo"                       |
| `--danger`              | `#DC2626` | Status "Indisponível" / erros        |

- Raio: **cards 16px** (`rounded-card`), **botões 12px** (`rounded-btn`)
- Fonte **Inter** via `next/font` (fallback — trocar pela fonte oficial depois)

## Estrutura

```
src/
├── app/
│   ├── page.tsx               # / (landing) + para-voce/ para-empresas/
│   ├── m/                     # app consumidor (login/cadastro reais)
│   ├── portal/(painel)/       # dashboard do lojista + portal/login/
│   └── admin/(painel)/        # painel admin + admin/login/
├── middleware.ts              # proteção de rotas por papel
├── components/                # componentes + ui/ (shadcn)
└── lib/
    ├── supabase/              # clients ssr (browser/server/middleware) + types
    ├── data/                  # fetchers + mappers banco -> tipos do protótipo
    ├── mock-data.ts           # dados das telas ainda não migradas
    ├── gamification.ts        # regras de pontos/níveis (client, Fase 1)
    └── utils.ts               # cn() + formatadores (atenção a fuso em datas!)
supabase/
├── config.toml                # stack local (portas 553xx; storage/analytics off)
├── migrations/                # schema, funções, RLS, views
└── seed.sql                   # dados de demonstração
scripts/
├── seed-users.ts              # usuários de teste (service_role — só local)
└── test-rls.ts                # suíte de asserções de RLS
```

## Datas e fuso (importante)

`new Date("2026-06-30")` é meia-noite **UTC** e desloca um dia em UTC-3 —
divergindo entre SSR (Vercel/UTC) e navegador (BR), o que causa erro de
hidratação. Use o padrão de `formatShortDate` em `src/lib/utils.ts` (parse dos
componentes da string ISO, sem `Date` local) para qualquer data nova.

---

Fase 1 concluída — relatório completo em `_promofy_handoff/FASE-1-RELATORIO.md`.
