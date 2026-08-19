# Migrations — diário de bordo

O que este banco tem, e por quê. Uma entrada por migration, em ordem de aplicação.

> **REGRA PERMANENTE — toda migration nova adiciona a sua entrada NESTE arquivo, no MESMO commit.**
> Sem isso o arquivo envelhece em silêncio e volta a valer menos que a arqueologia nos relatórios de fase.
>
> **Nunca editar migration já empurrada.** A 20 foi editada antes do push — é a exceção que confirma a regra
> (ver a observação dela). Depois de aplicada no hospedado, correção só por migration nova.

**Caminho padrão de aplicação no hospedado** (estabelecido na Fase 6): `supabase migration list --linked`
→ `supabase db push --linked --dry-run` → `supabase db push --linked`. O desvio MCP `apply_migration` +
`migration repair` é **plano B**, só quando o CLI não alcança o remoto.

**Estado:** produção tem **1–30** (`30 = 30` desde 18/08/2026 — as 28/29/30 foram ao ar com o merge
`670a116`). As **31 e 32** (Fase 9/Onda C) existem **apenas no local**. Sobre o número 29 ter sido
reaproveitado, ver a nota ao final. As 24–27 foram ao ar **antes** do código da Fase 8, e a janela banco-antes-código foi verificada e
é invisível: nenhuma delas toca objeto pré-existente, e o código então publicado não chamava nenhum objeto novo.

> **Nota sobre o projeto de QA** (`olyjfluaioafuizbnrpl`, descartável): está em **1–23**, atrás da produção. Não é
> `link`ado de propósito — `db push --linked` aponta para produção, e trocar isso deixaria um footgun armado. A via
> é `db push --db-url` com a senha do banco de QA.

---

## Fase 1 — Fundação

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `20260713014512_schema_inicial.sql` | Enums, tabelas e índices do domínio inteiro. Sem RLS (fica na 3) e sem funções (fica na 2). |

> **Obs.:** `cupons.id`, `estabelecimentos.id` e `categorias.id` são **TEXT** com os ids do mock (`c01`, `e1`, slugs)
> porque `/m/cupom/[id]` ainda lia o mock nesta fase — ids divergentes quebrariam os links da home.
> A coluna `imagem text not null default ''` nasce aqui e só ganha uso na Fase 7.

| # | Arquivo | O que faz |
|---|---|---|
| 2 | `20260713014516_funcoes_triggers.sql` | `handle_new_user()`: cria o profile no signup. |

> **Obs.:** o papel vem **somente** de `raw_app_meta_data` (service_role/admin API), **nunca** de
> `raw_user_meta_data`, que o próprio usuário edita via `options.data` no `signUp`. Um cast inválido não pode
> abortar a criação do usuário no GoTrue — daí a validação defensiva.

| # | Arquivo | O que faz |
|---|---|---|
| 3 | `20260713014519_rls_policies.sql` | RLS em **todas** as tabelas + os helpers `private.is_admin()` e `private.owns_estabelecimento(text)`. |

> **Obs.:** três decisões que o resto do banco herda. (a) `revoke` de **tabela** + `grant` por **coluna** — revoke
> por coluna é *no-op* no Postgres quando existe grant de tabela, e o Supabase dá `ALL` a `anon`/`authenticated`
> por default privileges. (b) Helpers `security definer` no schema `private` (fora da API) para não recursar em
> `profiles`. (c) `UPDATE` sempre com `USING` **e** `WITH CHECK`.

| # | Arquivo | O que faz |
|---|---|---|
| 4 | `20260713014522_views_metricas.sql` | View `cupom_metricas`, derivada de `cupom_eventos` (nunca contadores soltos). |

> **Obs.:** `security_invoker = true` — a view respeita o RLS de quem consulta; lojista só agrega os próprios cupons.

## Fase 2 — Ciclo do cupom no servidor

| # | Arquivo | O que faz |
|---|---|---|
| 5 | `20260713111009_fase2_enums.sql` | Acrescenta `'pendente'` a `status_cupom` e o lançamento de bônus ao ledger de pontos. |

> **Obs.:** arquivo separado **de propósito** — um valor criado por `ALTER TYPE ... ADD VALUE` não pode ser
> **usado** na mesma transação em que nasce. Esse padrão se repete na 8.

| # | Arquivo | O que faz |
|---|---|---|
| 6 | `20260713111014_fase2_constraints.sql` | Reativação pós-expiração: cada ativação vira a sua linha em `cupons_usuario`. |

> **Obs.:** troca a unique `(usuario_id, cupom_id)` por uma **parcial** `where status = 'ativo'` — histórico
> preservado, e só uma ativação viva por par.

| # | Arquivo | O que faz |
|---|---|---|
| 7 | `20260713112043_fase2_rpcs.sql` | As RPCs `security definer` do ciclo: `ativar_cupom`, `validar_cupom`, `responder_nps`, `registrar_evento_cupom`, `saldo_pontos`, `meu_estado_consumidor`. Revoga a escrita direta da Fase 1. |

> **Obs.:** fixa duas convenções da casa. "Hoje" de negócio é `America/Sao_Paulo` (`hoje_brt()`) — um cupom válido
> "até dia X" não pode morrer às 21:00 BRT por causa do UTC. E o retorno é sempre
> `{ok:true,...} | {ok:false, motivo:'...'}`, com a Server Action traduzindo o motivo.

