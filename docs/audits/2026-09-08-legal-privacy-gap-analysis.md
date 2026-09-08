# LEGAL-PRIVACY-01 — gap analysis: aceites versionados, cookies, privacidade, data lifecycle

**Data:** 2026-09-08 (revisado em LEGAL-PRIVACY-01H, mesmo dia)
**Branch:** `feat/legal-privacy-data-lifecycle`
**Base:** `main` @ `ce5c23d51e26bac9b088d7191eeb7c0ded81ec75` (CRM-01 publicado; SECURITY-RPC-AUDIT-01 = PASS)
**Migration nova:** `20260908120000_legal_privacy_data_lifecycle.sql` (local only)

> **ADENDO 01H:** este documento foi escrito originalmente sob LEGAL-PRIVACY-01, quando os 5 arquivos
> jurídicos ainda não estavam no repositório. Uma auditoria externa ao retorno desse WP encontrou dois P0
> (gate exigindo aceite de documento sem texto integral; e-mail real sobrevivendo em `auth.users` após
> "anonimização") e, no mesmo momento, os arquivos-fonte do cliente foram colocados em
> `docs/legal/source/`. As seções abaixo marcadas **[01H]** foram corrigidas com base no texto real —
> ver `docs/audits/2026-09-08-legal-source-of-truth.md` para a leitura completa dos 5 documentos.

## 1. Fonte de verdade — reconfirmação **[01H: fonte agora disponível]**

`docs/audits/2026-09-02-final-client-audit.md` §1.3 havia estabelecido, com evidência de grep e
inventário de arquivos, que os PDFs/DOCX jurídicos não estavam versionados no repositório **naquele
momento**. Isso era verdade quando escrito e segue registrado aqui como histórico — mas **não é mais o
estado atual**. Os 5 arquivos-fonte (`docs/legal/source/*.docx`) foram incorporados ao repositório entre
LEGAL-PRIVACY-01 e este adendo (01H) e foram lidos **na íntegra**, extraídos verbatim (sem reescrever
nenhuma palavra) para `src/lib/legal-content/*.ts`. Toda cláusula citada nas seções abaixo vem desses
arquivos — nunca de memória do WP anterior ou de suposição.

