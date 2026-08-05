# FASE 8 — Relatório de Implementação (lado do estabelecimento)
*Branch: `fase-8-lado-estabelecimento` (a partir da `main`) · Data: 04–05/08/2026 · Status: **concluída e verificada; NÃO está no ar***

> Três promessas da call de 22/07, todas do lado do lojista, todas sem uma linha de código até aqui: ele **recebe**
> comunicação, **vê** o próprio NPS, e **atende** quem chegou sem o celular.
>
> Três coisas precisam ser lidas antes do resto. A fase começou com uma **Onda 0 não planejada** — a Fase 7 nunca
> tinha sido fechada, e havia uma imagem de teste minha viva na vitrine do cliente. O achado mais grave da Onda 2
> foi um **defeito que eu introduzi ao corrigir outro**: ao parar de devolver o código da ativação, troquei uma
> credencial de 2⁴⁰ por um inteiro sequencial e deixei o caminho de confirmação sem credencial nenhuma. E o smoke
> tropeçou num **vazamento de senha para a query string** (§11) que não é desta fase, é pré-existente, e **está em
> produção agora**.
>
> Nada foi aplicado no ambiente do cliente. As migrations 24–27 existem apenas no local.

## 1. Escopo entregue

| Item | Situação |
|---|---|
| **Onda 0** — fechar a Fase 7 (vitrine, regressão, relatório) | ✅ |
| **M1** Mural: migration 24, `/e/mural` com badge, `/admin/avisos` real, `/portal/mural` | ✅ |
| **M2** Indicadores: migration 25, `/e/indicadores`, NPS real no portal | ✅ |
| **E1** Cosmético do `/m` | ✅ |
| **V1–V3** Validação por identidade: migrations 26 e 27, `/e/validar` | ✅ |
| Depoimentos fictícios do `/portal/avaliacoes` | ✅ removidos (decisão do checkpoint) |
| Smoke na preview | ✅ sem regressão — mas ver §10: o schema lá é o da Fase 7 |
| **Vazamento de senha na URL** (§11) — achado no smoke, corrigido nos 5 formulários | ✅ com prova sem-JS |
| **Dashboard `/portal`** (§12) — números e depoimentos inventados | ✅ ligado ao que é real |
| Deploy | ⛔ **não executado, por instrução** |

## 2. Entregas (por commit)

| hash | entrega |
|---|---|
| `56f2495` | **Onda 0** — Fase 7 fechada: vitrine limpa, regressão 14/14 em produção, dívida do Sentry registrada |
| `652ff78` | M1 banco — migration 24 (mural, RLS, 2 RPCs) |
| `d50ecdc` | M1 UI — `/e/mural` com badge e `/admin/avisos` publicando |
| `a7b5f95` | M1 portal + M2 + E1 |
| `a7518bd` | **Onda 2** — CPF (migrations 26 e 27) + as sete correções da revisão de segurança |

## 3. A Onda 0 que não estava no plano

O prompt da Fase 8 dizia "Fases 1–7 no ar". Estava certo quanto ao código, e errado quanto ao fechamento: o
encerramento da Fase 7 fora interrompido e nunca rodara. Medido no início:

- **A imagem PNG de teste do smoke estava viva na vitrine** — `"Sobremesa grátis no jantar"` ativo com um retângulo
  de gradiente, o **único** cupom com imagem que o cliente via.
- O relatório da Fase 7 afirmava *"Deploy — não executado"* com as migrations já em produção, e dava o P5 como
  entregue com o Sentry nunca tendo capturado nada.
- Os itens (e) e (f) do smoke nunca tinham rodado.

Fechado antes de escrever qualquer código da Fase 8. Dois detalhes que valem para a próxima limpeza: a remoção da
imagem por `service_role` **não** rebaixou o cupom (pela UI do lojista ele teria ido para `pendente` e sumido do
ar — o oposto do desejado), e o `DELETE` do objeto voltou sucesso com a leitura pública ainda em 200 — era
**cache**; com cache-buster dá 400.

## 4. Mural — o que a tela fingia ser

O `/admin/avisos` existia desde a Fase 3 e era **100% mock**: dois literais em `useState`, "Enviar aviso" só fazia
`setAvisos(...)`, recarregar zerava. Não havia tabela nenhuma. O lojista nunca recebera um recado.