## Fase 3 — Moderação e portal

| # | Arquivo | O que faz |
|---|---|---|
| 8 | `20260721120000_fase3_enums.sql` | Acrescenta `'rejeitado'` a `status_cupom`. |

> **Obs.:** `'rejeitado'` **não** reaproveita `'indisponivel'` — a policy pública exige
> `status in ('ativo','indisponivel')`, então `indisponivel` **aparece** no catálogo. `rejeitado` fica fora.

| # | Arquivo | O que faz |
|---|---|---|
| 9 | `20260721120100_fase3_cupons_grants.sql` | **Correção de segurança:** fecha o auto-approve do lojista. `revoke update on table` + `grant update` por coluna, sem `status` nem `estabelecimento_id`. |

> **Obs.:** o buraco era real — a policy da Fase 1 permitia `UPDATE` de **qualquer** coluna do próprio cupom, e
> `cupons` (ao contrário de `estabelecimentos`) não tinha grant por coluna. Bastava
> `PATCH /rest/v1/cupons?id=eq.<meu-cupom> {status:'ativo'}` para auto-aprovar.
> **Só o UPDATE foi fechado aqui — o INSERT ficou aberto até a migration 19.**
> É esta migration que dá ao lojista o `grant update (imagem)` que a Fase 7 discute.

| # | Arquivo | O que faz |
|---|---|---|
| 10 | `20260721120200_fase3_moderacao_rpcs.sql` | `aprovar_cupom` / `rejeitar_cupom` / moderação de estabelecimento — o **único** caminho de mudança de status. |
| 11 | `20260721120300_fase3_economia_rpc.sql` | `economia_total_consumidor()`: soma `cupons.economia` das validações do próprio consumidor. |

> **Obs. (11):** `security definer` porque a RLS pública esconde cupom de estabelecimento suspenso/expirado — sob
> invoker, a economia já ganha nesses cupons seria **subcontada**. Como definer ignora RLS, o filtro por
> `auth.uid()` **dentro** da função é a única barreira.

## Fase 4 — Descoberta

| # | Arquivo | O que faz |
|---|---|---|
| 12 | `20260722120000_fase4_estabelecimento_categorias.sql` | Junção N-categorias por estabelecimento. Cada cupom continua com 1, que deve pertencer ao conjunto. |

> **Obs.:** escrita na junção é **só admin**, mesmo racional do auto-approve fechado na Fase 3 — lojista com
> INSERT/DELETE se auto-inseriria nas 6 categorias sem moderação. `estabelecimentos.categoria_id` permanece como
> "categoria principal" (avatar/gradiente dos cards).

| # | Arquivo | O que faz |
|---|---|---|
| 13 | `20260722120100_fase4_favoritos.sql` | Favoritos de **estabelecimento** (não de cupom), com mutação exclusiva por RPC. |

> **Obs.:** escrita direta revogada porque `criado_em` é insumo das novidades — o cliente não pode forjar a data
> nem favoritar em nome de outro.

| # | Arquivo | O que faz |
|---|---|---|
| 14 | `20260722120200_fase4_novidades.sql` | Novidades **derivadas**, sem tabela de notificações: cupom visível de estabelecimento favoritado, publicado depois do favorito e do último "visto". |

> **Obs.:** usa o timestamp de **publicação**, não de criação — cupom criado antes do favorito mas aprovado depois
> deve notificar; `criado_em` erraria e `atualizado_em` é instável (qualquer edição toca).

## Fase 5 — Janela de consumo

| # | Arquivo | O que faz |
|---|---|---|
| 15 | `20260730120000_fase5_janela_pontos_usos.sql` | Janela de consumo **no servidor** (`ativar_cupom` recusa com `fora_da_janela`), pontos creditados no retorno da RPC, e usos por cupom. |

> **Obs.:** ⚠️ **a única registrada no hospedado por `migration repair`** — o `db push` não alcançava o remoto na
> Fase 5, então foi aplicada via MCP `apply_migration` e a linha em `supabase_migrations` foi conciliada à mão.
> A prova de fidelidade exigida na época: a linha ficou idêntica à que um `db push` teria gravado.
> O problema que ela corrige não era cosmético — um cupom "Seg a Sex, 11h às 15h" podia ser ativado num domingo
> às 3h, nascia com 5h de prazo e o consumidor **perdia** o cupom.

## Fase 6 — Higiene + cupom

> As migrations 16–19 foram as **primeiras aplicadas por `supabase db push --linked` direto**, sem repair.
> Foi aí que esse caminho virou o padrão da casa.

| # | Arquivo | O que faz |
|---|---|---|
| 16 | `20260802120000_fase6_cupons_campos.sql` | Campos novos do cupom: `taxas`, `formas_consumo`, ilimitado explícito (`NULL`) por usuário e total, `prazo_ativacao_horas` com mínimo de 5h. |

> **Obs.:** **tudo aditivo** — colunas com default, zero backfill. Isso é requisito do deploy coreografado
> banco-antes-código: existe uma janela em que este schema roda com o código **antigo** em produção, que não
> conhece nenhuma dessas colunas. `taxas` e `formas_consumo` são `jsonb` **sem CHECK de domínio**, deliberadamente:
> restringir jsonb no banco transforma dado sujo em exceção, e exceção dentro de `security definer` sem bloco
> `exception` vira 500 e deixa o cupom inativável. Quem garante o vocabulário é `src/lib/cupom-campos.ts`.