Consequência operacional, ainda válida: **nenhum texto jurídico foi inventado ou corrigido**. Onde o
documento-fonte contradiz a si mesmo (CNPJ) ou o runtime (infra, código do cupom, cookies, PromoPoints),
a contradição foi **preservada e registrada** (§10), nunca resolvida por suposição do código. A única
peça que ainda falta nos 5 documentos é uma **data de publicação real** — todos trazem o placeholder
literal `[DATA DE PUBLICAÇÃO]` (ou, no caso do Termo PromoPoints, nenhuma data) — e é exatamente por isso
que nenhum dos 5 pode ser marcado `published` no novo modelo de status (§11).

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
| Aceite Termo PromoPoints | PromoPoints v1 | Consumidor | — | **NÃO implementado, deliberado** | `documentos-legais.ts` (`requiresAcceptance: false` + `status: draft`) | fonte confirma valores 100/50/200/50/5 (§10-G); `config_pontos` runtime é 50/30/100/—/10 — `DECISÃO DO CLIENTE NECESSÁRIA` (já em 02/09 Parte 20, reconfirmada com os números reais agora) | **sim — CLIENT DECISION** |
| 18+ ou legalmente emancipado **[01H: reclassificado]** | Termos Consumidor v2, §3: "cadastro é... restrito a pessoas físicas maiores de 18 anos ou legalmente emancipadas"; Termo PromoPoints §3.1 reitera 18+ | Consumidor | `profiles.nascimento` | **NÃO implementado — é REQUISITO do documento, não "decisão se existe"** | `profiles.nascimento` já coletado; nenhum gate de idade no cadastro | o próprio Termos de Uso já EXIGE a regra — não é uma decisão sobre SE deve existir; a decisão pendente é só COMO comprovar emancipação de um menor (ver linha abaixo) | não — a regra 18+ pura (sem emancipação) é implementável direto do que o documento já diz |
| Fluxo de comprovação de emancipação | Termos Consumidor v2 (cita "legalmente emancipadas" sem descrever como comprovar) | Consumidor | — | Não implementado, **corretamente não implementado sem definição** | — | o documento permite emancipado, mas não diz como a Promofy verifica isso (documento? declaração?); implementar um bloqueio definitivo para todo <18 sem esse fluxo baniria emancipados legítimos | **sim — CLIENT DECISION**: qual prova aceitar (documento de emancipação? autodeclaração? nenhuma verificação, só cláusula contratual?) |
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
| Páginas legais públicas com texto real **[01H]** | todos os 5 | Público | rotas | **FEITO** | `/legal/[doc]`, `/legal`, conteúdo de `src/lib/legal-content/*.ts` | nenhum — texto integral agora é exibido, verbatim; falta só a data de publicação (documento em si, não a página) | não — a página já reflete corretamente o estado "draft, sem data" |
| Gate de aceite só bloqueia documento PUBLISHED **[01H — corrige P0-1]** | genérico | Consumidor + Parceiro | `documentos-legais.ts` | **FEITO (novo)** | `DocumentoLegal.status`, `filtrarDocumentosRequeridos`, `documentoAceitavel` | hoje os 5 documentos reais são `draft` (placeholder de data) → nenhum gera aceite obrigatório agora; volta a valer assim que alguém marcar `published` com data real | não — mecanismo já reage corretamente à mudança de status, sem precisar de novo código |
| E-mail real não sobrevive à anonimização **[01H — corrige P0-2]** | Privacidade v2 §6 | Consumidor | `auth.users.email` | **FEITO (novo)** | `scripts/_anonimizacao.ts` (`concluirAnonimizacaoCompleta`), Admin API GoTrue | nenhum — CRM/export não recebiam PII de `profiles`, mas ainda liam `auth.users.email` real; corrigido pseudonimizando + banindo a conta via Admin API antes do scrub SQL | não — mecanismo testado ponta a ponta (ver Fase 8) |
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
  (email — gerenciado pelo GoTrue). **[01H]** Isso foi originalmente registrado como "fora do escopo de
  uma migration SQL comum; não tocado" — e essa frase era exatamente o P0-2 que a auditoria externa
  pegou: `auth.users.email` real sobrevivia intacto e CRM/`crm_cliente_detalhe` liam esse e-mail ao vivo.
  Corrigido: `scripts/_anonimizacao.ts` orquestra, em duas fases, (1) Admin API do GoTrue
  (`auth.admin.updateUserById`) trocando e-mail por pseudônimo (`anon-<uuid>@anon.invalid`), matando a
  senha e banindo a conta por ~10 anos, e só então (2) o RPC SQL que zera `profiles`. Ordem importa: se a
  fase 2 falhar, o pior estado é "credencial já morta, profiles ainda não zerado" — retomável; a ordem
  inversa deixaria uma janela pior (profiles limpo, e-mail real ainda logável).
- Todas as outras tabelas listadas guardam **só FK para `profiles.id`**, sem PII redundante. Anonimizar
  `profiles` + pseudonimizar `auth.users.email` já remove a PII de toda a superfície — CRM incluído,
  porque `crm_clientes`/`crm_cliente_detalhe` leem `profiles.nome/telefone/nascimento` e
  `auth.users.email` em tempo real, nunca uma cópia desnormalizada — nenhuma alteração foi necessária nas
  RPCs de CRM em si, o fix na fonte (`auth.users`) já cascateia. Provado em teste (Fase 8): fixture com
  resgate real → CRM mostra nome/e-mail reais → encerramento + anonimização completa → CRM mostra
  "Usuário anonimizado" / e-mail pseudônimo / sem telefone/nascimento, **mas o resgate continua contado**.
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

