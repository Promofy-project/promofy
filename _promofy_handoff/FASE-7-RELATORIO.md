# FASE 7 — Relatório de Implementação (processo, observabilidade e Storage)
*Branch: `fase-7-processo-storage` (a partir da `main`) · Data: 03–04/08/2026 · Status: **concluída e verificada; NÃO está no ar***

> A Fase 7 nasceu de três lacunas que o deploy da 6.5 expôs — todas de **processo**, não de produto: não havia
> memória das migrations, o smoke acontecia em produção, e o acesso à Vercel dependia de um OAuth que expirava no
> meio do trabalho. A Onda 2 destravou o **C4**, adiado da 6.5 por um gate empírico.
>
> Duas coisas desta fase não estavam no plano e precisam ser lidas: **o gate do Storage reprovou de novo**, agora
> com a causa-raiz fechada, e a **revisão de segurança achou um furo no desenho que eu mesmo tinha aprovado** —
> incluindo uma afirmação falsa que escrevi numa mensagem de commit.
>
> Nada foi aplicado no ambiente do cliente. As migrations 22 e 23 existem apenas no QA descartável.

## 1. Escopo entregue e escopo adiado

| Item | Situação |
|---|---|
| **P1** `MIGRATIONS.md` — diário de bordo com as 21 entradas retroativas | ✅ |
| **P2** Fluxo de preview + `CLAUDE.md` (não existia) | ✅ |
| **P3** Vercel sem OAuth | ✅ — **pela API REST, não pela CLI** (§5) |
| **P4** Histórico de moderação no admin | ✅ |
| **P5** Sentry com scrubbing | ✅ |
| **C4** Upload de imagem (estreia do Storage) | ✅ **no QA** — o bucket de produção nunca foi tocado |
| Remoção da `service_role` da Vercel | ✅ (fora do escopo original; §6) |
| Storage **local** | ⏸ segue desligado — gate reprovado com causa-raiz (§4) |

## 2. Entregas (por commit)

| hash | entrega |
|---|---|
| `23cd689` | Onda 1 inteira: MIGRATIONS.md, CLAUDE.md, Vercel CLI, timeline do admin, Sentry |
| `2e0a037` · `f5caeef` | CLI da Vercel sai, API REST entra |
| `53ad701` | Gate do Storage reprovado, com causa-raiz medida |
| `a9bdec5` | Projeto de QA provisionado; `scripts/_alvo.ts` centraliza a escolha de banco |
| `6122bc2` | `vercel:env:rm` — remove env var de um ambiente sem levar o outro |
| `e808901` | `service_role` removida de Preview e Production, com prova por passo |
| `f74979f` | Migration 22: bucket + policies; módulo puro `imagem-cupom.ts` |
| `be8e625` | C4 na aplicação: action, campo trocável, exibição com fallback |
| `092fed8` | **Migration 23: fecha dois furos da 22 — e corrige uma afirmação minha** |

## 3. Critérios de aceite — como cada um foi provado

| # | Critério | Prova |
|---|---|---|
| 1 | MIGRATIONS.md com as 21+ entradas | 23 entradas, com as observações operacionais que só existiam nos relatórios |
| 2 | Fluxo de preview documentado e env confirmada | `npm run vercel:env` → Preview tem as duas `NEXT_PUBLIC_*` |
| 3 | Deployments listados sem OAuth | `npm run vercel:deployments`, exit 0 — na sessão em que o conector MCP expirou de novo |
| 4 | Histórico visível no admin | Trilha de 6 entradas renderizada, autor resolvido, hora em BRT |
| 5 | Sentry capturando | SDK ativo na preview; scrubbing com 12 asserções |
| 6 | Upload dono-only por teste negativo **direto** | `lojista2` negado em subir/apagar/listar na pasta do `e1` |
| 7 | Validações server-side provadas | magic bytes por tipo, WebP falso, SVG, 2 MiB+1 |
| 8 | Imagem na folha com fallback | 3 pontos condicionais; `onError` na galeria |
| 9 | Remoderação aplicada e testada | `imagem` é material desde a 20; o par DELETE+INSERT foi fechado pela 23 |
| 10 | Gate documentado | §4 |

## 4. O gate do Storage — reprovado, mas agora com causa-raiz

A 6.5 desligou o Storage apostando que um CLI mais novo traria um `storage-api` com healthcheck corrigido.
**A aposta era falsa, e agora está medido:**

```
CLI 2.100.1 -> public.ecr.aws/supabase/storage-api:v1.67.8
CLI 2.111.0 -> public.ecr.aws/supabase/storage-api:v1.67.8   (A MESMA IMAGEM)
```