| # | Arquivo | O que faz |
|---|---|---|
| 17 | `20260802120100_fase6_limites_ilimitados.sql` | Ensina as RPCs a tratar `limite_por_usuario = NULL` como "sem teto" e publica `pode_reusar` no contrato. |

> **Obs.:** `pode_reusar` nasceu de um achado da revisão adversarial — o único que sobreviveu, corrigido **antes**
> da primeira linha de código de aplicação. Publicar a decisão "ainda posso usar?" como campo do contrato evita que
> cada tela a derive por conta própria.

| # | Arquivo | O que faz |
|---|---|---|
| 18 | `20260802120200_fase6_economia_variavel.sql` | `economia` passa a significar "mínima garantida"; `economia_variavel` marca os cupons de valor aberto ("a partir de R$ X" / "mais de R$ X" no total). |

> **Obs.:** a RPC nova é **aditiva** justamente porque o número já está no ar, na home que o cliente vê. Medido na
> janela banco-antes-código: com o banco na Fase 6 e o código da Fase 5 no ar, `economia_total_consumidor` devolveu
> o mesmo valor de antes e `pode_reusar` chegou como campo extra ignorado.

| # | Arquivo | O que faz |
|---|---|---|
| 19 | `20260802120300_fase6_status_no_insert.sql` | **Trigger de INSERT:** cupom de lojista nasce `pendente` mesmo via PostgREST direto. |

> **Obs.:** achado na exploração da fase, **fora do escopo pedido**. A Fase 3 fechou o auto-publish só no UPDATE;
> o INSERT nunca foi revogado — `authenticated` mantinha o grant de tabela e a policy de INSERT checava apenas a
> posse do estabelecimento. O lojista publicava direto pela porta da criação. Provado em produção no smoke da
> Fase 6: `INSERT` forçando `status:'ativo'` → nasceu `pendente`.

## Fase 6.5 — Edição de cupom e rejeição com motivo

| # | Arquivo | O que faz |
|---|---|---|
| 20 | `20260803120000_fase65_edicao_cupom.sql` | Coluna `moderacao_historico` (jsonb, **fora** do grant do lojista) + trigger `checar_edicao_cupom`: a matriz de imutabilidade da edição. |

> **Obs.:** a regra é **trigger, não Server Action**, porque o lojista já editava direto no PostgREST — com 24
> colunas no grant depois da Fase 6, uma matriz escrita só na Action seria decorativa.
> Barreiras: `P0601` economia (com validações), `P0602` benefício/taxas/formas (com ativações vivas), `P0603`
> limite por usuário abaixo do consumido, `P0604` limite total abaixo das validações, `P0605` validade encurtada,
> `P0606` horários reduzidos. **`imagem` é material** (entra em `v_mudou_algo` e em `v_material`): trocá-la rebaixa
> `ativo → pendente` e grava `editado_material`, mas **nenhum `P060x` a bloqueia**.
> Escapes do trigger: `auth.uid()` nulo (seed, service_role, manutenção via SQL) e admin.
> ⚠️ **Esta migration foi EDITADA, não emendada** — mas **antes** de ser empurrada. A regra "nunca editar migration
> aplicada" continua valendo para tudo que já foi.

| # | Arquivo | O que faz |
|---|---|---|
| 21 | `20260803120100_fase65_moderacao_motivo.sql` | `rejeitar_cupom` passa a **exigir motivo**; `aprovar_cupom` e a nova `reenviar_cupom_moderacao` registram a trilha em `moderacao_historico`. |

> **Obs.:** `DROP` + `CREATE`, não `CREATE OR REPLACE` — acrescentar parâmetro muda a assinatura, e
> `create or replace` criaria uma **sobrecarga** em vez de substituir. Consequência operacional: entre aplicar esta
> migration e subir o código, o admin no ar chama uma função que não existe mais — a janela precisa ser curta e com
> a fila de moderação vazia.
> O registro no histórico vale para **qualquer** status, não só `ativo`: um cupom rejeitado que volta à fila sem
> registro de correção faz o moderador reabrir no escuro (corrigido em `d5b501e`, depois de o teste do ciclo falhar).
> Trilha canônica do ciclo: `rejeitado, editado_material, reenviado, aprovado`.

## Fase 7 — Storage

| # | Arquivo | O que faz |
|---|---|---|
| 22 | `20260804120000_fase7_storage_cupom_imagens.sql` | Bucket `cupom-imagens` (público, 2 MiB, jpeg/png/webp) + policies dono-only em `storage.objects` para **SELECT, INSERT e DELETE**. |

