# LEGAL-PRIVACY-01 — gap analysis: aceites versionados, cookies, privacidade, data lifecycle

**Data:** 2026-09-08
**Branch:** `feat/legal-privacy-data-lifecycle`
**Base:** `main` @ `ce5c23d51e26bac9b088d7191eeb7c0ded81ec75` (CRM-01 publicado; SECURITY-RPC-AUDIT-01 = PASS)
**Migration nova:** `20260908120000_legal_privacy_data_lifecycle.sql` (local only)

## 1. Fonte de verdade — reconfirmação

`docs/audits/2026-09-02-final-client-audit.md` §1.3 já havia estabelecido, com evidência de grep e
inventário de arquivos: **o texto jurídico integral dos 5 documentos citados no WP (Política de
Privacidade v2, Política de Cookies v2, Termos de Uso Consumidor v2, Termos de Uso Parceiros v3, Termo
PromoPoints v1) não está versionado neste repositório.** Reconfirmado nesta auditoria — nenhum PDF, `.md`
ou `.txt` com esse conteúdo existe em `docs/`, `_promofy_handoff/` ou em qualquer outro diretório do
projeto.

Consequência operacional, por instrução explícita deste WP: **nenhum texto jurídico foi inventado**.
Tudo que envolveria escrever cláusula (o que a Política de Privacidade diz sobre uma categoria de dado
específica, o texto dos Termos do Parceiro, os valores definitivos do PromoPoints) permanece como
`PENDING LEGAL FINALIZATION` ou `CLIENT DECISION`, nunca como suposição. O que este WP implementou é
**mecânica**: a arquitetura de aceite/reaceite versionado, o ciclo de vida de encerramento de conta, a
transparência de cookies e os direitos operacionais do titular — peças que não dependem de saber o
conteúdo exato da cláusula, só de saber que ela existe e tem uma versão.

## 2. O que mudou desde a auditoria de 02/09

A auditoria de 02/09 é o baseline; dois WPs fecharam gaps que ela listava como `PENDENTE`:

| Item (Parte do audit 02/09) | Estado em 02/09 | Estado agora |
|---|---|---|
| Parte 6 — PAUSAR/REATIVAR cupom | PENDENTE | **FEITO** (CLIENT-CALL-CLOSURE-01, mig. `20260907120000`) |
| Parte 8/9 — CRM + isolamento de tenant | PENDENTE — FUTURO WP | **FEITO** (CRM-01, mig. `20260907130000`, auditado em SECURITY-RPC-AUDIT-01) |
| SECURITY DEFINER / grants (achado do Advisor durante CRM-01) | — | **PASS** (SECURITY-RPC-AUDIT-01, sem vulnerabilidade) |

Os demais gaps de 02/09 continuam com o mesmo status — este WP não tentou fechar Billing, PromoPoints
produto, Apps nativos nem Dashboard operacional.

## 3. Matriz de requisitos — LEGAL-PRIVACY-01