**Mudança de produto assumida:** os destinos eram **categorias** (`todos | CategoriaId`), o que nunca teve
contraparte no banco. O mural entrega por **estabelecimento** — que é quem tem dono, sessão e caixa de entrada.
Categoria não recebe recado.

Duas armadilhas do `/e` que a exploração achou antes de custarem depuração:

1. `NAV_ROUTES` em `estab-phone-frame.tsx` faz **match exato**. Sem `/e/mural` na lista, a aba **sumiria justamente
   ao ser aberta**.
2. O badge **não pode** ser calculado no layout: layout não re-renderiza ao navegar e o número ficaria congelado a
   sessão inteira — lição que a Fase 4 já pagou (o comentário está em `src/app/m/page.tsx`). Como no `/e` a nav
   mora no layout, a recontagem é client, disparada pelo `pathname`. Sem realtime nesta fase, por decisão.

## 5. Indicadores — e um número inventado a menos

O NPS é coletado desde a Fase 2 e **nunca foi agregado**. O `/portal/avaliacoes` exibia *"NPS médio recebido:
8,7"* — string hardcoded desde a Fase 3.

Três decisões do desenho: `security definer` é **obrigatório** (a RLS de `cupons_usuario` mostra ao *consumidor* as
linhas dele; sob invoker o lojista veria zero e o NPS seria sempre nulo, então a checagem de posse dentro da função
é a única barreira); o retorno **omite `usuario_id`** de propósito, porque com ele o lojista cruzaria notas entre
cupons e reconstruiria o histórico de uma pessoa; e **`tem_dados` vem do servidor**, porque zero respostas não é
score 0 — derivar isso na tela seria repetir o erro do selo "utilizado" da Fase 6.

No checkpoint ficou decidido remover também os **depoimentos fictícios** do portal: número real ao lado de
depoimento inventado contamina a credibilidade do real. A tela passou a mostrar o que existe e a dizer, sem
rodeios, o que ainda não existe.

## 6. Validação por identidade — o item sensível

Quatro barreiras, nesta ordem: **DV** antes de tocar dado (~99% das sequências morrem sem consulta); **rate limit**
contado no banco (serverless não tem memória compartilhada, então contador em processo seria contador por
instância); **resposta única**; e **posse**.

A **resposta única** é o centro do desenho. CPF inexistente, CPF de cliente de outro estabelecimento e CPF sem
ativação viva devolvem o **mesmo objeto** — a suíte compara os três byte a byte. Distinguir qualquer um deles
transformaria a RPC num oráculo que revela quem é cliente de quem.

A auditoria guarda **HMAC com pepper**, nunca o CPF: `sha256(cpf)` não anonimiza coisa alguma, porque existem ~10⁹
CPFs válidos e a tabela arco-íris de todos cabe num notebook.

**Consequência de teste que quase passou batido:** `cpfQa()` gerava CPFs de 11 dígitos **sem DV válido** — bastava
para `mascarar_cpf`, que só olha comprimento. Com o DV virando barreira, a conta `qa-*` não conseguiria testar o
caminho feliz. Corrigido para gerar CPF determinístico **e** DV-válido.

## 7. O defeito que eu introduzi ao corrigir outro

No plano, eu argumentei — e o dono aceitou — que devolver o **código da ativação** na busca era um passo atrás: o
código é credencial ao portador, é justamente o que o consumidor não tem nesse fluxo, e ecoá-lo cria mais um
caminho por onde ele vaza. Troquei por `cupons_usuario.id`.

**O raciocínio estava certo e a execução ficou pela metade.** `cupons_usuario.id` é um `bigserial` pequeno e denso,
e eu deixei `validar_cupom_por_ativacao` aceitando **apenas** esse id: sem CPF, sem rate limit, sem auditoria. Um
lojista percorrendo ids de 1 a N queimaria os cupons dos **próprios clientes**, de forma **permanente** — a unique
`(usuario_id, cupom_id)` impede reativar — com pontos creditados por visitas que nunca houve, e sem deixar rastro.
Troquei uma credencial de 2⁴⁰ por um inteiro adivinhável.

