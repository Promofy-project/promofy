# FASE 3 — Relatório de Implementação (App do Estabelecimento + Hospedado + Moderação)

*Branch: `fase-3-app-estabelecimento-hosted` (mesclada à `main`) · Data: 2026-07-21 · Status: **concluída, no ar e validada***

**URL de produção:** **https://promofy-pro.vercel.app** · Supabase hospedado `bpeqpxvxgdyjjdcoycgp` (sa-east-1).

> Entrega ao cliente (Lucas) em 22/07. Diretriz: demo para leigos — **erro visível é inaceitável**. Este relatório segue o padrão das Fases 1–2, com **(a) roteiro da demo**, **(b) preparação React Native**, o bloco de credenciais e a lista de screenshots de contingência.

---

## 1. Credenciais e URLs da demo (copiável)

**URL base:** `https://promofy-pro.vercel.app` · **Senha (todos):** `promofy123`

| Papel | E-mail | Onde entra | Observação |
|---|---|---|---|
| Consumidor | `consumidor@promofy.test` | `…/m/login` | 1.250 pts, R$ 0 economia (fresco) |
| Consumidor (convidado) | `convidado@promofy.test` | `…/m/login` | 2º consumidor p/ cliente + esposa ao mesmo tempo |
| Lojista (Sabor & Cia / e1) | `lojista@promofy.test` | `…/e/login` | app do balcão + `…/portal` (web) |
| Lojista 2 (PowerFit / e2) | `lojista2@promofy.test` | `…/portal/login` | isolamento entre estabelecimentos |
| Admin | `admin@promofy.test` | `…/admin/login` | moderação |

**Frentes:** consumidor `…/m` · **app do estabelecimento `…/e`** · portal web do lojista `…/portal` · admin `…/admin`.

## 2. Validação no ar — 5/5 (promofy-pro.vercel.app)

| # | Critério | Resultado |
|---|---|---|
| 1 | 3 logins (consumidor/lojista/admin) | ✅ todos entram e caem na frente certa |
| 2 | Ciclo completo | ✅ consumidor ativou c01 → lojista validou no `/e` (tela verde: título + **Lucas Orladi / 123.***.***-09**) → **pontos 1.250→1.300 + economia R$ 0→45** subiram juntos |
| 3 | `/e` em 390×844 | ✅ full-bleed (sem moldura), alvos grandes, campo com foco automático |
| 4 | Redirects do middleware (anônimo) | ✅ `/e`, `/portal`, `/admin` → 307 → seus logins |
| 5 | Admin aprova cupom pendente → `/m` | ✅ criou "Sobremesa grátis (demo)" no `/e` → aprovou (pendentes 1→0) → **surgiu no `/m`** |

Após a validação, o estado hospedado foi **restaurado ao pristino e congelado** (ver §7).

## 3. Percalço de deploy registrado (honestidade)

- **Env vars faltando no runtime:** o primeiro deploy subiu com `MIDDLEWARE_INVOCATION_FAILED` (500 em todas as rotas do matcher) porque as env vars da Vercel não estavam aplicadas ao build. Corrigido adicionando `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` em Production + redeploy.
- **Bug de RSC no `/e` (o mais importante):** `TotemActionCard` (Client Component) recebia `icon={Ticket}` — **um componente lucide (função)** — de um Server Component (`/e/page`). Isso **não pode** cruzar a fronteira RSC → exceção de serialização em runtime (500), que o `next build` **não pega** (o tipo é válido). O `/e` nunca tinha rodado em runtime (só build) até o deploy. **Lição:** telas novas precisam de smoke em runtime (dev), não só build. Corrigido: `icon` agora é `ReactNode` (elemento renderizado, que serializa) — commit `fix(e): TotemActionCard recebe icon como ReactNode`. Reproduzido em dev, todas as 5 telas do `/e` + admin + `/m` verificadas antes do redeploy.

## 4. O que foi feito (por entrega/commit)