| REQUISITO | DOCUMENTO | QUEM SE APLICA | DADO/ATO | IMPLEMENTADO? | ONDE | GAP | DECISÃO NECESSÁRIA? |
|---|---|---|---|---|---|---|---|
| Aceite versionado no cadastro | Termos Consumidor v2 | Consumidor | `aceites_documento` | FEITO (já existia) | `handle_new_user`, mig. 38 | — | não |
| Aceite versionado de Privacidade | Privacidade v2 | Consumidor | `aceites_documento` | **FEITO (novo)** | gate `/m` layout + `registrarAceiteAction` | — | não |
| Aceite versionado de Termos Parceiro + Privacidade | Termos Parceiro v3 + Privacidade v2 | Parceiro | `aceites_documento` | **FEITO (novo)** | gate `/portal` layout | contas QA existentes (`lojista@`/`lojista2@`) verão o gate no próximo acesso — comportamento intencional (Fase 16), não bug | não |
| Reaceite centralizado (versão nova ≠ versão aceita) | genérico | Consumidor + Parceiro | `aceites_documento` × `documentos-legais.ts` | **FEITO (novo)** | `GateReaceite`, `buscarPendenciasLegais` | — | não |
| Aceite Termo PromoPoints | PromoPoints v1 | Consumidor | — | **NÃO implementado, deliberado** | `documentos-legais.ts` (fora de `DOCUMENTOS_REQUERIDOS_*`) | valores do Termo (100/50/200…) divergem de `config_pontos` runtime (50/30/100…) — já registrado como `DECISÃO DO CLIENTE NECESSÁRIA` no audit 02/09 Parte 20 | **sim — CLIENT DECISION** |
| 18+/emancipação | Termos Consumidor v2 | Consumidor | `profiles.nascimento` | Não implementado | — | gate de idade não tem regra a codificar sem resposta do cliente | **sim — CLIENT DECISION** (já registrado em 02/09) |
| Cadastro completo do parceiro (CNPJ, endereço, representante) | Termos Parceiro v3 | Parceiro | `estabelecimentos` | Não implementado | — | fora de escopo deste WP — é `PRODUCT-COMPLETE-WEB`, não Legal/Privacy | não (mas bloqueia Parte 4 do audit 02/09) |
| Banner de cookies (essenciais hoje, arquitetura pronta p/ opcional) | Cookies v2 | Todos | `localStorage` (preferência de UI, não consentimento jurídico) | **FEITO (novo)** | `CookieBanner`, `src/app/layout.tsx` | — | não |
| Consentimento granular de cookies opcionais | Cookies v2 | Todos | — | **N/A hoje** | — | zero cookie opcional existe (ver §5) — categoria falsa não foi criada | não |
| Consentimento de personalização (opt-in/out/revogação) | Privacidade v2 | Consumidor | `consentimentos_usuario` | FEITO (já existia, CR-02) | `preferencias-form.tsx` | — | não |
| Acesso/correção dos próprios dados | Privacidade v2 | Consumidor | `profiles` | FEITO (já existia) | `/m/perfil/dados` | — | não |
| Exportação/portabilidade | Privacidade v2 | Consumidor | vários | **FEITO (novo)** | `/m/perfil/privacidade/exportar` | — | não |
| Solicitar exclusão de conta | Privacidade v2 | Consumidor | `profiles.status` | **FEITO (novo)** | RPC `solicitar_encerramento_conta`, `/m/perfil/privacidade` | — | não |
| Solicitar exclusão de conta | Privacidade v2 | **Parceiro** | — | **Não implementado, deliberado** | `configuracoes` mostra contato manual | encerramento de conta de parceiro cascateia para clientes de terceiros — decisão de produto maior que este WP (ver §6) | **sim — CLIENT/PRODUCT DECISION** |
| Anonimização ≤30 dias, salvo retenção legal | Privacidade v2 | Consumidor | `profiles` | **Mecanismo FEITO**; automação de prazo **não** | RPC `concluir_anonimizacao_conta` (service_role) | disparo automático (cron/job) dentro da janela de 30 dias não foi conectado — ver §7 | **sim — CLIENT/OPS DECISION** (cadência, quem opera) |
| Retenção legal detalhada (quais tabelas, por quanto tempo) | Privacidade v2 | — | — | Não especificado no documento disponível | — | o único prazo que o WP forneceu é "30 dias"; nenhum outro prazo foi inventado | **sim — CLIENT DECISION** |
| Páginas legais públicas | todos os 5 | Público | rotas | **FEITO (novo, com conteúdo pendente)** | `/legal/[doc]`, `/legal` | texto integral ainda não publicado — rota mostra `PENDING LEGAL FINALIZATION` | **sim — texto vem do cliente** |
| Log/audit sem PII desnecessária | Privacidade v2 | Todos | logs/console | **Auditado — já limpo** | ver §8 | — | não |
| Geolocalização não persistida sem base | Privacidade v2 | Consumidor | device | **Auditado — já correto** | `localizacao-dispositivo.tsx` | — | não |
| Infra citada (GCP) vs runtime (Vercel+Supabase) | Privacidade v2 | — | — | Contradição documental preexistente (audit 02/09 Parte 30) | — | não é algo que o código resolve — é o texto do documento que precisa atualizar | **sim — CLIENT DECISION** (ajuste documental) |
| CNPJ ausente / `[DATA DE PUBLICAÇÃO]` | Termos Consumidor / todos | — | — | Contradição documental preexistente (audit 02/09 Partes 38-40) | — | idem — página `/legal/[doc]` já trata isso como `PENDING LEGAL FINALIZATION` em vez de inventar valor | **sim — CLIENT DECISION** |