> **Obs.:** três decisões que precisam sobreviver a esta migration.
>
> **(a) Não existe policy de UPDATE, e é deliberado.** Com UPDATE liberado o lojista sobrescreveria os *bytes* do
> caminho que um cupom **ativo** referencia; `cupons.imagem` não mudaria, o trigger da migration 20 não dispararia,
> e a imagem que o consumidor vê num cupom aprovado trocaria **sem remoderação**. Com UPDATE negado por ausência de
> policy (RLS nega por padrão) + `upsert: false` + nome aleatório novo a cada upload, o único caminho para mudar o
> que o consumidor vê passa por `cupons.imagem` — que é material e rebaixa `ativo → pendente`.
>
> **(b) A pasta é o ESTABELECIMENTO, não o cupom.** Muda o desenho da 6.5: dispensa a subquery em `cupons` no
> predicado e permite subir a imagem **antes** do insert, evitando um `editado_material` espúrio em todo cupom novo
> com foto.
>
> **(c) O `SELECT` não fica aberto.** Em bucket público a leitura vai por `/object/public` **sem RLS**; a policy de
> SELECT governa a **listagem**. Liberá-la publicaria o índice para quem tem a `ANON_KEY` (que está no bundle).
>
> ⚠️ **A migration nasce guardada** por `if exists (schema storage)`: o `[storage]` local está desligado pelo gate
> (o CLI 2.111.0 ainda puxa o `storage-api:v1.67.8` quebrado), e sem a guarda o `db:reset` abortaria. Quem garante
> que isso não vira buraco silencioso é a suíte `test:fase7:storage`, que roda contra o projeto de QA e assere
> bucket **e** comportamento das policies.
>
> **Não versionado aqui, mas parte do contrato:** o bucket também é declarado em `supabase/config.toml`, porque ele
> **não sobrevive ao `db reset`** — o CLI o recria a partir de lá no `start`.

| # | Arquivo | O que faz |
|---|---|---|
| 23 | `20260804140000_fase7_storage_endurecimento.sql` | Fecha dois furos da 22: o `INSERT` passa a exigir a **forma do nome**, e o `DELETE` não alcança imagem de cupom já moderado. |

> **Obs.:** achados da revisão de segurança do próprio C4, antes de qualquer deploy — e o primeiro invalida uma
> afirmação escrita na 22.
>
> **A 22 dizia que, sem policy de UPDATE, "o único jeito de mudar o que o consumidor vê é escrever `cupons.imagem`".
> Era falso.** Sem UPDATE fica bloqueada a *sobrescrita*, não o par **DELETE + INSERT na mesma chave**: o lojista
> apaga o objeto e sobe outros bytes no mesmo caminho, `cupons.imagem` não muda, o trigger da 20 não dispara, e um
> cupom **aprovado e ativo** passa a exibir conteúdo que ninguém moderou. `upsert: false` não protegia — é flag do
> cliente, não controle de servidor. Agora o `DELETE` exige que o objeto **não** esteja referenciado por cupom fora
> de `pendente`/`rejeitado`, via o helper `security definer` `private.imagem_de_cupom_moderado` (definer porque a
> policy precisa enxergar cupons de qualquer dono; sob RLS o lojista só veria os seus e a checagem falharia para o
> lado errado). Os usos legítimos continuam: órfão de insert que falhou é apagável, e a troca de imagem sobe chave
> nova → grava em `cupons.imagem` → remodera → a chave antiga fica livre.
>
> **O segundo:** a forma do nome só existia em `src/lib/imagem-cupom.ts`, e a Server Action não é fronteira para
> quem fala HTTP direto. Dava para guardar qualquer blob de 2 MiB em `<pasta>/qualquer-coisa.bin` — público, nunca
> referenciado, invisível à moderação: hospedagem grátis sob o domínio do projeto. A regex agora vive **também** no
> banco. Não era XSS (`allowed_mime_types` mantém a resposta em `image/*`, SVG fora), era abuso de marca.
>
> **Por que migration nova e não editar a 22:** a 22 já estava aplicada no QA, e `db push` não reaplica versão já
> registrada — editar deixaria os ambientes divergentes em silêncio.

## Fase 8 — Lado do estabelecimento

| # | Arquivo | O que faz |
|---|---|---|
| 24 | `20260805120000_fase8_mural_avisos.sql` | Mural de recados: `avisos` + `avisos_destinatarios` + `avisos_lidos`, RLS, e as RPCs `marcar_aviso_lido` / `avisos_nao_lidos`. |

> **Obs.:** o `/admin/avisos` existia desde a Fase 3 e era **100% mock** — dois literais em `useState`, "Enviar
> aviso" só fazia `setAvisos(...)`, e recarregar zerava. Não havia tabela nenhuma. Esta migration é o backend que
> a tela fingia ter.
>
> **Destinatários em tabela de junção, não `jsonb`.** O predicado de RLS fica `para_todos or exists(...)`,
> indexável. O precedente da casa para "N de um lado" é junção (`estabelecimento_categorias`, Fase 4); o `jsonb`
> sem CHECK da Fase 6 foi escolhido por outro motivo — evitar que dado sujo virasse exceção dentro de `security
> definer` — que não se aplica quando o dado é uma FK.
>
> **`avisos_lidos` não recebe grant de escrita para ninguém**, nem para o dono: `lido_em` seria forjável. O único
> caminho é a RPC `marcar_aviso_lido`, idempotente e com o mesmo predicado de visibilidade da policy de leitura —
> marcar como lido um aviso que você não pode ler seria escrever linha para algo invisível.
>
> **A junção também é filtrada para o lojista.** Sem isso, a partir de um aviso `para_todos` ele descobriria quais
> outros estabelecimentos existem e o que cada um recebe.
>
> `avisos_nao_lidos()` é **`security invoker`** de propósito: roda sob a RLS do chamador, que já filtra. Não
> precisar de `definer` é uma superfície a menos.

| # | Arquivo | O que faz |
|---|---|---|
| 25 | `20260805140000_fase8_indicadores.sql` | `indicadores_estabelecimento()`: NPS, distribuição, resgates do mês e últimas notas do estabelecimento do chamador. |