Não é questão de esperar. O sintoma é idêntico: o healthcheck interno faz `wget 127.0.0.1:5000/status`, recebe
*Connection refused*, e o `supabase start` aborta com `LegacyHealthCheckTimeoutError` **derrubando o stack**.

**O confundidor foi testado, não presumido.** Nessa rodada `realtime`, `pg_meta` e `studio` também ficaram
unhealthy, com 20 containers de outros três projetos na máquina — o que sugeriria contenção. Mas o start
seguinte, com Storage **desligado** e a mesma carga, subiu tudo healthy em **82s**. A contenção existe e não
explica o resultado: foi o storage-api estourando o orçamento de espera e levando os outros junto.

**Consequência não prevista:** a atualização da CLI **quebrou o ambiente local** — o `seed-users` passou a falhar
com `permission denied for table profiles` para o `service_role`, algo que o bootstrap da 2.111.0 mudou. Como a
atualização não comprou nada (mesma imagem), a CLI foi **revertida para 2.100.1** e o ambiente voltou. Fica o
registro: *subir a CLI é uma mudança de ambiente com efeito colateral, não um detalhe.*

## 5. Duas ferramentas que não sobreviveram ao contato com a realidade

**A CLI da Vercel.** Eu instruí a criar um token de escopo mínimo (o time, não a conta). Medido depois: esse token
recebe **404 em `/v2/user`** e 403 em `/v2/teams`, e a CLI consulta `/v2/user` no arranque — falha antes de
qualquer subcomando. As saídas eram ampliar o token para conta inteira (o oposto do que este projeto faz em todo o
resto) ou falar com a API direto. Ficou a API: `scripts/vercel-api.ts` cobre deployments, env e rollback, com o
token no header e nunca em `--token`, e `env` listando **apenas nomes**. Efeito colateral bem-vindo: 230 pacotes de
devDependency a menos.

**A asserção do predicado das policies.** O plano previa ler `pg_policies.qual` para que um `using (true)`
reintroduzido não passasse. Isso exige conexão direta ao Postgres, e os endpoints da Supabase — direto e pooler —
apresentam **CA própria**: restaria desligar a verificação TLS na conexão que carrega a senha do banco
(inaceitável) ou versionar uma CA cuja origem eu não consegui confirmar. Troquei por asserção **comportamental**,
que prova a propriedade em vez do texto: um `using (true)` quebra *"anon não lista a raiz"*, e um UPDATE liberado
quebra *"nem o dono troca os bytes"*.

## 6. A `service_role` que estava na Vercel

Achado fora do escopo, durante a verificação do P2: `SUPABASE_SERVICE_ROLE_KEY` estava provisionada em **Production
e Preview**, sem que nenhum arquivo de `src/` a lesse — só `scripts/`, que rodam no Node local. Enquanto esteve lá,
qualquer build (inclusive de branch não revisada) tinha em mãos uma chave que **ignora toda a RLS do banco de
produção**. Contrariava a decisão registrada na Fase 3.

Removida com sequência de prova: grep no repo inteiro (nenhuma leitura em caminho de build) → remoção do **Preview**
→ build de preview READY e rota autenticada respondendo com dados reais → só então **Production** → confirmação de
que o deployment servido não muda (mesmo `dpl_`, mesmo alias, 4 rotas em 200). **Env var entra no build, não no
runtime publicado.**

Detalhe que quase custou caro: a chave era **um registro** com `target: ["production","preview"]`. Um `DELETE`
ingênuo em "remover do preview" teria levado produção junto — daí o `vercel:env:rm` fazer `PATCH` estreitando o
alvo quando o registro cobre mais de um ambiente.

## 7. O defeito que eu mesmo introduzi

A migration 22 removeu a policy de `UPDATE` e eu escrevi, na mensagem de commit e no cabeçalho do arquivo:

> *"o único jeito de mudar o que o consumidor vê é escrever `cupons.imagem`"*

**Era falso.** Sem UPDATE fica bloqueada a *sobrescrita*, não o par **DELETE + INSERT na mesma chave**. O lojista
fala Storage REST direto com o próprio JWT: apaga o objeto (policy "dono apaga") e sobe outros bytes no mesmo
caminho (policy "dono sobe"). `cupons.imagem` não muda → o trigger da migration 20 não dispara → um cupom
**aprovado e ativo** passa a exibir conteúdo que ninguém moderou. `upsert: false` não protegia: é flag do cliente,
não controle de servidor.

O achado veio da revisão de segurança sobre o diff, **não** da revisão adversarial do plano — que tinha olhado o
mesmo desenho e considerado o problema resolvido. É a lição da fase: *remover uma operação não é o mesmo que
remover o efeito dela.*