## 4. Auditoria de aceites — Fase 2

`aceites_documento` (mig. `20260902140000`): `id, usuario_id, documento, versao, aceito_em` — **sem**
update/delete (grant só `select, insert`), RLS "dono lê/insere o próprio". Não tem coluna de IP nem
device — **decisão deliberada**: LGPD exige que o aceite seja **provável historicamente** (documento +
versão + timestamp + titular autenticado, o que a tabela já garante via `auth.uid()` na inserção), não
necessariamente IP/device. Adicionar essas colunas sem uma exigência documental específica seria coletar
dado além do necessário — o princípio de minimização que a própria Política promete. Se o texto final da
Política, quando publicado, exigir IP/device no aceite, é uma migration pequena e aditiva.

`handle_new_user` grava aceite automaticamente **só para `papel = 'consumidor'`** e **só o documento
`termos_consumidor`** — nunca gravou Privacidade nem, para parceiro, Termos Parceiro. É exatamente por
isso que o gate de reaceite (Fase 17) existe: sem ele, todo consumidor cadastrado antes deste WP e todo
parceiro (sempre, desde a fundação) ficariam permanentemente sem aceite de Privacidade/Termos Parceiro,
sem nenhum mecanismo para corrigir isso depois do cadastro.

## 5. Cookie audit — Fase 7

Busca por `document.cookie`, `cookies()` (uso de leitura/escrita direta, fora do wrapper `@supabase/ssr`),
`localStorage`, `sessionStorage`, Google Analytics/GTM, Meta/Facebook Pixel, Hotjar, Clarity, remarketing,
ads, tracking de terceiros: **zero** ocorrência de analytics/marketing/remarketing em todo `src/`.
`localStorage` é usado só para preferências de UI locais (ex.: dispensa do banner de cookies, adicionado
neste WP). `sessionStorage`: não usado. `document.cookie` direto: não usado — toda sessão passa por
`@supabase/ssr`.

| Cookie/storage | Classificação | Onde |
|---|---|---|
| `sb-<ref>-auth-token` (via `@supabase/ssr`) | ESSENTIAL | login/sessão, todas as rotas autenticadas |
| `promofy_cookie_banner_v1` (localStorage) | PREFERENCE (não jurídico) | dispensa do banner, cliente |
| — analytics | **inexistente** | — |
| — marketing/remarketing | **inexistente** | — |

Nenhuma categoria "ANALYTICS"/"MARKETING" foi criada na UI — criar checkbox para consentir algo que não
existe seria simular conformidade, não implementá-la (instrução explícita da Fase 8). `CookieBanner`
informa "usamos apenas cookies essenciais atualmente" e linka `/legal/cookies`.

## 6. Encerramento de conta — por que só consumidor

Fase 11 pede mapear `profiles`, `cupons_usuario`, `cupom_eventos`, `pontos_transacoes`, `favoritos`,
`avaliacoes`, `assinaturas`, aceites, consentimentos, CRM, audit. Mapeado:

- **PII própria só existe em `profiles`** (nome, cpf, telefone, nascimento, cidade) e em `auth.users`
  (email — gerenciado pelo GoTrue, fora do escopo de uma migration SQL comum; não tocado nesta
  implementação).
- Todas as outras tabelas listadas guardam **só FK para `profiles.id`**, sem PII redundante. Anonimizar
  `profiles` já remove a PII de toda a superfície — CRM incluído, porque `crm_clientes`/`crm_cliente_detalhe`
  leem `profiles.nome/telefone/nascimento` e `auth.users.email` em tempo real, nunca uma cópia
  desnormalizada.
