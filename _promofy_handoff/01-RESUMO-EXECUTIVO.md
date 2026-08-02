# 01 — RESUMO EXECUTIVO

*Escrito para ser entendido tanto por pessoa de negócios quanto por desenvolvedor. Marcações: FATO COMPROVADO / INFERÊNCIA / REQUISITO / RECOMENDAÇÃO / NÃO COMPROVADO.*

---

## Visão do produto

O **Promofy** é uma plataforma de **cupons e promoções locais** que conecta pessoas a ofertas exclusivas de estabelecimentos próximos, adicionando **gamificação** (pontos, níveis, ranking e premiações) e **assinatura** para o consumidor. A tagline usada no produto: *"A plataforma que conecta pessoas a ofertas exclusivas de estabelecimentos perto de você"* (FATO — [`src/app/layout.tsx`](../src/app/layout.tsx), metadata).

> **FATO COMPROVADO:** o repositório atual é um **protótipo de alta fidelidade, 100% mockado** — não implementa o produto real, apenas o simula de forma navegável para demonstração. Evidência: [`README.md`](../README.md) linhas 1–5.

## Problema que pretende resolver (INFERÊNCIA a partir das telas e textos)

- **Consumidor:** dificuldade de descobrir e aproveitar ofertas locais confiáveis; falta de incentivo/recompensa por usar cupons.
- **Estabelecimento:** dificuldade de atrair clientes locais, medir conversão de campanhas e fidelizar.
- **Operador da plataforma (admin):** precisa de visão consolidada de receita, assinantes, estabelecimentos e resgates.

## Públicos envolvidos (FATO — há uma frente de UI para cada)

1. **Consumidor** — usa o app `/m` para descobrir, favoritar, ativar e "resgatar" cupons, acompanhar pontos/ranking e assinar planos.
2. **Estabelecimento (lojista)** — usa o `/portal` para criar cupons, acompanhar métricas, ver avaliações e gerenciar o estabelecimento.
3. **Administrador da plataforma** — usa o `/admin` para acompanhar KPIs globais, gerenciar estabelecimentos, usuários, cupons, financeiro e avisos.
4. **Visitante/lead** — chega pelas **landing pages** (`/`, `/para-voce`, `/para-empresas`) e escolhe a frente (tela de acesso / "acesso chooser").

## Proposta de valor (INFERÊNCIA)

- Para o consumidor: **economia real + jogo/recompensa** (o app enfatiza "Economize R$ X", pontos e ranking).
- Para o lojista: **canal de aquisição local com métricas** (funil de conversão, resgates, avaliação média).
- Para o operador: **SaaS com receita recorrente** (planos de assinatura do consumidor; MRR aparece no dashboard admin).

## Sistemas existentes (frentes de UI)

Ver [`02-MAPA-DOS-SISTEMAS.md`](02-MAPA-DOS-SISTEMAS.md) para o detalhe. Em resumo: **landings** (marketing), **`/m`** (consumidor), **`/portal`** (estabelecimento) e **`/admin`** (operador) — tudo num só app Next.js.

## Principais fluxos de negócio

- **Descoberta → resgate (consumidor):** home com categorias/busca → detalhe do cupom → "Usar agora" → cupom ativo (código/QR fake) → "validação pelo estabelecimento" (simulada) → NPS → pontos creditados.
  - FATO: o ciclo de estados existe em [`src/components/coupon-state-provider.tsx`](../src/components/coupon-state-provider.tsx) (`disponivel → ativo → validado`, com NPS e pontos derivados).
- **Onboarding do consumidor:** cadastro (mock) → onboarding → tutorial → home. FATO: [`src/app/m/cadastro/page.tsx`](../src/app/m/cadastro/page.tsx) faz `router.push("/m/onboarding")`.
- **Gestão de cupom (lojista):** criar/editar cupom, validar cupom apresentado pelo cliente. FATO: [`src/components/portal/novo-cupom-form.tsx`](../src/components/portal/novo-cupom-form.tsx), [`validar-cupom-dialog.tsx`](../src/components/portal/validar-cupom-dialog.tsx) (formulários/diálogos de UI, sem persistência).
- **Operação (admin):** acompanhar KPIs e listas de estabelecimentos/usuários/cupons/financeiro. FATO: páginas em `src/app/admin/*` consumindo `adminKpis`, `funilConversao`, `receitaMensal` de mock-data.