> **Obs.:** o NPS é coletado desde a Fase 2 e **nunca foi agregado**. O `/portal/avaliacoes` exibia
> *"NPS médio recebido: 8,7"* — string **hardcoded** desde a Fase 3. Esta migration é o número de verdade, e o
> card passou a lê-la.
>
> **`security definer` é obrigatório aqui.** A RLS de `cupons_usuario` mostra ao consumidor as *suas* linhas; o
> lojista não lê linha de ninguém. Sob invoker o lojista veria zero e o NPS seria sempre nulo. Como definer, o
> filtro por posse **dentro** da função é a única barreira — daí ele vir antes de qualquer leitura.
>
> **O que não sai daqui:** nome completo, e-mail, CPF e `usuario_id`. As últimas notas levam só o **primeiro
> nome** (`split_part(nome,' ',1)`). Omitir o `usuario_id` é deliberado: com ele, o lojista cruzaria notas entre
> cupons e reconstruiria o histórico de uma pessoa.
>
> **`tem_dados` existe para a UI não decidir.** Zero respostas **não** é score 0 — são coisas diferentes, e
> derivar isso na tela é exatamente como o selo "utilizado" errou na Fase 6. O servidor devolve `tem_dados: false`
> e `score: null`, e a tela mostra "ainda sem avaliações".
>
> **Mês em BRT, não UTC:** `date_trunc('month', … at time zone 'America/Sao_Paulo')`. Em UTC o dia 1º começaria
> às 21h do dia 30.

| # | Arquivo | O que faz |
|---|---|---|
| 26 | `20260805160000_fase8_validacao_cpf.sql` | Validação por identidade: `cpf_dv_valido`, auditoria/rate-limit, `buscar_ativacoes_por_cpf`, `validar_cupom_por_ativacao`. |
| 27 | `20260805180000_fase8_cpf_endurecimento.sql` | Endurece a 26 com os sete achados da revisão de segurança. |

> **Obs. (26):** quatro barreiras, nesta ordem — dígito verificador antes de tocar dado; rate limit contado **no
> banco** (serverless não tem memória compartilhada, então contador em processo seria contador por instância);
> **resposta única** para os três "não achei"; e posse.
>
> A **resposta única** é o centro. CPF inexistente, CPF de cliente de outro estabelecimento e CPF sem ativação
> devolvem o **mesmo objeto**. Distinguir os três transformaria a RPC num oráculo que revela quem é cliente de
> quem — e a suíte compara as três respostas byte a byte.
>
> A auditoria guarda **HMAC com pepper**, nunca o CPF: `sha256(cpf)` não anonimiza nada, porque existem ~10⁹ CPFs
> válidos e uma tabela arco-íris de todos cabe num notebook.
>
> **Obs. (27) — sete achados, e o primeiro é um defeito introduzido ao corrigir outro.** A 26 deixou de devolver o
> código da ativação (credencial ao portador de 2⁴⁰) e passou a devolver `cupons_usuario.id` — um **bigserial
> pequeno e denso**. Só que `validar_cupom_por_ativacao` aceitava apenas esse id: sem CPF, sem rate limit, sem
> auditoria. Um lojista percorrendo ids queimaria cupons dos **próprios clientes**, de forma **permanente** (a
> unique `(usuario_id, cupom_id)` impede reativar), com pontos por visitas que nunca houve. Agora o confirm
> **exige o CPF** — a posse do documento volta a ser a credencial.
>
> Os outros seis: **TOCTOU no rate limit** (`count` e `insert` separados pela consulta inteira em READ COMMITTED —
> chamadas paralelas passavam juntas; corrigido com `pg_advisory_xact_lock`, e importa porque o argumento de que o
> canal de tempo é inexplorável depende do teto valer); **pepper saía no `pg_dump`** (`supabase db dump -f
> supabase/seed.sql` é caminho documentado e `seed.sql` é versionado — o pepper de produção iria para o git junto
> com a tabela que ele protege; foi para o **Vault**, cuja chave vive fora do banco); **auditoria em `public`**
> alcançável por `service_role` → movida para `private`; **o confirm ecoava o código**, desfazendo no fim a recusa
> da busca; **bloqueado e DV-inválido não eram auditados**, então a tabela não mostrava a magnitude de um ataque;
> **`profiles.cpf` sem índice**; e **`limit 1` sem `order by`** escolhia estabelecimento arbitrário para dono de
> mais de um.

## Fase 9 — Fechamento da Fase 8 + taxonomia

| # | Arquivo | O que faz |
|---|---|---|
| 28 | `20260806120000_fase9_nps_pendente.sql` | `meu_estado_consumidor()` ganha `nps_pendentes[]` — validadas sem nota, mais recente primeiro — e um índice parcial em `cupons_usuario`. |

> **Obs.:** fecha o achado do smoke da Fase 8. A pesquisa de NPS só disparava quando o app do consumidor observava
> o flip `ativo → validado` **ao vivo**; a validação por CPF existe justamente para quando o celular **não** está
> presente, então nesse caminho a nota nunca era pedida e os indicadores sub-contavam o fluxo novo.
>
> **Por que chave nova e não derivar de `estados`:** a RPC já devolvia as validadas com `nps` null ali, mas o
> cliente **colapsa `estados` para uma linha por cupom**, preferindo a `ativo` — a validada-sem-nota some quando
> existe uma ativa do mesmo cupom. E `responder_nps` precisa do `row_id`, que o mapa colapsado perde.
>
> Aditiva: as demais chaves saem idênticas, e o código antigo ignora a nova. O índice é **parcial** — a linha entra
> nele enquanto deve nota e sai sozinha quando a nota chega.