- Nenhuma linha é apagada: `cupons_usuario`, `cupom_eventos`, `pontos_transacoes`, `favoritos`,
  `avaliacoes`, `aceites_documento` sobrevivem — histórico agregado do estabelecimento (contagens de
  resgate no CRM, funil de conversão do cupom) e trilha de auditoria continuam íntegros.
- `assinaturas` foi deixada de fora: billing real ainda não existe (Mercado Pago é `PENDENTE — FUTURO WP`
  desde 02/09 Parte 12); não há o que cancelar hoje.

**Conta de parceiro (estabelecimento) não tem esse fluxo.** Diferença material: encerrar a conta de um
consumidor afeta só os próprios dados; encerrar a de um parceiro afetaria o histórico de **todos os
clientes que resgataram cupons naquele estabelecimento** — decisão de produto (o que acontece com cupons
ativos, com o CRM de outros lojistas que nunca tiveram relação com aquele parceiro, com clientes que
ainda não usaram o cupom) que este WP não tem mandato para decidir sozinho. Registrado como **CLIENT/
PRODUCT DECISION**; o portal (`/portal/configuracoes`) já expõe honestamente que esse fluxo não é
self-service ainda, com contato direto.

## 7. Por que a anonimização não roda sozinha em 30 dias

O mecanismo (`concluir_anonimizacao_conta`, `service_role`-only) está pronto e testado — mas **quem/o quê
chama essa função, e quando**, é uma escolha operacional: `pg_cron` agendado, uma rota de admin
disparada manualmente, uma Vercel Cron Function batendo um endpoint autenticado por service key. Cada uma
tem trade-offs de observabilidade/alerta que este WP não tinha informação suficiente para escolher sem
adivinhar — e o próprio texto do WP pede "não inventar prazo legal", o que se estende a não inventar o
mecanismo de enforcement desse prazo sem contexto operacional (quem monitora, o que acontece se falhar).
Ficou registrado como follow-up: a peça que falta é só decidir o *como disparar*, não *o que fazer* quando
disparado — isso já está implementado e coberto por teste.

## 8. PII em logs — Fase 20

Grep de `console.log/error/warn/info/debug` com termos CPF/senha/token/authorization/cookie em `src/`:
**zero ocorrências**. Os únicos 4 call-sites de `console.error` no projeto são os error boundaries padrão
do Next (`src/app/{m,e,portal,admin}/error.tsx`), que logam o objeto `Error` de runtime do React — nunca
payload de formulário, nunca CPF/token diretamente. Pré-existente, não alterado, e seguro pelo padrão já
adotado (mensagens de erro genéricas em toda a aplicação, nunca eco do dado sensível).

## 9. Decisões que bloqueiam avanço para Legal/Privacy publication (client decisions reais)

Só o que **de fato** impede publicar o texto final ou ativar um comportamento — não é lista de "seria bom
ter":

1. **Valores do PromoPoints** (Termo v1 vs `config_pontos` runtime) — bloqueia publicar o Termo
   PromoPoints e ativar aceite obrigatório dele.
2. **Gate de 18+/emancipação** — bloqueia implementar a regra (dado já é coletado; falta a regra).
3. **Cadência de anonimização automática** (quem dispara `concluir_anonimizacao_conta` e quando) — bloqueia
   a garantia operacional do prazo de 30 dias (o mecanismo em si já cumpre o prazo se disparado a tempo).
4. **Encerramento de conta de parceiro** — decisão de produto sobre cascata para terceiros.
5. **Texto jurídico integral dos 5 documentos** — bloqueia sair de `PENDING LEGAL FINALIZATION` nas
   páginas `/legal/*`. Sem o PDF/texto final, qualquer coisa escrita aqui seria invenção.
6. **CNPJ, `[DATA DE PUBLICAÇÃO]`, infraestrutura citada (GCP→Vercel/Supabase)** — ajustes documentais que
   só o cliente/jurídico pode fechar no texto oficial.

Nenhuma dessas seis impediu a implementação técnica deste WP — cada uma foi contornada com arquitetura
que funciona hoje (mecanismo pronto, aceite não-forçado, página honesta sobre estar pendente) e que absorve
a decisão assim que ela chegar, sem precisar de nova migration para a maioria dos casos.