> **RESSALVA (FATO):** todos esses fluxos são **de interface e estado de sessão**. Nada é persistido em servidor; um *reload* zera estados mantidos só em memória (favoritos, tutorial). O estado do cupom usa `localStorage`/`sessionStorage` para sobreviver à navegação, mas continua local ao navegador.

## Diferenciação entre cliente, estabelecimento e administrador

| Papel | Onde atua | O que faz | "Autenticação" |
|-------|-----------|-----------|----------------|
| Cliente | `/m` | Descobre, ativa e resgata cupons; pontos, ranking, planos | Tela de login/cadastro **apenas visual** — não valida credenciais |
| Estabelecimento | `/portal` | Cria cupons, vê métricas e avaliações, valida cupons | **Sem porta de login** — acesso direto pela URL |
| Administrador | `/admin` | KPIs globais, gestão de entidades, financeiro, avisos | **Sem porta de login** — acesso direto pela URL |

> **FATO COMPROVADO:** não há separação de acesso real entre papéis. `/portal` e `/admin` são acessíveis por qualquer um que abra a URL; o "login" do consumidor apenas navega (`router.push("/m")`, comentário `// mock — sem auth real` em [`src/app/m/login/page.tsx`](../src/app/m/login/page.tsx)).

## Funcionalidades principais (nível de UI)

- Catálogo de cupons por categoria, busca e filtros; favoritos; detalhe de cupom.
- Cupom ativo com código/QR simulado e "conferência de identidade" (CPF mascarado mock).
- Gamificação: pontos por ação, níveis (Bronze/Prata/Ouro/Diamante), ranking/pódio, premiações.
- Planos de assinatura (Básico/Plus/Família/VIP) — landing e `/m/planos`.
- Dashboards de estabelecimento e admin com KPIs, funil e séries mensais.

## Situação atual

- **Demo navegável e coerente**, com design system aplicado e dados internamente consistentes.
- **Sem** produção, sem dados reais, sem contas, sem pagamento, sem testes.

## Bloqueadores para virar produto

1. Ausência total de **backend, banco e API**.
2. Ausência de **autenticação e autorização**.
3. Ausência de **integrações** (pagamento, geolocalização/mapa, notificações, e-mail).
4. Ausência de **testes** e de **pipeline de deploy** versionado.
5. **Regras de negócio hoje no front** (gamificação, derivação de pontos) precisariam migrar para servidor.

## Riscos críticos (resumo — detalhe em 04)

- **Segurança/autorização:** hoje inexistente; qualquer produto real precisa de auth + RLS/serverside desde o início.
- **Confiança nos números:** KPIs são ilustrativos; não confundir com métricas reais.
- **Hidratação SSR (real e já observado):** datas/valores dependentes de fuso quebravam a hidratação na Vercel — mitigado em `src/lib/utils.ts` (`formatShortDate`). Sinaliza que SSR + fuso exige cuidado contínuo.

## Próximos marcos (RECOMENDAÇÃO — ver roadmap em 04)

1. Definir backend e banco (ex.: Supabase) + modelo de dados a partir de `src/lib/types.ts`.
2. Implementar autenticação e papéis (consumidor, lojista, admin) com autorização serverside.
3. Substituir mocks por dados reais, fluxo a fluxo, começando pelo ciclo do cupom.
4. Integrações: pagamento (planos), geolocalização, notificações.
5. Testes e CI/CD.

## Visão de evolução para mobile nativo

- **INFERÊNCIA/REQUISITO:** o app `/m` e (secundariamente) o `/portal` são os candidatos a virar apps nativos. O `/m` já é mobile-first (renderizado dentro de um `PhoneFrame`).
- **Vantagem:** boa parte da lógica é derivação pura (gamificação, formatadores, tipos) e reaproveitável.
- **Atenção:** o estado hoje é web (Context + `localStorage`); numa migração nativa isso vira armazenamento nativo + backend. Comparação PWA × híbrido × nativo em [`04-STATUS-RISCOS-E-ROADMAP.md`](04-STATUS-RISCOS-E-ROADMAP.md).
