# 00 — LEIA PRIMEIRO

> **Porta de entrada do Pacote Portátil de Contexto do Promofy.**
> Comece por este arquivo. Ele explica o que é o pacote, como interpretá-lo e em que ordem ler o resto.

---

## O que é o Promofy (resumo)

O Promofy é um **protótipo de alta fidelidade** de uma plataforma SaaS de **cupons e promoções locais**, que conecta consumidores a ofertas de estabelecimentos próximos, com mecânica de **gamificação** (pontos, níveis, ranking, premiações) e um modelo de **planos por assinatura** para o consumidor.

> **FATO COMPROVADO (o mais importante de todo o pacote):** hoje o repositório é um **front-end 100% mockado**. **Não há** backend, banco de dados, autenticação, API, ORM, migrations, edge functions nem variáveis de ambiente no código.
> Evidência: [`README.md`](../README.md) linhas 3–5 ("Tudo é **mockado** (sem backend, sem autenticação, sem banco)"); [`package.json`](../package.json) não contém nenhuma dependência de backend/DB/auth; buscas no `src/` por `process.env`, `fetch(`, `axios`, `supabase`, `createClient`, `prisma` retornam **zero** ocorrências; nenhum arquivo `.env` é versionado.

Todos os dados exibidos vêm de arrays TypeScript em [`src/lib/mock-data.ts`](../src/lib/mock-data.ts). Toda a "lógica de negócio" que existe é derivação/estado de UI em React (Context + `useState`), não regra de servidor.

---

## Sistemas que compõem a plataforma

Tudo vive em **um único projeto Next.js** (App Router), organizado por **domínios de rota** — não é um monorepo. Os "seis sistemas" pedidos no briefing mapeiam assim:

| # | Sistema (nome funcional)            | Rota / diretório               | Situação |
|---|-------------------------------------|--------------------------------|----------|
| 1 | Portal de gestão do estabelecimento | `/portal` — `src/app/portal/`  | UI navegável, mockado |
| 2 | Painel administrativo global        | `/admin` — `src/app/admin/`    | UI navegável, mockado |
| 3 | Landing page de estabelecimentos    | `/para-empresas` — `src/app/para-empresas/` | UI, mockado |
| 4 | Landing page de clientes            | `/para-voce` + `/` — `src/app/para-voce/`, `src/app/page.tsx` | UI, mockado |
| 5 | App do cliente (consumidor)         | `/m` — `src/app/m/`            | UI navegável mais completa, mockado |
| 6 | App do estabelecimento              | **é o próprio `/portal`** (mesma base) | ver #1 |
| 7 | Backend + módulos compartilhados    | `src/lib/` + providers em `src/components/` | **mock/estado de UI**, sem servidor |