Uma ressalva contra mim mesmo, para o "2⁴⁰" não soar melhor do que é: o alfabeto tem de fato 32 caracteres em 8
posições, mas `gerar_codigo_cupom` usa `random()` do Postgres, que **não é criptográfico**. É de Fase 1 e está fora
deste diff — vai para o backlog, não vira crédito desta fase.

A revisão de segurança dedicada pegou. O confirm passou a **exigir o CPF**: a posse do documento volta a ser a
credencial, exatamente como na busca.

## 8. Revisão adversarial (4 lentes) + revisão de segurança dedicada

**Correção** — `mascarar_cpf` não é concedida a `authenticated` (só funciona dentro de definer, que é onde é usada).
**Regressão** — `NAV_ROUTES`, badge no layout, `cpfQa` sem DV: as três achadas antes de virarem bug.
**Produto** — "discreta" era requisito do cliente: a opção por CPF é um link fino, não compete com o código.
**Migração nativa** — §11.

**Revisão de segurança (skill `security-review`, sobre o diff): 8 achados, 7 procedem e foram corrigidos** na
migration 27.

| # | Achado | Correção |
|---|---|---|
| 1 · ALTO | confirm sem credencial (§7) | exige o CPF |
| 2 · MÉDIO | **TOCTOU no rate limit**: `count` e `insert` separados pela consulta inteira em READ COMMITTED — chamadas paralelas passavam juntas, e o teto virava "20 × concorrência" | `pg_advisory_xact_lock` por dono |
| 3 · MÉDIO | **pepper saía no `pg_dump`**: `supabase db dump -f supabase/seed.sql` é caminho documentado e `seed.sql` é versionado — o pepper de produção iria para o git junto com a tabela que ele protege | migrado para o **Vault** |
| 4 · BAIXO | auditoria em `public`, alcançável por `service_role` | movida para `private` |
| 5 · BAIXO | o confirm **ecoava o código**, desfazendo no fim a recusa da busca | removido do retorno |
| 6 · BAIXO | bloqueado e DV-inválido não eram auditados: a tabela não mostrava a **magnitude** de um ataque | registrados, sem contar na janela |
| 7 · BAIXO | `profiles.cpf` sem índice | índice de expressão |
| 8 · BAIXO | `limit 1` sem `order by` para dono de vários estabelecimentos | passa a considerar todos |

O achado 2 importa mais do que a severidade sugere: o argumento de que o **canal de tempo** é inexplorável depende
justamente de o teto valer. Com o TOCTOU aberto, a taxa de amostragem subia 3–10×.

**Verdicts negativos que valem registro:** o conteúdo das três respostas é comprovadamente idêntico (uma única
construção do objeto, sem `null` vs `[]`); o `private` não está em `[api].schemas`, então nem `service_role`
alcança o pepper por PostgREST; e o rate limit resiste a sessão nova, a segundo dono (impossível: `owner_id` está
fora do grant por coluna) e não respinga em outro estabelecimento.

## 9. Verificação

| Suíte | rls | f2 | f3 | f4 | f5 | f6 | f6.5 | f7 | **f8** |
|---|---|---|---|---|---|---|---|---|---|
| PASS | 25 | 27 | 22 | 42 | 64 | 177 | 44 | **29** | **53** |

**483 PASS, 0 FAIL** + build. A `f7` subiu de 17 para 29: as 12 asserções novas cobrem o scrubbing de senha
(§14) — moram lá porque é a suíte do Sentry, não porque sejam da Fase 7.

Uma asserção **não roda fora do alvo local** e isso é dito em vez de virar verde falso: "destrava quando a janela
esvazia" exige envelhecer as linhas da auditoria, que vive em `private` e — por desenho — não é alcançável por
PostgREST. Localmente é feito por `psql`; no hospedado a suíte imprime que não executou.

## 10. Smoke na preview — e o que ele *não* pode provar

Preview `dpl_3z6X…` (commit `afb14be`), contas `convidado@`, `lojista@` e `admin@`. **Baseline de produção medido
antes e depois, idêntico** — `consumidor@` 1410 pts / 3 ativações / 14 eventos, `convidado@` 1640 / 11 / 40. Nenhuma
escrita: nenhum cupom validado, nenhum aviso publicado.