| Commit | Entrega |
|---|---|
| `chore(fase3)` | Scripts aceitam `--hosted` (`.env.hosted.local`); `seed/test:*:hosted` |
| `feat(e)` | **BLOCO B:** app `/e` (mobile-first, "modo totem"): middleware, `EstabPhoneFrame`, login (checa papel), home, **validar** (reusa `validar_cupom`), cupons, novo cupom, perfil; `Button size xl`, `TotemActionCard`, `ResultadoValidacao` |
| `feat(fase3-db)` | Migrations: `fase3_enums` (`rejeitado`), **`fase3_cupons_grants`** (fix de segurança), `fase3_moderacao_rpcs`, `fase3_economia_rpc`; `db:types` |
| `feat(admin)` | **BLOCO C:** moderação de cupons (`/admin/cupons`, filtro, modal completo, aprovar/rejeitar) e estabelecimentos (aprovar/suspender); `rejeitado` propagado |
| `feat(consumidor+portal)` | **D3** economia na home (RPC + provider/poll + card dividido) + **D2** categoria server-authoritative + forms travados |
| `feat(admin)` | **D1** detalhe expandido de usuário (cadastro, pontos, economia, cupons, estabelecimentos) |
| `test(fase3)` | `test-fase3.ts` (22 asserções) + `verify` |
| `fix(e)` + `feat(seed)` | Fix RSC do `/e`; 2º consumidor `convidado@` com bônus |

## 5. Critérios de aceite (8)

1. **URL 3 logins + ciclo** ✅ (§2). 2. **`/e` valida real, dados do cliente, erros claros** ✅ (8 motivos incl. `esgotado`). 3. **Pendente→aprovado→/m; rejeitado não** ✅ (`test-fase3` + no ar). 4. **Suspender remove do catálogo** ✅ (`test-fase3`, RLS). 5. **Detalhe de usuário no admin** ✅ (D1). 6. **Categoria pré-setada** ✅ (D2, server-authoritative — visto no ar). 7. **Economia total real na home** ✅ (D3). 8. **Suites verdes local E hosted + build** ✅ — local `verify` **25 RLS + 27 Fase 2 + 22 Fase 3 + build**; hosted **`test:rls:hosted` 25/25** (fase2/fase3 verdes localmente; não rodadas no projeto da demo por serem mutantes — corte de risco).

## 6. Segurança — resumo

- **Correção ALTA:** `cupons` ganhou **grant por coluna** (`fase3_cupons_grants`) — sem isso o lojista fazia `PATCH /cupons {status:'ativo'}` e **auto-aprovava** o próprio cupom, contornando o admin. `test-fase3` prova `42501` no caminho direto (lojista **e** consumidor) e `sem_permissao` via RPC.
- **Moderação só admin:** RPCs `aprovar_cupom`/`rejeitar_cupom`/`definir_status_estabelecimento` `security definer` + `private.is_admin()` + `search_path=''` + `revoke public/anon`.
- **Economia (D3):** `economia_total_consumidor` `security definer`, filtro `usuario_id = auth.uid()` (única barreira); `test-fase3` prova isolamento entre 2 usuários + anon bloqueado.
- **Chaves:** `.env.hosted.local` gitignored; Vercel só com as 2 `NEXT_PUBLIC_*`; `service_role` nunca versionado nem na Vercel.

## 7. Ambiente hospedado — estado final

Migrations via `supabase db push` (11), seed via conector, `seed:users:hosted` (papéis coerentes claim+profile). Após a validação, **restauração pristina** (sem `db reset` destrutivo, que o classificador bloqueou): limpeza do ciclo/eventos/pontos de runtime **preservando as 20.475 métricas do seed e o bônus**, deleção do cupom de teste, `e1` ativo, `seed:users:hosted`. **Verificação pós-restauro (confirmada por consulta):** 14 cupons · ciclo 0 · métricas 20.475 · `e1` ativo · consumidor@ e convidado@ com **1.250 pts / R$ 0** · 4 papéis coerentes. **Hosted congelado.** *(Auth: confirmação de e-mail DESLIGADA para a demo — religar antes do lançamento público.)*

## 8. (a) ROTEIRO DA DEMO DE 22/07

**URL:** `https://promofy-pro.vercel.app` · senha `promofy123`.