> **INFERÊNCIA:** o item "aplicação web dos estabelecimentos, candidata a mobile" (#6 do briefing) e "sistema de gestão de estabelecimentos" (#1) referem-se ao **mesmo** código `/portal`. Não há uma segunda aplicação de estabelecimento separada no repositório. Evidência: só existe um diretório `src/app/portal/`.

---

## Tecnologias principais (FATO COMPROVADO)

- **Next.js 14.2.35** (App Router) + **React 18** + **TypeScript 5** — [`package.json`](../package.json)
- **Tailwind CSS 3.4** + **shadcn/ui** (primitivos em `src/components/ui/`) — [`components.json`](../components.json), [`tailwind.config.ts`](../tailwind.config.ts)
- **lucide-react** (ícones) e **Radix UI** (avatar, label, separator, slot, switch)
- Fonte **Inter** via `next/font` — [`src/app/layout.tsx`](../src/app/layout.tsx)
- Sem bibliotecas de data-fetching, estado global (Redux/Zustand), auth ou DB.

---

## Arquitetura em alto nível

```
Navegador
  └─ App Next.js (App Router, SSR + Client Components)
       ├─ / , /para-voce , /para-empresas   → landings (marketing)
       ├─ /m         → app do consumidor (mobile-first, dentro de um PhoneFrame)
       ├─ /portal    → dashboard do estabelecimento
       └─ /admin     → dashboard administrativo
             │
             ├─ Estado de sessão: React Context
             │     • CouponStateProvider  (ciclo do cupom; usa localStorage/sessionStorage)
             │     • FavoritesProvider     (favoritos, em memória)
             │     • MobileFlowProvider     (tutorial/menu, em memória)
             │
             └─ "Dados": import estático de src/lib/mock-data.ts (arrays TS)
                         + regras em src/lib/gamification.ts + formatadores em src/lib/utils.ts
```

Não há chamada de rede saindo do app. Não há camada de servidor além do que o Next.js renderiza a partir dos mocks.

---

## Estado geral do projeto

- **Pronto:** navegação fluida entre as quatro frentes, design system aplicado, telas de demonstração convincentes, um fluxo de cupom com estados (disponível → ativo → validado → NPS) no app do consumidor.
- **Ausente:** persistência real, autenticação, autorização, backend, integrações (pagamento, mapa, push), testes automatizados e pipeline de deploy versionado.
- **Objetivo atual do artefato:** demo de produto para cliente/investidor. **Não** é um MVP de produção.

Detalhamento por sistema em [`02-MAPA-DOS-SISTEMAS.md`](02-MAPA-DOS-SISTEMAS.md) e [`04-STATUS-RISCOS-E-ROADMAP.md`](04-STATUS-RISCOS-E-ROADMAP.md).

---

## Organização do repositório

```
promofy/
├── src/
│   ├── app/            # rotas (landings, /m, /portal, /admin) — App Router
│   ├── components/     # componentes; ui/ = shadcn; portal/ admin/ landing/ = por domínio
│   └── lib/            # mock-data.ts, types.ts, utils.ts, gamification.ts
├── public/             # imagens/assets (125 arquivos de imagem)
├── package.json, tailwind.config.ts, tsconfig.json, next.config.mjs, components.json
└── _promofy_handoff/   # ESTE pacote (não faz parte do app)
```

---

## Ordem recomendada de leitura deste pacote

1. **00-LEIA-PRIMEIRO.md** (este arquivo) — porta de entrada.
2. **01-RESUMO-EXECUTIVO.md** — visão de produto e negócio.
3. **02-MAPA-DOS-SISTEMAS.md** — cada sistema em detalhe + matriz consolidada.
4. **03-ARQUITETURA-BANCO-E-AUTH.md** — arquitetura técnica, "banco" (mocks) e "auth" (inexistente).
5. **04-STATUS-RISCOS-E-ROADMAP.md** — o que está pronto/parcial/simulado/ausente, riscos e roadmap até produção (inclui mobile nativo).
6. **05-REQUISITOS-E-DECISOES.md** — requisitos, decisões e divergências requisito × código.
7. **06-REPOMIX-CORE.xml** — evidência de código: backbone compartilhado.
8. **07-REPOMIX-ESTABELECIMENTOS-ADM.xml** — evidência: `/portal` + `/admin`.
9. **08-REPOMIX-CLIENTES-LPS.xml** — evidência: `/m` + landings.

Tamanhos aproximados dos pacotes de código: CORE ~80 KB, ESTABELECIMENTOS-ADM ~126 KB, CLIENTES-LPS ~249 KB.

---

## Hierarquia de fontes de verdade

1. **Código nos arquivos Repomix** (06/07/08) — a verdade mais forte.
2. **Configurações, tipos e dados** no próprio código (`package.json`, `tsconfig`, `src/lib/types.ts`, `src/lib/mock-data.ts`).
3. **Documentos Markdown deste pacote** (01–05) — consolidação/interpretação.
4. **`README.md`** do projeto — intenção declarada do autor.
5. **Inferências** claramente marcadas neste pacote.

Quando houver conflito, o **código vence**.

---

## Como interpretar este pacote

- Os **documentos Markdown (01–05)** são a **consolidação/leitura**; podem conter inferência e recomendação.
- Os **arquivos Repomix (06–08)** são a **evidência de código** — confira as afirmações técnicas neles antes de aceitá-las.
- **Documento de requisito representa intenção/promessa, não implementação.** Neste repositório o único documento de requisito é o `README.md`.
- **Código existente ≠ funcionalidade validada.** Existir uma tela não prova que há fluxo, persistência, integração ou regra de negócio por trás.
- **Migrations não comprovam banco atualizado** — aqui, aliás, **não existem migrations nem banco**.
- **Configuração de deploy no repositório não comprova versão publicada** — aqui não há configuração de deploy versionada além do padrão Next.js.

### Convenção de marcação usada nos documentos

- **FATO COMPROVADO** — verificável no código/arquivo citado.
- **INFERÊNCIA** — conclusão razoável a partir das evidências, não afirmada explicitamente.
- **REQUISITO** — intenção/promessa documentada (aqui, quase tudo vem do `README.md`).
- **RECOMENDAÇÃO** — sugestão de próximo passo.
- **NÃO COMPROVADO** — só verificável em ambiente externo (deploy, banco real, dashboards) ao qual este pacote não dá acesso.

---

## Limitações deste pacote

- Reflete o estado do repositório em **2026-07-12** (branch `main`).
- Não inclui `node_modules`, builds (`.next`), imagens/binários, lockfile nem o arquivo `repomix-promofy.xml` pré-existente.
- Não dá acesso a Git remoto, terminal, banco, provedor de deploy ou histórico da conversa que o gerou.

## Informações que NÃO puderam ser confirmadas com o repositório

1. Se existe **algum backend/banco em outro repositório ou serviço** (Supabase, API própria) — **nada disso aparece aqui**.
2. Se há **deploy publicado** (Vercel ou outro) e em que estado. Há apenas indícios de execução na Vercel (comentários sobre hidratação UTC×BR em `src/lib/utils.ts`), mas nenhum arquivo de configuração de deploy versionado.
3. **Requisitos de negócio** além do `README.md` (contratos, atas, escopo comercial) — não versionados.
4. Preços, planos e regras de gamificação **definitivos** — os valores no código estão marcados como provisórios/ilustrativos.
5. Identidade visual/marca final — o `README.md` diz que tokens e fonte são provisórios ("ajustar com o Figma Inspect").

> **Instrução ao próximo modelo:** antes de aceitar qualquer afirmação técnica deste pacote, confirme-a nos arquivos Repomix (06/07/08). Trate 01–05 como leitura, e o código como prova.