**Leia isto antes do placar:** a preview aponta para o banco de **produção**, que tem as migrations **1–23**. Ou seja,
ela roda **código da Fase 8 contra o schema da Fase 7**. Nenhuma funcionalidade desta fase pôde ser exercitada de
verdade aqui — o caminho feliz de todas elas foi provado **apenas no local**, pelas 53 asserções da `test:fase8`.
O que a preview prova é outra coisa, e vale por si: **não houve regressão**, e **o código novo não quebra sobre o
schema velho**.

| Item | Resultado |
|---|---|
| `/` e `/m` com `convidado@` | 200, **1.640 pontos** conferindo com o banco, **zero erros de console** |
| E1 — relógio | marcou **19:19** real; o `9:41` sumiu e **não quebrou hidratação** (era o risco da fase) |
| E1 — nome | menu lateral com **"Convidada Demo"**; o `Lucas Orladi` sumiu |
| Onda 0 — vitrine | **0 imagens do bucket** na vitrine: a PNG de teste segue fora |
| `NAV_ROUTES` | as 4 abas do `/e` aparecem **em** `/e/mural` — a armadilha prevista não se realizou |
| `/e/mural`, `/e/indicadores`, `/e/validar` | **200, zero erros**, degradam para estado vazio sem tabela/RPC |
| CPF — DV inválido | `Buscar` desabilitado e **0 chamadas ao servidor**: a barreira barata funciona antes do banco |
| CPF — DV válido | busca sai, volta **"Não foi possível consultar agora"** — o erro do Postgres **não vazou** para a tela |
| `/portal/avaliacoes` | **o "8,7" morreu**; sem depoimentos fictícios; NPS real degradando para "—" |
| `/admin/avisos` | 200, tela real (destinatários "Todos / Escolher"), sem o mock |

**Um efeito colateral que a degradação bonita esconde.** Sem a RPC, `/e/indicadores` exibe *"0 resgates neste mês"* e
o mural exibe *"Nenhum recado por aqui"* — **iguaizinhos** ao estado vazio legítimo. Em produção isso não acontece
(migrations vão antes), mas significa que uma falha futura de banco ou de permissão vai aparecer como "está tudo
zerado" em vez de "não consegui carregar". É o mesmo erro que o `tem_dados` evita no eixo do *dado* e que continua
aberto no eixo da *falha*. Backlog.

## 11. O achado mais grave do projeto — encontrado no smoke e corrigido

Não nasceu nesta fase: é de Fase 1–3 e está **em produção hoje**. Apareceu porque cliquei no login do admin antes
de a página hidratar, e a navegação foi parar em:

```
/admin/login?email=admin%40promofy.test&senha=promofy123
```

**Causa:** os formulários de login e de cadastro são `<form>` **sem `action` e sem `method`**, com a submissão
inteiramente em `onSubmit` do React. Antes da hidratação — rede lenta, aparelho fraco, chunk que falhou — o
navegador faz o *fallback* nativo: **GET para a própria URL com todos os campos na query string**. Verificado em
`/m/login`, `/e/login`, `/portal/login` e `/admin/login` (campos `email`, `senha`) e em **`/m/cadastro`**, que leva
junto `cpf`, `nascimento` e `celular`.

**Por que importa:** a senha em query string entra no histórico do navegador, no `Referer` das requisições
seguintes e — o pior — **nos logs de acesso da Vercel e de qualquer proxy no caminho**. Não exige atacante: vaza
sozinho. No meu caso vazou só a credencial de teste que já está documentada no `CLAUDE.md`.

**A correção:** `<form action={serverAction}>` com `src/lib/actions/auth.ts`. O Next 14 passa a emitir
`method="POST"` de verdade — sem JavaScript o login **funciona**, e a credencial vai no corpo. `method="post"`
sozinho estancaria o vazamento sem fazer o login funcionar; não era o pedido. A conferência de papel mudou-se
junto para o servidor, onde deixa de ser burlável.

### A prova, com JavaScript DESABILITADO

Contra build de produção local, em contexto de navegador com `javaScriptEnabled: false`:

| Caso | (a) funciona | (b) URL sem credencial |
|---|---|---|
| `/m/login` → `/m` · `/e/login` → `/e` · `/portal/login` → `/portal` · `/admin/login` → `/admin` | ✅ | ✅ |
| `/m/cadastro` → `/m/onboarding` | ✅ | ✅ sem `cpf`, `nascimento` nem `celular` |
| senha errada | mostra "E-mail ou senha incorretos." | ✅ |
| papel errado (`/e`, `/admin`) | mostra a recusa | ✅ |
| **recusa por papel deixa sessão?** | **não — zero cookie `sb-`**, e a sessão não sobrevive nem em `/m` nem em `/admin` | — |

A última linha é o teste que a mudança torna obrigatória: `autenticar` autentica **antes** de conhecer o papel, e
só então chama `signOut`. Vale com JS ligado e desligado.

**O caminho hidratado não regrediu:** o erro aparece **sem recarregar**, os quatro redirects estão certos, o
banner do código promocional reage, o checkbox marca pelo rótulo, zero erro de console. E o cliente do navegador
continua enxergando a sessão criada no servidor — o cookie sai `httpOnly: false`, então o `AuthSync` não entra em
descompasso e o logout dos dois papéis limpa tudo.

**O aceite dos termos virou real.** Era o `disabled` do botão, decoração removível pelo DevTools. Agora é checkbox
**nativo** com `required` (o navegador barra sem JS) **mais** checagem no servidor, que é a que vale.

### A revisão de segurança sobre esta correção: zero achados ≥7

E ela foi além do que eu tinha medido. Verificou no código do `@supabase/ssr` que a limpeza do cookie na recusa
por papel é **estruturalmente** correta, não sorte: dentro de uma Server Action o `cookies().getAll()` lê o que
acabou de ser escrito, então o passo `SIGNED_OUT` consegue expirar as chaves que o `signInWithPassword` criou.
Confirmou também que um `profiles` sem linha (RLS, erro de rede) cai no ramo de recusa — **falha fechado** — e que
`handle_new_user` só lê `role` de `raw_app_meta_data`, com whitelist, então `options.data` não alcança coluna
privilegiada.

### Uma armadilha nova, paga aqui

Exportei `ESTADO_AUTH_INICIAL` — um **objeto** — do arquivo `"use server"`. O `CLAUDE.md` já avisa que todo export
precisa ser `async`, mas registra que isso *"derruba o `next build`"*. **Não derrubou:** o build passou verde e a
rota só explodiu na primeira requisição, com 500 e *"A 'use server' file can only export async functions, found
object"*. O `tsc` também não vê. Por isso o estado mora em `src/lib/auth-estado.ts`.

**Efeito colateral bem-vindo:** sem o client do Supabase nas telas de entrada, o First Load JS delas caiu de
~235 kB para ~170 kB.

## 12. O dashboard do portal deixa de inventar

Extensão da mesma decisão que matou o "8,7". O `/portal` era **inteiramente** `mock-data`: "482 resgates",
"9.680 visualizações", "24,6% de conversão", "avaliação média 4,8", os deltas "+12,4% vs. mês anterior", dois
depoimentos assinados por pessoas que não existem, e o nome do estabelecimento como literal no cabeçalho.

**O que ficou, ligado ao que já tinha fetcher:** KPIs e funil saem de `cupom_metricas` — view sobre
`cupom_eventos`, `security_invoker`, então o lojista só soma eventos dos próprios cupons; NPS e últimas notas vêm
da mesma RPC do `/e/indicadores`; os cupons são os de verdade; o nome do estabelecimento vem da sessão.

**O que saiu, e por quê.** Os **deltas** precisam do período anterior, que ninguém calcula — "+12,4%" ao lado de
um número real seria a mesma mentira em escala menor. A **série mensal** é derivável de `cupom_eventos`, mas o
corte de mês teria de ser em BRT para casar com o `resgates_mes` que a RPC já calcula em SQL, e duas
implementações da mesma conta divergem na borda — é o que o próprio `indicadores.ts` avisa. Virou estado honesto
e item de backlog, não gráfico de enfeite.

**Detalhe que repete o `tem_dados`:** conversão com zero visualizações mostra "—", não "0,0%". Zero de zero não é
zero por cento; é "ainda não dá para dizer".