**Sessão/login depois do encerramento [01H]:** duas camadas independentes. (1) O layout de `/m` já
checava `profiles.status` a cada request de servidor (não a cada refresh de JWT) desde LEGAL-PRIVACY-01
— então mesmo uma sessão tecnicamente válida já era bloqueada funcionalmente assim que `status` deixava
de ser `ativo`. (2) Agora, além disso, a conclusão da anonimização bane a conta no GoTrue
(`ban_duration`) e troca a senha — a credencial antiga não loga mais em NENHUMA sessão nova (testado).
O que **não** existe é um "revogar toda sessão já emitida" imediato por user id na Admin API do
supabase-js (só há `admin.signOut(jwt)`, que exige o token da própria sessão, não um id de usuário) —
trocar a senha já invalida refresh tokens no GoTrue, e o access token remanescente expira sozinho no TTL
padrão (~1h). Combinado com a camada (1), a janela de exposição real de uma sessão tecnicamente ainda
válida é o menor dos dois: geralmente já zero (bloqueio funcional imediato), no pior caso limitada por um
TTL medido, não uma lacuna de design.

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

## 10. Contradições documento × runtime — registro completo **[01H, Fase 5]**

Nenhuma foi resolvida por suposição. Todas confirmadas lendo o `.docx` real.

| # | Contradição | Documento diz | Runtime é | Classificação |
|---|---|---|---|---|
| A | Formato do código do cupom | Termos Consumidor §5, Termos Parceiro §6: `PRM-XXXXXX` | `PRMF-XXXX-XXXX` (8 chars, alfabeto 32) — `codigo-cupom.ts` | **CONTRADIÇÃO DOCUMENTAL** — já registrada em 02/09 Parte 15 como decisão do cliente (qual formato vira o oficial); não alterado aqui |
| B | Cookies opcionais | Política de Cookies §2-3: Desempenho/Funcionalidade/Publicidade/Terceiros (Google Analytics, Meta Ads), painel de consentimento granular | Zero tracker opcional, zero painel granular (grep completo) | **CONTRADIÇÃO DOCUMENTAL** — Cookies fica `draft`; não implementamos tracker só para "bater" com o documento (Fase 10) |
| C | Infraestrutura | Privacidade §3: "Supabase, Google Cloud Platform" | Vercel + Supabase (README/CLAUDE.md) | **CONTRADIÇÃO DOCUMENTAL** — ajuste documental, não é algo que o código resolve |
| D | E-mails de contato | Todos os 5 documentos, sem exceção: `contato@usepromofy.com` / `privacidade@usepromofy.com` | LEGAL-PRIVACY-01 (WP anterior) tinha inventado `@promofy.com.br` na UI própria (footer, banner, telas de encerramento) por falta de fonte | **NÃO é contradição do cliente — era erro nosso.** Corrigido nesta rodada: todo `mailto:`/texto de contato no código passou a usar `EMAIL_CONTATO`/`EMAIL_PRIVACIDADE` de `documentos-legais.ts`, alinhados aos 5 documentos |
| E | CNPJ | Termos Consumidor: cabeçalho diz `68.003.330/0001-74`, tabela de identificação (§1) diz "A ser obtido no ato da abertura" — **contradição dentro do MESMO arquivo** | — | **CONTRADIÇÃO DOCUMENTAL INTERNA** — nem o próprio documento é consistente; não inventamos qual dos dois vale |
| F | `[DATA DE PUBLICAÇÃO]` | Placeholder literal em Privacidade, Cookies, Termos Consumidor, Termos Parceiro; PromoPoints não tem data nenhuma | — | é exatamente por isso que os 5 documentos são `status: "draft"` (§11) — nenhuma data foi inventada |
| G | Valores do PromoPoints | Termo v1 §4: consumo=**100**, avaliação=**50**, indicação=**200**, primeiro acesso=**50**, check-in=**5** | `config_pontos` seed: resgate=**50**, nps=**30**, indicacao=**100** (não creditada), primeiro acesso=inexistente, visita=**10** (não creditada) | **CONTRADIÇÃO DOCUMENTAL** — `DECISÃO DO CLIENTE NECESSÁRIA`, já em 02/09 Parte 20, agora com os números reais dos dois lados confirmados |
| H | Billing/planos | Termos Consumidor §4: planos R$9,90/19,90/29,90 anuais, PIX/cartão via Mercado Pago, arrependimento 7 dias | `public.planos` seed usa os MESMOS valores (R$9,90/19,90/29,90) — **sem contradição de preço**; billing real (cobrança, Mercado Pago, ciclo anual, bloqueio por falha de pagamento) ainda não existe (`PENDENTE — FUTURO WP` desde 02/09 Parte 12) | Preço: **sem contradição**. Motor de cobrança: `PENDENTE`, fora de escopo deste WP (é `BILLING-MP`) |

