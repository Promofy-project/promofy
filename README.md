# Promofy — Protótipo

Protótipo de alta fidelidade de uma plataforma SaaS de **cupons e promoções
locais**. Tudo é **mockado** (sem backend, sem autenticação, sem banco) — o foco
é parecer real e navegar perfeitamente para uma demo com cliente.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (primitives em `src/components/ui`)
- **lucide-react** para ícones
- Dados mockados em `src/lib/mock-data.ts` (arrays TS, sem fetch)

## Como rodar

```bash
npm install      # já instalado no scaffold
npm run dev      # http://localhost:3000
```

Outros scripts: `npm run build`, `npm run start`, `npm run lint`.

## Rotas (4 frentes num só projeto)

| Rota      | O que é                   | Layout                        |
| --------- | ------------------------- | ----------------------------- |
| `/`       | Landing page pública      | Desktop, responsiva           |
| `/m`      | App do consumidor         | Mobile-first, frame de ~390px |
| `/portal` | Portal do estabelecimento | Sidebar + dashboard           |
| `/admin`  | Painel administrativo     | Sidebar + dashboard           |

A landing tem uma seção **“Explore as quatro frentes”** com atalhos para cada
área. As telas internas detalhadas ainda não foram implementadas — os links de
navegação levam a stubs (“Em construção”) para manter a navegação fluida.

## Design System

Tokens cravados em `src/app/globals.css` (variáveis CSS) e `tailwind.config.ts`:

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
| `--danger`              | `#DC2626` | Status "Indisponível"                |

- Raio: **cards 16px** (`rounded-card`), **botões 12px** (`rounded-btn`)
- Sombra de card suave (`shadow-card` / `shadow-card-hover`)
- Fonte **Inter** via `next/font` (fallback corporativo — trocar pela fonte
  oficial da marca depois)

> Os valores são provisórios — **ajustar com o Figma Inspect** quando a marca
> oficial chegar. Há tokens hex (para CSS/gradientes) e tokens em canais RGB
> (`--c-*`, para opacidade do Tailwind, ex.: `bg-primary/10`).

## Componentes reutilizáveis (`src/components`)

- `CouponCard` — variante grid (imagem + badge "Oferta exclusiva" + rating +
  distância + "Economize R$ X" + validade + botão "Usar agora")
- `CouponListItem` — variante lista (thumb + título + economia + status + ♥)
- `PlanCard` — plano com benefícios (check amarelo) e estado bloqueado (VIP)
- `MetricCard`, `BusinessCard`, `ReviewCard`, `FunnelChart`, `BarChart`
- `BottomNav` (mobile) e `Sidebar` / `DashboardShell` (portal + admin)
- Apoio: `Logo`, `StarRating`, `FavoriteButton`, `CategoryChips`,
  `PageHeader`, `PagePlaceholder`, `PhoneFrame`, `Icon`

## Estrutura

```
src/
├── app/
│   ├── page.tsx              # / (landing)
│   ├── m/                    # /m (app consumidor) + buscar/favoritos/perfil
│   ├── portal/               # /portal (dashboard) + subpáginas
│   └── admin/                # /admin (dashboard) + subpáginas
├── components/               # componentes reutilizáveis + ui/ (shadcn)
└── lib/
    ├── mock-data.ts          # cupons, planos, estabelecimentos, usuários, funil
    ├── types.ts              # tipos do domínio
    └── utils.ts              # cn() + formatadores (R$, distância, datas)
```

---

Protótipo — dados meramente ilustrativos.