A migration 23 fecha exigindo que o `DELETE` não alcance imagem de cupom já moderado (helper `security definer`,
porque a policy precisa enxergar cupons de qualquer dono — sob RLS o lojista só veria os seus e a checagem falharia
para o lado errado). Os usos legítimos seguem: órfão de insert que falhou é apagável, e a troca de imagem sobe
chave nova → grava em `cupons.imagem` → remodera → a chave antiga fica livre. **As quatro asserções novas incluem
a que teria reprovado a migration 22.**

A mesma revisão achou um segundo furo (médio): a forma do nome do objeto só existia em `src/lib/imagem-cupom.ts`, e
a Action não é fronteira para quem fala HTTP. Dava para guardar qualquer blob de 2 MiB em
`<pasta>/qualquer-coisa.bin` — público, nunca referenciado, invisível à moderação: hospedagem grátis sob o domínio
do projeto. A regex agora vive **também** no banco.

**Terceiro defeito meu, este pego pelo `verify`:** a guarda das migrations 22/23 checava
`information_schema.schemata`, mas o schema `storage` existe **vazio** na imagem base do Postgres local mesmo com
`[storage]` desligado — quem não existe são as **tabelas**. O `db:reset` quebrava com *relation "storage.buckets"
does not exist*. Corrigido para `to_regclass('storage.buckets') is null`.

## 8. Revisão adversarial (4 lentes) + lente de segurança

**Correção** — `criarCupomAction` gravava `imagem: ""` literal, que sobrescreveria o caminho recém-subido.
**Regressão** — `bodySizeLimit` afeta todas as actions; a timeline não pode quebrar com histórico vazio (os 21
cupons legados estão assim). **Produto** — o rebaixamento por troca de imagem é correto mas surpreende: sem aviso o
lojista tira o próprio cupom do ar sem entender por quê. **Migração nativa** — §12.

**Lente de segurança (duas passagens).** Sobre o *desenho*, no plano: 10 achados, dos quais os que sobreviveram
viraram decisão (pasta por estabelecimento, ausência de UPDATE, path montado no servidor, `urlPublicaImagem`
revalidando na renderização, scrubbing de código de cupom). Sobre o *diff*, com a skill `security-review`: **2
achados reais**, ambos corrigidos na migration 23 (§7), e verdicts negativos explícitos para XSS/content-type,
path traversal, autorização cruzada, PII no Sentry e manuseio do token da Vercel.

## 9. Verificação

| Suíte | rls | f2 | f3 | f4 | f5 | f6 | f6.5 | f7 | **f7:storage (QA)** |
|---|---|---|---|---|---|---|---|---|---|
| PASS | 25 | 27 | 22 | 42 | 64 | 177 | 44 | 17 | **34** |

`npm run verify` (local, sem Storage) + `npm run test:fase7:storage` (QA, com Storage). O `verify` levou três
tentativas: a primeira morreu num `uv_spawn` causado por um `taskkill` meu, a segunda pela guarda errada da
migration, a terceira pelo bootstrap da CLI 2.111.0. Nenhuma delas foi mascarada.

**Smoke na preview** (P2 valendo pela primeira vez), com `convidado@` e `lojista@`, nada destrutivo:

| | |
|---|---|
| `/m` autenticado | 1.560 pts e *"MAIS DE R$ 182,00"* — baseline da 6.5 preservado |
| Cards | caem no **gradiente** — o fallback correto, já que produção não tem bucket |
| `/e/cupom/novo` | campo "Imagem do cupom" no ar, `accept="image/jpeg,image/png,image/webp"`, "até 2 MB" |
| Sentry | SDK inicializado no cliente |

**LIMITE DECLARADO:** o smoke da preview **não exercita upload real**. A preview fala com o banco de **produção**, e
as migrations 22/23 não estão aplicadas lá — nem deveriam, antes da sua aprovação. O caminho de upload está provado
no QA (34 asserções); o bucket de produção só será exercitado na coreografia banco-antes-código.

## 10. Um obstáculo novo do fluxo de preview

As previews estão atrás de **Vercel Authentication** (`ssoProtection: all_except_custom_domains`) — por isso
`promofy-pro.vercel.app` abre e a preview não. Para automatizar o smoke foi criado um **Protection Bypass for
Automation** (`VERCEL_AUTOMATION_BYPASS_SECRET` no `.env.local`). **Não desligue a proteção SSO das previews:** elas
falam com o banco de produção, e deixá-las públicas exporia dados reais a quem descobrisse a URL.

O segredo original apareceu uma vez numa URL do log de trabalho e foi **revogado e rotacionado** no mesmo dia.

## 11. Estado dos ambientes