**O mesmo dado fictício continua em três telas que não estavam no pedido** — ver backlog. Uma delas é a página de
cupom do consumidor, e é a que mais incomoda.

## 13. Senha no scrubbing do Sentry

Fecha a consequência do §11. Com os formulários submetendo por Server Action, a senha passou a **atravessar o
servidor Next** — antes ia direto do navegador ao GoTrue. Um erro com o `FormData` anexado passaria a poder
levá-la ao Sentry, e o `sentry-scrub.ts` não tinha padrão nenhum para senha.

**Precisou de outro mecanismo.** CPF, e-mail e código de cupom têm **formato** — dá para achá-los no meio de um
texto. Senha não tem: `promofy123` é uma palavra como outra qualquer. Então a barreira é por **nome de chave**
(`{ senha: … }` → `[redigido]`, sem olhar o conteúdo) mais o caso de **par `chave=valor`** em string.

O segundo caso não é hipotético e é o mais urgente dos dois: **até este deploy, produção ainda serve os
formulários que degradam para `GET /admin/login?email=…&senha=…`** — e essa URL chega ao Sentry por breadcrumb de
navegação ou por `request.url`. O scrubbing cobre o vazamento que a correção ainda não alcançou.

**Token de sessão entrou junto**, por decisão minha e pelo mesmo argumento que já justificava o código de cupom no
arquivo: um `access_token` do Supabase é credencial ao portador, vale mais que um cupom, e objetos de sessão são
serializados dentro de erros com frequência. Se você preferir o escopo estrito de "só senha", é tirar dois nomes
da lista.

**De quebra, um buraco que o teto de profundidade abria:** acima do nível 8 a varredura devolvia o valor **cru** —
inclusive string, ou seja, um CPF a nove níveis saía inteiro. Agora string no teto ainda passa pelo filtro. O que
segue fora é objeto além do nível 8, e o comentário no arquivo diz isso.

**12 asserções novas**, incluindo as negativas: `senhaHint`, `password_hint` e `tokenizado` **não** são redigidos
(a lista não é varredura cega), e o que não é segredo sobrevive ao lado do que é.

## 14. Um tropeço de ambiente

O `verify` falhou uma vez com `error running container: exit 1` no `db:reset`, com 29 containers na máquina.
Transitório e não de código: o stack se recuperou sozinho e a repetição passou limpa. É a contenção já registrada
na memória do projeto (3 stacks Supabase simultâneos).

## 15. IMPACTO NA MIGRAÇÃO NATIVA

Princípio permanente: regra no servidor, lógica pura em `src/lib` sem API de navegador, só-web isolado atrás de
ponto trocável.

**Contratos de servidor que o app nativo herda prontos.** As cinco RPCs desta fase — `marcar_aviso_lido`,
`avisos_nao_lidos`, `indicadores_estabelecimento`, `buscar_ativacoes_por_cpf` e `validar_cupom_por_ativacao` — são
chamadas pelo RN com o mesmo JWT e devolvem o mesmo jsonb. **Toda a matriz anti-abuso vem junto de graça**: DV,
rate limit, resposta única e auditoria vivem no banco, não no cliente, então o balcão nativo não pode ser mais
permissivo que o web nem por engano.

**Módulos puros novos, reaproveitáveis como estão** (sem DOM, sem `server-only`, sem `Intl`): **`src/lib/cpf.ts`** é
o mais importante da fase para o nativo — DV, máscara e normalização idênticos dos dois lados, e a suíte compara
essa implementação com a do banco caso a caso para que não divirjam.

**Só-web, isolado.** `RelogioStatusBar` (as molduras de aparelho não existem no nativo — lá a status bar é do
sistema) e `validar-por-cpf.tsx` (o `<input>` com máscara vira `TextInput` com `keyboardType="number-pad"`; a
Action e as RPCs são reaproveitadas). *O gatilho migra; o arquivo não.*

**Cuidados herdados e ainda válidos.** Validar `Intl` com `America/Sao_Paulo` no Hermes antes de confiar em
`dentroDaJanela` e em `formatDateTimeBRT`. Conferir `wc -l` de `database.types.ts` depois de `db:types`. E o novo:
o badge do mural depende de recontagem por navegação — no RN, o equivalente é o foco da tela, não o `pathname`.