## Fase 9 — Onda QA (relatórios v1/v2 do cliente)

| # | Arquivo | O que faz |
|---|---|---|
| 29 | `20260817120000_fase9_qa_janela_alcance.sql` | `dia_na_lista` e `janela_alcance(horarios, prazo) → {alcancavel, teto}`. **Aditiva pura:** cria funções novas e não toca em nada existente. |

> **Obs.:** a Fase 5 acertou o essencial (a janela é barreira de servidor) e respondeu à pergunta errada.
> `dentro_da_janela` pergunta *"posso consumir AGORA?"* — certo para a exibição. A **ativação** precisa de outra:
> *"o prazo que nasce agora ALCANÇA a janela?"*. Cupom "Sex 18:00–22:00" aberto às 17:48 com prazo de 5h valeria
> até 22:48 e cobriria a janela inteira; recusar só obrigava o consumidor a voltar ao app, e quem esquecia perdia
> o cupom (relatório de QA v2 §3.1).
>
> **Uma função devolve `alcancavel` E `teto` porque são a mesma decisão.** Aceitar a ativação antecipada obriga a
> limitar `expira_em` — sem isso o código valeria até 22:48 e seria validável no balcão às 22:30, **fora** do
> horário que o lojista definiu. As duas regras falam da **mesma ocorrência** da janela; separá-las em duas funções
> seria pedir que duas varreduras independentes concordassem sempre sobre qual ocorrência foi escolhida. Mesmo
> argumento que a 17 usa para `pode_reusar`: uma regra, uma expressão.
>
> **Três ocorrências candidatas (−1, 0, +1 dia)**, cada uma com motivo: **ontem** para janela que cruza a
> meia-noite e ainda está aberta (sem ela, ativar 00:30 num "22:00–02:00" seria recusado); **hoje** é o caso do
> relatório; **amanhã** para prazo longo na virada.
>
> ⚠️ **O teto quase virou uma regressão silenciosa.** A primeira versão cortava `expira_em` no fim da ocorrência
> isolada — e um cupom `00:00–23:59` (o padrão que o **/e** grava, ou seja, a maioria) ativado às 22:50 passaria a
> expirar às 23:59 em vez de 03:50: **4h de prazo perdidas sem proteger nada**, já que a janela reabre um minuto
> depois. Quem acusou foi a suíte da Fase 2 (`expira_em ≈ agora + 5h — 1.13h`). Agora o teto é o fim da janela
> **contígua**: sem restrição de dia + dia inteiro devolve `teto: null`, e com dias declarados a extensão para no
> primeiro dia **não** declarado — que é onde o consumo de fato deixa de ser permitido.
>
> Herda a doutrina da 15 sem exceção: **dado malformado é "sem restrição"**, nunca "fora da janela" e nunca
> exceção — um `''::time` aqui dentro abortaria a transação de `ativar_cupom` (definer, sem bloco `exception`) e
> deixaria o cupom permanentemente inativável.

| # | Arquivo | O que faz |
|---|---|---|
| 30 | `20260817130000_fase9_qa_ativar_cupom.sql` | `ativar_cupom` passa a admitir por **alcance** (com `expira_em` limitado ao teto) e a registrar o **clique** no servidor. |

> **Obs.:** recriada a partir da versão **vigente**, que é a da **17** — não a da 15. Recriar a partir da 15
> perderia o tratamento de `limite_por_usuario = NULL` e voltaria a travar cupom ilimitado depois da primeira
> validação. `create or replace` sem mudança de assinatura: nada do problema da 21, e o ACL é preservado.
>
> **O clique virou evento de servidor.** O relatório (v2 §3.3) reportou *"mais ativações que cliques"* e teorizou
> ativações em sequência sem fechar a tela. **A teoria não se sustenta** — toda ativação passava pelo mesmo botão,
> que registrava o clique. A causa real era **assimetria de durabilidade**: `ativacao` era gravada aqui, na
> transação, e `clique` era `void registrarEventoAction(...)` no cliente — fire-and-forget, sem `await` nem retry.
> Clique perdido na rede = ativação sem clique, e o funil do portal exibia a impossibilidade. A sugestão do
> relatório (fechar a tela após ativar) trataria o sintoma errado e cobraria um toque a mais de quem tem cupom
> ilimitado.
>
> ⚠️ **A ordem dentro da função é significativa, e custou um teste vermelho.** A busca do cupom **subiu** para
> antes do clique: `cupom_eventos.cupom_id` tem FK para `cupons`, então gravar clique de id inexistente abortava a
> transação com violação de FK em vez de devolver `nao_encontrado` (acusado por `test:fase2`). O clique fica
> **depois** da checagem de sessão (sem `v_uid` não há linha a gravar) e **antes** do ramo idempotente — senão
> reabrir o cupom ativo não contaria clique. E é gravado **antes** dos `return` de recusa de propósito: tentativa
> barrada por janela ou limite **é** intenção do consumidor, e é o que o lojista precisa ver no funil.
>
> **`validar_cupom` continua sem rechecar a janela**, e agora isso é deliberado *e* suficiente: quem carrega a
> garantia é o `expira_em` limitado, que a validação já respeita. Rechecar lá quebraria o caso legítimo de validar
> 22:00:30 um código ativado às 21:50.
>
> **Janela banco-antes-código:** entre a 30 e o deploy, o clique é contado **duas vezes** (aqui e no cliente, que
> ainda envia). É aditivo e se corrige sozinho no deploy. Subir o código antes deixaria a janela **sem clique
> nenhum** — perder dado é pior que duplicar.

