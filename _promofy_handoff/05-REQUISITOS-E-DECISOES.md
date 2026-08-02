# 05 — REQUISITOS E DECISÕES

*Onde procurei: `README.md`, comentários no código, textos de UI, TODO/FIXME. **Não há** no repositório documentos formais de requisitos, atas, transcrições, checklists de escopo ou arquivos de planejamento além do `README.md` e dos comentários.*

> **Regra aplicada:** afirmação de documento/UI **não** é prova de implementação. Aqui, quase todo "requisito" vem do `README.md` (intenção do autor) ou de textos de marketing nas landings — não de um backlog formal.

---

## 1. Requisitos / intenções documentadas

| # | Descrição | Origem | Arquivo | Status no código | Divergência requisito × código |
|---|---|---|---|---|---|
| Q1 | "Protótipo de alta fidelidade… tudo mockado, foco em parecer real e navegar para demo" | README | `README.md` L1–5 | **Cumprido** | Nenhuma — o repo é exatamente isso |
| Q2 | 4 frentes num só projeto (`/`, `/m`, `/portal`, `/admin`) | README | `README.md` L23–34 | **Cumprido** | Existem também `/para-voce` e `/para-empresas` (landings por público) — evolução além do README |
| Q3 | "Telas internas detalhadas ainda não implementadas → stubs 'Em construção'" | README | `README.md` L34 | **Parcialmente desatualizado** | Muitas telas internas **já existem** (portal/admin/perfil) — o README ficou para trás |
| Q4 | Design tokens provisórios, "ajustar com Figma Inspect quando a marca chegar" | README | `README.md` L57–59 | **Pendente** | Tokens em `globals.css`/`tailwind.config.ts` são provisórios |
| Q5 | Fonte Inter é fallback — "trocar pela fonte oficial depois" | README | `README.md` L54–55 | **Pendente** | `layout.tsx` usa Inter |
| Q6 | Dados mockados em `src/lib/mock-data.ts` | README | `README.md` L12 | **Cumprido** | — |

## 2. Decisões técnicas registradas (via comentários no código — FATO)

| # | Decisão | Evidência |
|---|---|---|
| D1 | **Estado da demo zera no reload** (favoritos/tutorial em memória) — "comportamento desejado para a demo" | `mobile-flow-provider.tsx` L24; `favorites-provider.tsx` |
| D2 | **Ciclo do cupom persiste** em `localStorage`/`sessionStorage` para sobreviver à navegação (conceito "Onda 1") | `coupon-state-provider.tsx` (L24, L61) |
| D3 | **Saldo de pontos é derivado (leitura pura)** do estado dos cupons + `SALDO_BASE`, sem mutar as ações de escrita | `coupon-state-provider.tsx` `getPontos`; `gamification.ts` |
| D4 | **"Tabela de pontos" espelhada** entre `gamification.ts` e `admin/configuracoes` — manter em sincronia manual ("Mudou lá → mudar aqui") | `gamification.ts` L7–9 |
| D5 | **Dois conjuntos de planos**: `planos` (landing) e `planosMobile` (`/m/planos`) — "mantido separado para não alterar a landing" | `mock-data.ts` L461–462 |
| D6 | **Métricas de cupom aditivas** — "não altera o tipo Cupom nem afeta /m, landing ou /admin" | `mock-data.ts` L390–393 |
| D7 | **`formatShortDate` determinístico por fuso** para evitar erro de hidratação SSR (UTC×BR na Vercel) | `utils.ts` L36–56 |
| D8 | **Alfabeto do código de cupom sem 0/O/1/I ambíguos**, igual entre app e portal ("Onda 1") | `validar-cupom-dialog.tsx` L11 |
| D9 | **CPF sempre mascarado**, nunca real | `mock-data.ts` L535–543 |

## 3. Decisões de produto / negócio (INFERÊNCIA a partir de UI e comentários)

| # | Decisão | Evidência | Observação |
|---|---|---|---|
| P1 | **Estabelecimento é gratuito "por ora"** — item "Planos" oculto no menu do portal; landing de empresas insiste em "100% gratuito, sem mensalidade" | `sidebar.tsx` L48; `para-empresas/page.tsx` (várias) | `/portal/planos` **permanece no código**, só escondido |
| P2 | **Monetização via assinatura do consumidor** — planos pagos Básico R$9,90 / Plus R$19,90 / Família R$29,90 | `mock-data.ts` `planos`/`planosMobile` | MRR aparece no dashboard admin |
| P3 | **Plano VIP "Em breve"/bloqueado** (convite/conquista) | `mock-data.ts` L444–458; `plan-card.tsx`; `types.ts` L53 | Não vendável hoje |
| P4 | **Landings segmentadas por público** (`/para-voce`, `/para-empresas`) + tela de acesso | commit "landing pages por público"; `acesso-chooser.tsx` | Evolução além do README |
| P5 | **Gamificação como pilar** (pontos por resgate/nps/indicação/visita; níveis; ranking; premiações) | `gamification.ts`; `m/premiacoes` | Regras hoje no front |
| P6 | Construção em **"Ondas"** (iterações incrementais) | comentários "Onda 1" | Indica processo iterativo |

## 4. Contradições / divergências encontradas (FATO)

| # | Divergência | Detalhe | Recomendação |
|---|---|---|---|
| C1 | README diz "telas internas ainda não implementadas (stubs)", mas muitas **já existem** | `README.md` L34 × `src/app/portal/*`, `admin/*`, `m/perfil/*` | Atualizar o README |
| C2 | README lista **4 rotas**; há **6** (faltam `/para-voce`, `/para-empresas`) | `README.md` L23–34 × `src/app/` | Atualizar o README |
| C3 | Planos do consumidor **começam pagos** (R$9,90) em `planos`/`planosMobile`, mas a landing `/para-voce` anuncia um tier **"GRATUITO" (1 cupom/mês)** | `mock-data.ts` × `para-voce/page.tsx` L81–84 | Definir se há free tier real e unificar a fonte de planos |
| C4 | Estabelecimento "gratuito" (P1) **coexiste** com `/portal/planos` e um conjunto de planos no código | `sidebar.tsx` L48 × `portal/planos` | Decidir o modelo do lojista e refletir numa fonte única |
| C5 | Regra de pontos **duplicada** (D4) — risco de divergir | `gamification.ts` × `admin/configuracoes` | Fonte única no backend |

## 5. Requisitos sem implementação (backlog implícito)

- Autenticação/cadastro/recuperação reais; papéis e permissões.
- Backend, banco e persistência (favoritos, conta, cupons, métricas).
- Pagamento/checkout dos planos; cashback anunciado nos planos.
- Geolocalização real (distância hoje é número mock); mapa.
- Notificações/push; e-mail; formulário de lead das landings.
- Upload real de imagens de cupom/estabelecimento.
- Testes e CI/CD.

## 6. Implementações sem requisito documentado (encontradas no código)

- Landings segmentadas por público e tela de acesso (não descritas no README).
- Fluxo completo de NPS pós-validação e derivação de pontos.
- "Modo manutenção" como toggle nas configurações do admin (`admin/configuracoes`).
- Convite/indicação (`m/perfil/convide`) e premiações/ranking com pódio.

> **NÃO COMPROVADO:** decisões comerciais (preços finais, modelo de cobrança do lojista, metas de negócio) e qualquer requisito de contrato/cliente não estão no repositório — precisam ser confirmados com o time de produto.