## 11. Modelo DRAFT/PUBLISHED **[01H, Fase 2/3]**

Cada `DocumentoLegal` (`src/lib/documentos-legais.ts`) ganhou `status: "draft" | "published"`,
`publishedAt`, `effectiveAt` e `requiresAcceptance`. Regra dura, aplicada em dois pontos independentes
(defesa em profundidade):

1. `filtrarDocumentosRequeridos` — só documento `published && requiresAcceptance` entra na lista que
   `buscarPendenciasLegais`/`GateReaceite` usam. Hoje essa lista é **vazia** para os dois papéis (todos os
   5 documentos são `draft`), então o gate não bloqueia ninguém.
2. `documentoAceitavel` — usado por `registrarAceiteAction`: mesmo que alguma UI tentasse registrar aceite
   de um documento `draft`, a Action recusa antes de tocar o banco.

Trocar um documento para `published` é edição deste arquivo TS com data real (vinda do cliente/jurídico)
— não precisa de migration nem deploy de schema. `DOC_COOKIES` e `DOC_PROMOPOINTS` têm
`requiresAcceptance: false` **mesmo que um dia virem `published`**, porque descrevem funcionalidade
(painel de cookies granular, motor de fraude do PromoPoints) que ainda não existe — gatear aceite antes
da funcionalidade existir seria fingir que o produto já faz o que o documento promete.

**Nota sobre `/m/cadastro`:** o checkbox de aceite no cadastro (`handle_new_user`, mecanismo anterior a
este WP) continua gravando aceite de `termos_consumidor` no signup, independente do status `draft/
published` — é um caminho de código separado do `GateReaceite` novo, e o P0-1 da auditoria externa era
especificamente sobre o gate forçar aceite de texto **inexistente**; hoje o texto existe (renderizado
verbatim), então o requisito "ninguém aceita texto que não existe" já está satisfeito também para o
cadastro. A pequena inconsistência remanescente — cadastro exige aceite de um documento ainda `draft`
enquanto o gate novo não exigiria — fica registrada aqui como observação, não como bug deste WP: mudar o
cadastro é tocar um fluxo fundamental testado por outras suítes (`test-client-returns-consumidor.ts`),
fora do que este WP foi pedido para alterar.

## 12. Decisões que bloqueiam avanço para Legal/Privacy publication (client decisions reais) **[01H, atualizado]**

1. **Data de publicação/vigência real dos 5 documentos** — é o único item que falta para poder marcar
   qualquer um `published` e ligar o gate de aceite de verdade. Sem isso, tudo fica `draft` por design.
2. **Valores do PromoPoints** (Termo v1: 100/50/200/50/5 vs `config_pontos` runtime: 50/30/100/—/10) —
   bloqueia publicar o Termo PromoPoints com `requiresAcceptance: true`.
3. **Fluxo de comprovação de emancipação** (a regra 18+ pura já é requisito claro do documento; o que
   falta é só como aceitar/comprovar um menor legalmente emancipado).
4. **Cadência de anonimização automática** (quem/o que dispara `concluir_anonimizacao_conta`
   /`concluirAnonimizacaoCompleta` dentro da janela de 30 dias) — o mecanismo já cumpre o prazo se
   disparado a tempo; falta só o "quando/como" operacional.
5. **Encerramento de conta de parceiro** — decisão de produto sobre cascata para clientes de terceiros.
6. **Ajustes documentais** (CNPJ contraditório dentro do próprio Termos Consumidor; infraestrutura citada
   GCP→Vercel/Supabase; Política de Cookies descrevendo trackers que não existem) — só o cliente/jurídico
   fecha isso no texto oficial; o código já reflete o runtime real em vez de fingir alinhamento.

Nenhuma dessas seis impediu a implementação técnica deste WP — cada uma foi contornada com arquitetura
que funciona hoje (mecanismo pronto, aceite não-forçado para draft, página com texto real + aviso de
revisão) e que absorve a decisão assim que ela chegar, sem precisar de nova migration na maioria dos
casos.