## Fase 9 — Onda C (relatórios v1/v2: moderação, janela no /e, filtro e exclusão)

| # | Arquivo | O que faz |
|---|---|---|
| 31 | `20260818120000_fase9c_status_excluido.sql` | Acrescenta `'excluido'` a `status_cupom`. **Arquivo próprio** — valor de enum não pode ser usado na mesma transação em que nasce (padrão das 5 e 8). |

> **Obs.:** status, e não coluna `excluido_em`, por três razões. (a) A policy pública já filtra por
> `status in ('ativo','indisponivel')` (migration 3) — um status novo fica fora do catálogo **sem tocar em
> policy nenhuma**, enquanto um booleano exigiria reescrever a policy e tudo que a espelha. (b) `rejeitado`
> (migration 8) estabeleceu exatamente este precedente: status que existe para **não** aparecer. (c)
> `moderacao_historico` já registra transições de status; a exclusão entra na mesma trilha, sem inventar
> auditoria paralela.

| # | Arquivo | O que faz |
|---|---|---|
| 32 | `20260818130000_fase9c_excluir_cupom.sql` | Derruba a policy de `DELETE` do lojista, **revoga o grant**, e cria `excluir_cupom(text)`. |

> **Obs. — o `DELETE` era um destruidor de histórico armado.** `cupons_usuario.cupom_id` e
> `cupom_eventos.cupom_id` têm **`on delete cascade`** desde a migration 1 (linhas 100 e 110). A policy
> `"cupons: lojista apaga os proprios"` (migration 3) permitia
> `DELETE /rest/v1/cupons?id=eq.<meu-cupom>` **direto pelo PostgREST**, sem Server Action — e isso levaria
> junto todas as ativações, validações, **notas de NPS** e eventos de métrica daquele cupom. O relatório v2
> pediu exclusão (§1.6) e preservação de histórico (§4.2) na mesma página; só o soft delete atende aos dois.
>
> **Policy e grant caem juntos**, porque são barreiras independentes e derrubar uma só é meia barreira — a
> lição da 9 vale aqui na forma `revoke delete on table` (revoke por coluna seria no-op).
>
> **`status` não está no grant de update do lojista** (migration 9), então ele não consegue escrever
> `'excluido'` direto: a RPC `security definer` é o único caminho, e é onde a regra mora. A posse é checada
> **dentro** da função, antes de qualquer escrita — definer ignora RLS, mesma doutrina das 26/27.
>
> **Recusa com ativação viva** (`tem_ativacao_viva`). Um código já ativado e dentro do prazo é promessa feita
> a alguém possivelmente já no balcão; sumir do catálogo é uma coisa, sumir de quem segurou a vaga é outra.
> `validar_cupom` lê por **código**, não por status, então quem ativou antes continua conseguindo consumir.
>
> **Idempotente:** excluir de novo devolve `ok` com `ja_excluido`, em vez de erro — o card some no primeiro
> toque, e punir o segundo só assustaria quem já conseguiu o que queria.
>
> ⚠️ **A suíte foi verificada por mutação.** Recriando a policy de DELETE no banco local, `test:fase9c` ficou
> **vermelha em 10 asserções** — a começar por "DELETE físico NÃO apaga o cupom", com o resto caindo em
> cascata exatamente como cairia em produção. Um verde que nunca fica vermelho não provaria nada aqui.

> **A antiga "29" não existe, e o número foi reaproveitado.** O rate limit do cadastro foi desenhado, escrito, revisado — e **retirado da entrega**
> pela própria revisão. Ele chaveava a janela por um **parâmetro do cliente** (`p_ip`) numa RPC concedida a `anon`:
> quem rotacionasse o IP nunca era contado, e quem fixasse o IP de uma vítima negava cadastro a todos atrás daquele
> CGNAT. A Fase 8 acertou porque chaveava por `auth.uid()`, derivado no servidor — aqui a chave foi para o cliente
> **e** a autenticação caiu. O arquivo está em `_promofy_handoff/pendentes/`, aguardando decisão de desenho.

---

## Fase 9 · Onda D1 — o ciclo de vida do cupom passa a existir

| # | Arquivo | O que faz |
|---|---|---|
| 33 | `20260819120000_fase9_d1_ciclo_vida_cupom.sql` | `validar_cupom` carimba **`esgotado`** quando a validação alcança `limite_total`; trigger `trg_cupons_ciclo_vida` mantém validade e status coerentes. |