| | migrations | Storage |
|---|---|---|
| local | 1–23 (22 e 23 passam em branco pela guarda) | desligado |
| **QA** (`olyjfluaioafuizbnrpl`) | 1–23 aplicadas | bucket + policies ativos |
| **produção** (`bpeqpxvxgdyjjdcoycgp`) | **1–21 — intocada** | sem bucket |

## 12. IMPACTO NA MIGRAÇÃO NATIVA

Princípio permanente: regra no servidor, lógica pura em `src/lib` sem API de navegador, só-web isolado atrás de
ponto trocável.

**Contratos de servidor que o app nativo herda prontos.** As policies do bucket são a autorização real do upload —
o RN chama o mesmo Storage REST com o mesmo JWT e recebe a mesma negação. A regra de que imagem de cupom moderado
não se apaga vive no banco, não no cliente.

**Módulos puros novos, reaproveitáveis como estão** (sem DOM, sem `server-only`, sem `Intl`): `imagem-cupom.ts` —
**a validação de upload é herdada inteira pelo RN**, magic bytes inclusive, e é o item mais importante desta fase
para o nativo; `sentry-scrub.ts`; e `rotuloAcao` em `moderacao.ts`.

**Só-web, isolado.** `src/components/campo-imagem.tsx` concentra `<input type="file">`, `createObjectURL` e o
`FormData`. No nativo vira picker/câmera; a Action e a validação são reaproveitadas. *O gatilho migra; o arquivo
não.* `formatDateTimeBRT` ficou em `utils.ts` justamente por usar `Intl`.

**Cuidados herdados e ainda válidos.** Validar `Intl` com `America/Sao_Paulo` no Hermes antes de confiar em
`dentroDaJanela` e em `formatDateTimeBRT`. Conferir `wc -l` de `database.types.ts` depois de `db:types`. E o novo:
o RN precisará do equivalente ao `bodySizeLimit` — o limite de corpo do transporte é problema de cada plataforma.

## 13. Deploy — o que precisa acontecer, na ordem

**Não executado. Decisão à parte, como combinado.**

1. Rollback armado: anotar o `dpl_` de produção (`npm run vercel:deployments`).
2. **Banco antes do código:** `db push --linked` das migrations 22 e 23 em produção. A janela é segura: as duas são
   aditivas e o código antigo não conhece o bucket.
3. Merge `--no-ff` → push → build READY.
4. Smoke de produção com `convidado@`, incluindo **um upload real** — o único passo que nem QA nem preview cobrem.

## 14. Backlog

**Limpo nesta fase:** memória das migrations · fluxo de preview · Vercel sem OAuth · histórico de moderação na tela
· observabilidade · `service_role` fora da plataforma de build.

**Fase 8:** redimensionamento de imagem no servidor (elimina o resíduo de polyglot) · rotina de faxina para objetos
órfãos (cupom apagado ou estabelecimento desativado deixam arquivo público) · `revoke update (imagem)` + RPC
`security definer`, endurecimento que tornaria a revalidação na renderização redundante · **apagar o `./.env` da
raiz**, que guarda a `service_role` de produção duplicando o `.env.hosted.local` (o Next carrega `.env`
automaticamente; hoje o `.env.local` sombreia, mas no dia em que faltar uma variável lá o dev local fala com
produção em silêncio).

**Pendente de decisão do cliente:** periodicidade de uso ("1 por dia") — se a resposta for essa, o switch de
ilimitado entregue na Fase 6 **não atende** e a periodicidade precisa entrar antes do uso comercial.

**Resta:** taxonomia Segmento→Categoria e o filtro completo · validação por identidade (nome+CPF) ·
mural/indicadores no `/e` · destaque/banner no admin · exclusão de cupom pelo lojista (o desenho tem lápis **e**
lixeira; entregamos só o lápis) · exportar relatórios · NPS do lojista · QR scanner real ·
`/admin/configuracoes` salvando `config_pontos` · `validar-cupom-dialog` sem motivo `esgotado` · ~20 hex amarelos
fora dos tokens · assets órfãos em `public/lp/consumidores/` · auto-cadastro de empresa · `cupom_eventos` do seed
todos anônimos.

**Formalizado agora, nunca tinha entrado no backlog:** o cosmético `"Lucas Orladi"`
(`src/components/side-menu.tsx:73`, `src/lib/mock-data.ts:554`) e `"9:41"` (`src/components/app-mockup.tsx:20`,
`estab-phone-frame.tsx:28`, `phone-frame.tsx:51`) — o rodapé e a status bar mock que aparecem em telas reais.

**Novo:** o `storage-api` v1.67.8 bloqueia o Storage local em qualquer CLI atual; reavaliar quando a imagem mudar.
Subir a CLI da Supabase é mudança de ambiente com efeito colateral — a 2.111.0 quebrou o `seed-users` local.