## 16. Deploy — o que precisa acontecer, na ordem

**Não executado. Decisão à parte.**

1. Rollback armado: anotar o `dpl_` de produção.
2. **Banco antes do código:** `db push --linked` das migrations **24 a 27**. Todas aditivas; o código antigo não
   conhece nenhuma tabela nova. **Atenção:** a 27 usa o **Vault** — confirmar `supabase_vault` no projeto de
   produção antes (local tem 0.3.1).
3. Merge `--no-ff` → push → build READY.
4. Smoke de produção: publicar um aviso real, conferir o badge no `/e`, o NPS real, e o fluxo por CPF ponta a ponta
   com `convidado@` (cujo CPF **passa** no DV — verificado).

## 17. Backlog

**Limpo nesta fase:** mural de recados · indicadores/NPS no `/e` · NPS real no portal · validação por identidade ·
cosmético "Lucas Orladi"/"9:41" · depoimentos fictícios do `/portal/avaliacoes` **e do dashboard** ·
**vazamento de senha na URL dos cinco formulários** · **senha e token no scrubbing do Sentry**.

**Próximo grande:** **taxonomia Segmento→Categoria e os filtros** — é o que resta de maior no produto.

**Fase 9 — as três telas com dado fictício restante.** Prioridade dentro do item: **`/m/cupom/[id]`**, a página de
cupom **do consumidor**, onde um `FeedbackCarousel` cola depoimentos de *Mariana Alves* e *Rafael Souza* a um cupom
**real**, como se fossem avaliações daquele cupom — é o único dos três que o consumidor vê. Depois, o funil mock do
**`/admin`**. Por último a **landing**, que é peça de marketing e merece decisão própria. **A remoção do
`/m/cupom/[id]` será combinada com o cliente**, porque muda o que ele mostra na demo.

**Prioridade média:** **erro renderizado como zero** (§10) · **série mensal de resgates** no portal — derivável de
`cupom_eventos`, mas precisa do corte de mês em BRT no SQL para não divergir do `resgates_mes`, então pede RPC, não
conta em JS · **ligar a confirmação de e-mail** exige antes tratar `signUp` **sem sessão**: hoje `cadastrarAction`
redireciona para `/m/onboarding` de qualquer jeito, o que só funciona porque a confirmação está **desligada em
produção por decisão da Fase 3** · **dívida do Sentry** (cliente **e** servidor não-provados — ver FASE-7 §14; critério de
aceite é evento no painel) · **medir o build com o Sentry restrito ao `nodejs`** (52s → 128s na Fase 7) ·
**retenção da auditoria de CPF** (nada apaga `private.validacao_tentativas`; ~14,4k linhas/dia/estabelecimento no
teto, e é dado pessoal pseudonimizado — LGPD pede prazo) · relatório NPS completo no portal (mockup `NPS.png`) ·
realtime do mural.

**Resta:** validação por identidade com **nome** além do CPF (esta fase entregou só o CPF) · destaque/banner no
admin · exportar relatórios · comentários em texto nas avaliações · exclusão de cupom pelo lojista · QR scanner
real · `/admin/configuracoes` salvando `config_pontos` · `validar-cupom-dialog` sem motivo `esgotado` · ~20 hex
amarelos fora dos tokens · auto-cadastro de empresa.

**Pendente de decisão do cliente:** periodicidade de uso ("1 por dia") — se a resposta for essa, o switch de
ilimitado da Fase 6 **não atende**.

**Novo (achado colateral, Fase 1):** `gerar_codigo_cupom` sorteia com `random()`, PRNG **não criptográfico** —
a entropia real do código é menor que os 2⁴⁰ nominais. Não é urgente (o código também é protegido por posse e pelo
status da ativação), mas `gen_random_bytes` do `pgcrypto` — já instalado — resolve em três linhas.

**Novo:** `cpfQa` agora gera CPFs estruturalmente válidos gravados em `profiles.cpf` no hospedado. A chance de
colidir com o CPF de uma pessoa real é baixa, mas o Brasil não reserva faixa de teste — se um dia colidir, a conta
de QA e um usuário real apareceriam juntos na busca de um lojista.