> **O diagnóstico que originou a migration.** `esgotado` e `expirado` estavam no enum desde a migration 1 e
> apareciam nas telas — mas **nenhuma linha de código os gravava**. Os únicos cupons nesses estados vinham do
> `seed.sql`, e a auditoria mediu os dois **dessincronizados do próprio dado**: o "expirado" tinha validade
> **futura**, e o "esgotado" tinha 500 resgates em `cupom_eventos` e **zero** validações em `cupons_usuario`
> — que é a contabilidade que de fato governa a admissão. Um teste que lesse o seed teria "provado" uma regra
> que não existia.
>
> **Esgotado nasce na validação**, porque é lá que o contador cresce. `validar_cupom` já serializava a linha
> do cupom (`for update`) para o recheck autoritativo do limite; a materialização entra **depois** do update
> da ativação, sob o **mesmo lock** e na mesma transação. Não há janela entre "esgotou" e "está marcado como
> esgotado", e duas validações concorrentes continuam sem passar do limite. `limite_total is null` (migration
> 17) nunca esgota.
>
> **Expirado continua derivado da data** — e isso é decisão, não omissão. Um cron varrendo a tabela todo dia
> só para carimbar vencimento acrescentaria peça móvel, horário de execução e modo de falha novos para
> produzir uma informação que `validade_fim` já carrega. Quem lê responde com `validade_fim < hoje_brt()`, e
> o Portal passa a apresentar isso como "Expirado" (`src/lib/ciclo-cupom.ts`).
>
> **O que a coluna precisa fazer é fechar o ciclo na prorrogação:** um cupom vencido que ganha data futura
> **não volta ao ar sozinho** — vira `pendente` e passa pela moderação. É a decisão de produto da D1, e o
> trigger a aplica no único instante em que a resposta muda: o `UPDATE`.
>
> **Trigger separado do `checar_edicao_cupom` (20), de propósito.** Aquele é a matriz de imutabilidade, uma
> barreira que **recusa**; este é coerência de dado, que **ajusta**. Misturá-los faria uma função de 250
> linhas responder a duas perguntas, e obrigaria a reescrevê-la inteira para mudar meia regra. A ordem é
> garantida pelo nome: o Postgres dispara triggers de mesmo tipo em ordem **alfabética**, e
> `trg_cupons_ciclo_vida` vem depois de `trg_cupons_checar_edicao`.
>
> **Age para todos, inclusive `service_role` e seed** — ao contrário da 20, que isenta admin. Não é regra de
> permissão: um cupom `ativo` com validade vencida é estado que não deveria existir, tenha sido escrito por
> quem for.
>
> **Esgotado não reativa.** Campanha encerrada vira **campanha nova** (id próprio, contadores do zero), porque
> reabrir o mesmo registro somaria métricas, ativações e NPS de duas vidas no mesmo funil, que agrega por
> `cupom_id` **sem recorte de período** — sem jeito de separar depois. Expirado é a **mesma** campanha
> continuando, então preserva id e histórico.

| # | Arquivo | O que faz |
|---|---|---|
| 34 | `20260819130000_fase9_d1_reserva_limite.sql` | `ativar_cupom`: a ativação **reserva** a vaga (capacidade = validados + ativos vigentes), serializada pelo lock da linha do cupom. |

> **A promessa que o QA cobrou.** Até aqui `limite_total` só era conferido contra VALIDAÇÕES. Medido em teste
> concorrente com `limite_total = 1`: dois consumidores ativaram ao mesmo tempo e ficaram **ambos** com código
> vivo (`ativos vigentes: 2 | validados: 0 | limite: 1`). A vaga só se decidia no balcão — um dos dois ouviria
> "esgotado" na frente do caixa, com o código na mão. Agora quem ativa enquanto há vaga **reserva** aquela
> unidade até validar ou expirar.
>
> **`validar_cupom` continua contando só `validado`** (migration 33), e isso é o que faz a reserva funcionar: a
> linha que está validando já reservou a própria vaga, e contá-la de novo recusaria justamente quem tinha
> direito. `ativo → validado` não aumenta consumo — converte reservado em consumido.
>
> **O carimbo `esgotado` também continua só de validações.** Sem vagas por reserva é estado TEMPORÁRIO: a
> contagem filtra `expira_em > now()`, então uma reserva que vence devolve a vaga sem varredura nenhuma.
> Carimbar por reserva tiraria o cupom da vitrine (a policy filtra status) e mataria a campanha sem ninguém
> ter consumido nada.
>
> ⚠️ **O lock entra ANTES do clique, e isso custou um deadlock para descobrir.** A primeira versão pegava
> `for update` junto da contagem de capacidade, e o teste concorrente devolveu `deadlock detected … while
> locking tuple in relation "cupons"`. A causa é o clique: `cupom_eventos.cupom_id` tem FK para `cupons`, e o
> INSERT adquire **FOR KEY SHARE** na linha do cupom. As duas transações registravam o clique e só então
> pediam FOR UPDATE — cada uma esperando a outra soltar o KEY SHARE que ela mesma segurava. Deadlock de
> *upgrade* de lock, invisível em teste sequencial. Tomar a linha inteira antes de qualquer KEY SHARE resolve.
>
> **Sem ciclo com `validar_cupom`**, que trava a ativação antes do cupom: para fechar um ciclo esta função
> precisaria esperar por uma linha de `cupons_usuario` que a outra detivesse — a expiração lazy só toca linhas
> **vencidas do próprio usuário**, e diante de uma dessas `validar_cupom` retorna 'expirado' antes de sequer
> pedir o lock do cupom.
>
> **Efeito colateral que a auditoria previa e a reserva eliminou:** como capacidade = validados + vivos ≤
> limite, `validados == limite` implica **zero ativações vivas**. O cupom só é carimbado quando não há mais
> ninguém esperando para usar — então ninguém perde a página do próprio cupom por causa do carimbo. Há
> asserção dedicada a essa propriedade.