1. **Consumidor** (`/m/login` como `consumidor@`) → home mostra cupons + **1.250 pts** e **R$ 0 economizado**.
2. **Ativar cupom:** abrir "Rodízio de pizza em dobro" → **"Usar cupom"** → aparece o código `PRMF-XXXX-XXXX` + QR (sobrevive a reload).
3. **Validar no balcão (celular, `/e/login` como `lojista@`):** home totem → **"Validar cupom"** → digitar o código → **tela verde** com título, **nome do cliente e CPF mascarado**. *(Mostrar um código inválido → tela vermelha com motivo claro.)*
4. **NPS + pontos/economia:** de volta no `/m` do consumidor, o polling detecta a validação e abre o **NPS**; ao responder, **pontos e economia sobem juntos**.
5. **Admin aprova um cupom novo:** lojista cria em `/e/cupom/novo` (nasce **pendente**) → admin (`/admin/cupons`) filtra **Pendentes**, abre **Detalhes** (todos os campos) e **Aprova** → o cupom **surge no `/m`**. *(Opcional: suspender um estabelecimento em `/admin/estabelecimentos` → seus cupons somem do catálogo.)*
6. **Segundo consumidor:** a esposa entra em outro aparelho como `convidado@` — sessões independentes, ambos usam ao mesmo tempo.

**Fallback visual (se a rede falhar):** 7 screenshots do fluxo completo em **`docs/demo/`**:
`demo-01-e-home-390x844` · `demo-02-e-validar-390x844` · `demo-03-cupom-ativado-codigo` · `demo-04-validacao-sucesso` · `demo-05-m-home-pontos-economia` · `demo-06-admin-cupons-pendente` · `demo-07-admin-detalhe-modal`.

## 9. (b) PREPARAÇÃO REACT NATIVE

**Recomendação: dois apps nativos separados** — **consumidor** (do `/m`) e **estabelecimento** (do `/e`) — com um **pacote compartilhado** de lógica. Perfis de uso e ciclos distintos (descoberta/gamificação × balcão operacional) justificam apps, ícones e lojas próprios.

| Camada | Reaproveitável em RN | Reescrever para nativo |
|---|---|---|
| Regras/tipos | `types.ts`, `gamification.ts`, contratos de RPC (`ativar_cupom`/`validar_cupom`/`aprovar_cupom`/`economia_total_consumidor`…), formatadores de `utils.ts` (exceto `cn`) | — |
| Estado de tela | Padrão Context (`CouponStateProvider`, `EstabProvider`) — portável | Server Actions → `@supabase/supabase-js` RN + storage nativo p/ sessão |
| UI | Estrutura/telas, hierarquia, fluxo "modo totem" | `next/*`, Tailwind/CSS, Radix/shadcn, `PhoneFrame`/`EstabPhoneFrame`, DOM → componentes RN |
| Navegação | Conceito de rotas/abas | App Router → navegação nativa (ex.: Expo Router) |
| Câmera/QR | O **contrato** do `qr-scanner` (componente trocável) | Implementação vira câmera nativa (o `/e` já isola isso) |
| Auth | Fluxo (login → papel → destino) | Middleware → guardas de navegação; deep links/push são novos |

**Já a favor do RN:** validação/moderação/economia vivem no servidor (RPCs) — o app nativo só consome API; `qr-scanner` isolado; `/e` sem `localStorage`. **Aprendizado desta fase:** cuidado com passar componentes por props entre Server/Client Components (o bug do `/e`) — em RN esse limite não existe, mas o hábito de tipar ícones como elemento/nome ajuda.

## 10. Pendências para a Fase 4 (honesto)

- **Multi-categoria por estabelecimento** (tabela `estabelecimento_categorias` + RLS por posse) — hoje pré-seta a categoria única; falta suporte a N (ex.: restaurante fitness = alimentação + fitness). *Adiado conscientemente pelo prazo de ~1 dia; o brief permite.*
- **Relatório de NPS do estabelecimento** (visto em `docs/modelo/…/NPS.png`): agregado detratores/neutros/promotores por período — o NPS já é coletado, falta a visão do lojista.
- **Mural de avisos/notícias do estabelecimento** (`…/Mural de informações.png`): recebe os comunicados que o admin já dispara em `/admin/avisos`.
- **QR scanner real** (câmera) — hoje é stub trocável "em breve"; **upload de imagem** de cupom (storage desligado).
- **Suites mutantes contra o hosted** (`test:fase2/fase3:hosted`) — verdes localmente; não rodadas no projeto da demo por mutarem dados. Rodar num **branch do Supabase** descartável.
- **D4:** `/admin/configuracoes` salvando `config_pontos` (a policy `admin gerencia` já permite) — ajuste rápido pós-demo.
- **`/m/buscar`, `/m/favoritos`** ainda leem do mock (Fase 2) — não refletem cupons criados ao vivo; o catálogo real é a home `/m`.
