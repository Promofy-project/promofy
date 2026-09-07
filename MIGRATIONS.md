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

## Adendo da reunião de 05/08 — as três saídas do NPS

| # | Arquivo | O que faz |
|---|---|---|
| 35 | `20260821120000_adendo_nps_recusa.sql` | `cupons_usuario.nps_recusado_em` (timestamptz, nullable) · RPC `recusar_nps(bigint)` · `responder_nps` passa a **recusar** nota de linha recusada · `estado_cupom_json` ganha `nps_recusado_em` · `nps_pendentes` exclui as recusadas · índice parcial com a mesma condição. |

> **O pedido.** O card de NPS passa a ter três saídas: **Responder**, **Responder mais tarde** e
> **Não responder**. Só a terceira precisa de banco — "mais tarde" já é o `dispensarNpsPendente` do
> provider (estado de sessão, nada gravado, reoferece na próxima abertura) e "responder" é a
> `responder_nps` da Fase 2.
>
> **Coluna nova em vez de sentinela em `nps`.** Marcar recusa como `nps = -1` (ou 0) contaminaria a
> única coluna de onde sai o NPS do estabelecimento: `indicadores_estabelecimento` (migration 25)
> monta a base com `nps is not null` e classifica **0–6 como detrator**. Quem recusou viraria
> detrator — o oposto do que "não quis responder" significa.
>
> **`timestamptz`, não `boolean`.** Mesmo custo (`is null` / `is not null`) e responde "quando" de
> graça, como `validado_em`. Nullable nasce NULL em todas as linhas, sem backfill nem DEFAULT.
>
> **Sem grant novo.** A migration 2 revogou `insert, update` de `cupons_usuario` para
> `authenticated`; toda escrita passa por RPC `security definer`. A coluna entra nesse regime — não
> há PATCH por PostgREST para marcar **nem para desmarcar** a recusa. Há asserção disso na suíte.

### O contrato final: as duas direções fechadas NO SERVIDOR

> A primeira versão desta migration deixava um buraco que a auditoria do líder pegou: `recusar_nps`
> tirava a linha da fila, mas **`responder_nps` continuava aceitando nota naquela linha**. Ou seja,
> "encerramento definitivo" era promessa da TELA — bastava chamar a RPC com o `row_id` para
> ressuscitar a pesquisa, gravar a nota e levar os pontos que a recusa dizia não creditar. O
> consumidor fala PostgREST tão bem quanto o lojista (é o raciocínio da migration 20).
>
> | Sequência | Resultado |
> |---|---|
> | responder → responder | `ok: true`, `ja_respondido: true`, `pontos: 0` — **idempotente**, a nota é a primeira |
> | responder → **recusar** | `ok: true`, `ja_respondido: true` — **não marca recusa**; a nota dada não vira "não quis responder" |
> | recusar → recusar | `ok: true`, `ja_recusado: true` — **preserva o carimbo da PRIMEIRA** recusa |
> | recusar → **responder** | `ok: false`, `motivo: 'nps_recusado'` — **nada escrito, nada creditado, nada no ledger** |
>
> `motivo: 'nps_recusado'` segue o vocabulário da casa (`nao_validado`, `nao_encontrado`,
> `cpf_invalido`, `limite_usuario`): snake_case, curto, estável.
>
> **Ordem dos ramos em `responder_nps`, e ela é deliberada:** `nps is not null` vem ANTES da recusa,
> para preservar byte a byte a idempotência que já estava no ar.

### `estado_cupom_json` — o estado precisa saber

> A mesma auditoria mostrou que `estados[]` só carregava `nps`, e `nps = null` mistura duas coisas
> opostas: **"ainda pode responder"** e **"encerrou de vez"**. O rodapé de `cupom-ativo-sheet`
> decidia o CTA "Avaliar experiência" exatamente por esse null — e passaria a oferecer uma pesquisa
> que a RPC agora nega. A chave `nps_recusado_em` entra em `estado_cupom_json` para os três estados
> serem distinguíveis na leitura. **É UX; a autoridade continua sendo a RPC.**
>
> `create or replace` preserva o ACL — a função não é promovida a ninguém, e o `revoke ... from
> public, anon` da migration 2 é re-emitido para a migration ser legível sozinha.

> **Aditiva.** `usos`, `saldo`, `config` e `usuario` saem idênticos; `estados` ganha **uma chave
> nova** (cliente antigo ignora chave que não conhece), e `nps_pendentes` só encolhe — e só para
> quem recusou. É a janela banco-antes-código de sempre.
>
> ✅ **APLICADA EM PRODUÇÃO** (WP AD-2, 29/08/2026) — `db push --linked`, EXIT=0, coreografia
> completa em gates (baseline lido, dry-run conferido, prova pós-migration dos 10 itens, smoke
> funcional hospedado 57 PASS/0 FAIL). Detalhe em `_promofy_handoff/ADENDO-0508-RELATORIO.md`,
> seção "DEPLOY AD-2". Foi a **única** migration nova da branch `fix/adendo-0508-finalizacao`: a E1
> da taxonomia (`categorias_folha`) **não** entrou — ficou na `fase-estrutural-e1-taxonomia-schema`,
> aguardando a decisão de arquitetura em WP próprio.

## TX-P2A/TX-P2AF — a fronteira estável da taxonomia

`20260829120000_tx_p2a_fronteira_taxonomia.sql`

Três views, **nenhuma tabela, nenhuma coluna, nenhum dado**. Não cria segmentos, não cria
categorias folha, não muda o significado de `public.categorias`. É a preparação para o cutover,
não o cutover.

| view | hoje | depois do cutover |
|---|---|---|
| `catalogo_filtros` | `select id as slug, label, icon, gradiente, ordem from categorias` | passa a ler `segmentos` |
| `catalogo_categorias` | `select id as categoria_id, id as slug, label, icon, gradiente, ordem from categorias` (identidade) | passa a ler as categorias folha |
| `categoria_para_filtro` | `select id as categoria_id, id as filtro_slug from categorias` (identidade) | folha → segmento |

**TX-P2AF corrigiu uma colisão semântica da primeira versão (duas views, não três).** Havia uma
única `buscarCategorias()` servindo ao mesmo tempo o **filtro de descoberta** (`/m`, `/m/buscar`,
`/m/filtros` — vai virar 14 segmentos) e a **categoria operacional** (admin edita o vínculo
estabelecimento↔categoria; portal usa no form de cupom — vai virar categoria folha). Hoje as duas
coincidem porque `categorias` é as duas coisas ao mesmo tempo; a auditoria apontou que depois do
cutover elas **não coincidem mais**, e o admin receberia segmento onde precisa de UUID de folha —
em silêncio, sem erro, comparando a categoria física errada contra o catálogo errado. Por isso
`catalogo_filtros` e `catalogo_categorias` são **propositalmente duplicadas hoje**: fundi-las
obrigaria a desfundi-las no cutover, no pior momento possível. Nenhuma referencia a outra.

**Nomenclatura deliberadamente comprida no cliente** (`buscarFiltrosPublicos()` /
`buscarFiltrosTaxonomia()` para filtro; `buscarCatalogoCategorias()` para operacional) —
um `buscarCategorias()` genérico é exatamente o nome que escondeu a colisão uma vez.
`test:tx-p2a/H` tem prova estrutural (lê o código-fonte) de que cada consumidor usa a metade certa
e que o nome ambíguo não volta a existir.

**Por que view e não RPC.** O contrato é uma **relação**, não um cálculo: entra no
`database.types.ts`, compõe com `.in()` do PostgREST e, com `security_invoker = true`, herda a RLS
que `categorias` já tem (`"categorias: leitura publica"` libera anon). Nenhuma função
`security definer` nova para auditar; nenhum privilégio novo. Uma RPC daria a mesma coisa com uma
assinatura a mais para versionar.

**Nenhuma regra de visibilidade de cupom foi movida para cá** — e isso é deliberado. O cutover
quebraria exatamente um ponto do runtime: o predicado `cupons.categoria_id = <slug>`. Levar
validade/`ocultar_ate_inicio`/favoritos/ordenação para dentro de SQL seria reescrever o que já está
no ar, com risco de deriva de comportamento, para resolver um problema que não existe.

**`Cupom.categoria` fica com uma dívida explícita** (documentada em `src/lib/types.ts`): continua
carregando o `filtro_slug`, não a categoria folha física — por compatibilidade com `/m/buscar`
(`c.categoria === cat`). Renomear o campo é escopo do TX-P7, quando existir filtro por segmento E
por folha ao mesmo tempo.

> ⚠️ **View simples é auto-atualizável no Postgres.** Sem `revoke`, um `insert` na view escreveria
> em `public.categorias`. Por isso a migration faz `revoke all ... from public, anon, authenticated`
> e devolve **só `select`** — nas TRÊS views. `test:tx-p2a` tem as contraprovas (insert/update/delete
> negados em cada uma, mais o insert na tabela base) e confere que nada vazou.

**Aditiva, e a janela banco-antes-código foi confortável:** quando as views nasceram, nenhum código
publicado as lia — por isso elas puderam ir ao ar muito antes do deploy, sem efeito nenhum. Foi
exatamente essa folga que permitiu ao código antigo e ao novo coexistirem durante a publicação:
quando o deploy entrou, as views já estavam no banco esperando por ele.

✅ **Aplicada no hospedado e IMUTÁVEL — as três views JÁ estão em uso.**
`20260829120000_tx_p2a_fronteira_taxonomia.sql` está no Supabase hospedado, publicada por
banco-antes-código, e o runtime publicado **consome** `catalogo_filtros`, `catalogo_categorias` e
`categoria_para_filtro`. O parágrafo acima descreve o momento da criação, não o de hoje. A partir
daqui o arquivo desta migration **não se toca**: qualquer mudança nas três views é **migration NOVA
posterior**, na mesma ordem (banco primeiro, deploy depois).

## TX-P2B — schema STAGING da taxonomia nova

`20260830120000_tx_p2b_taxonomia_schema_staging.sql`

**Staging, não cutover.** Cria a ESTRUTURA do modelo novo (segmento → categoria folha) para o DDL
ser auditado com testes reais **antes** de carregar catálogo de produto. Nenhuma tela lê estas
tabelas; `public.categorias` legado continua sendo a **autoridade do runtime**.

| objeto | o que é |
|---|---|
| `public.tema_visual` (domain) | token de tema — **14 valores, um por segmento** (matriz abaixo) |
| `public.segmentos` | o nível que a descoberta oferece como filtro |
| `public.categorias_novas` | as folhas; vira `public.categorias` só no cutover (TX-P2D) |

**`tema` é token, não CSS.** Hoje `categorias.gradiente` guarda `linear-gradient(...)` — string que o
banco não valida e que amarra o schema ao CSS da web, num projeto cujo destino é React Native. O
modelo novo guarda um token e a camada de apresentação traduz. **DOMAIN e não enum:** `alter type …
add value` não deixa usar o valor novo na mesma transação em que nasce (armadilha já paga nas
migrations 5 e 8); estender um domain é `alter domain` numa migration comum. **DOMAIN e não duas
CHECKs iguais:** a mesma verdade em dois lugares vira duas verdades no primeiro dia em que alguém
edita uma só.

**O vocabulário inicial é o catálogo definitivo (§5.1 — 14 segmentos / 75 categorias folhas):** um
token por segmento, nomeado pelo matiz. TX-P2C carrega o catálogo **dentro** deste vocabulário.

> ⚠️ **Nota (TX-P2D1E): o domain deixou de ser whitelist fechada.** Este parágrafo, como escrito
> originalmente, dizia que o vocabulário era fechado nestes 14 valores — **isso mudou**. A migration
> `20260830150000` trocou a constraint do domain de uma lista fixa (`value = any (array[...])`) para
> validação de FORMATO (`value ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and length(value) <= 50`). Os 14
> valores abaixo continuam sendo o que o catálogo usa — são o **vocabulário inicial do seed**, não
> mais o teto do que o schema aceita. Produto pode introduzir um token novo por dado, sem migration
> de DDL. Ver a seção TX-P2D1E, mais abaixo, para o porquê.

| segmento | tema | segmento | tema |
|---|---|---|---|
| Alimentação | `laranja` | Educação | `indigo` |
| Fitness e Saúde | `verde` | Pet | `ambar` |
| Automotivo | `grafite` | Serviços | `cinza` |
| Beleza e Bem Estar | `rosa` | Saúde | `vermelho` |
| Entretenimento | `roxo` | Casa e Decoração | `terra` |
| Turismo e Hotelaria | `ciano` | Infantil e Maternidade | `amarelo` |
| Moda | `violeta` | | |
| Eletrônicos | `azul` | | |

São **design tokens**, não CSS: nada de hex, `rgb` ou `gradient` no domain, e o nome do segmento
também não é tema (`alimentacao` não é um token válido). Se um dia o vocabulário precisar mudar,
isso é migration nova com `alter domain` — nunca texto livre.

**Visual das folhas é herdado.** `NULL` em `icone`/`tema` (colunas renomeadas na TX-P2D1E — nasceram
como `icon_override`/`tema_override`) = "use o do segmento". Copiar ícone/tema para ~75 linhas
criaria 75 cópias para manter sincronizadas, e a primeira que divergisse seria um bug de UI sem
causa aparente.

**Slug de segmento é único global; slug de folha é único DENTRO do segmento** (`unique (segmento_id,
slug)`). O modelo precisa suportar `outros` em mais de um segmento — a decisão de produto sobre
"Outros" não está tomada, e a arquitetura não pode ser o que a impede. Slug é dado explícito do
catálogo, **nunca derivado do nome** (renomear "Saúde" não pode quebrar um `?cat=saude` já
compartilhado) e nunca gerado por trigger.

**Índices: só os dois uniques.** O `unique (segmento_id, slug)` tem `segmento_id` à esquerda, então
já serve às buscas por segmento **e** à checagem da FK no `ON DELETE RESTRICT` (Postgres não indexa
FK automaticamente) — um índice solto em `segmento_id` seria redundante. A 14 e ~75 linhas, índice
além disso é cerimônia: os uniques existem por **correção**, não por velocidade.

**`ON DELETE RESTRICT`, nunca CASCADE.** Segmento com categoria não se apaga — histórico usa
desativação. CASCADE apagaria silenciosamente as folhas e, no futuro, órfãos os cupons.

> ⚠️ **`ativo` NÃO é filtrado na RLS — e isso é a decisão central deste WP.** `ativo` responde "posso
> criar cupom novo aqui / mostro este chip?", não "esta linha pode ser lida?". Um cupom criado sob
> uma categoria depois desativada continua existindo e o card dele precisa resolver
> label/ícone/tema. Se a RLS escondesse a linha, `categoria_para_filtro` deixaria de traduzir a
> categoria física, `filtroSlugDe` devolveria `undefined` e **todo card histórico cairia no fallback
> cinza** — exatamente o modo de falha silencioso que o TX-P2A existe para impedir. Relatório que
> agrupa cupom antigo quebraria igual, e o React Native fala com o **mesmo** PostgREST (não há "usa o
> servidor" como escapatória). Também preserva o comportamento de hoje (`categorias: leitura
> publica` é `using (true)`) — divergir agora seria comprar uma regressão no cutover.
>
> No cutover a divisão fica: `catalogo_filtros` e `catalogo_categorias` filtram `ativo`;
> **`categoria_para_filtro` não filtra** — ela traduz histórico também.

**Catálogo é somente leitura para todo mundo**, inclusive admin: neste estágio o catálogo muda por
migration, não por DML de aplicação. Não há CRUD de taxonomia neste WP, então não há grant de
escrita para sustentar.

> ⚠️ **Nota (TX-P2D1E): reparenting não depende mais de ausência de grant.** Este parágrafo dizia
> originalmente que a ausência de grant de escrita era o que tornava o reparenting de `segmento_id`
> "impossível na prática", e que um trigger defensivo entraria só no cutover. A migration
> `20260830150000` adiantou esse trigger para antes dos shadows — `segmento_id` agora é
> **incondicionalmente** imutável por `trg_categorias_novas_impedir_reparent`, independente de
> grant, de a categoria já ter cupom, de estar ativa, ou de quem executa o UPDATE (inclusive
> `service_role`). O motivo do adiantamento: os shadows do TX-P2D2+ vão começar a escrever nessa
> tabela, e a garantia não podia continuar dependendo só de ninguém ter grant de UPDATE.

**`atualizado_em` reusa `public.set_atualizado_em()`** (migration 3) — não se duplica função global
por estética.

✅ **Aplicada no hospedado (TX-P2CD, banco-antes-código) e IMUTÁVEL.** `20260830120000` está no
Supabase de produção desde então — não editar este arquivo nunca mais, pelo mesmo motivo da
`20260829120000`. `public.segmentos` e `public.categorias_novas` existem no hospedado, mas
continuam **staging**: nenhuma tela lê essas tabelas lá, e o runtime publicado segue 100% em
`public.categorias` legado através das três views da TX-P2A. A janela banco-antes-código foi
possível pela mesma razão da TX-P2A — nenhum código publicado lê staging, então aplicar antes do
deploy não teve efeito nenhum no ar. Qualquer mudança de estrutura a partir daqui é migration NOVA.

## TX-P2C — catálogo canônico 14×75 em staging

`20260830130000_tx_p2c_taxonomia_catalogo.sql`

**Dado, não estrutura.** A TX-P2B criou o schema staging vazio; esta migration só faz dois `insert`
— 14 linhas em `public.segmentos`, 75 em `public.categorias_novas`. Nenhum `alter table`, nenhuma
mudança nas três views (`catalogo_filtros` / `catalogo_categorias` / `categoria_para_filtro`,
hospedadas e imutáveis), nenhum toque no legado. Continua staging: nenhuma tela lê estas tabelas.

**Fonte:** `docs/taxonomia/Promofy_Anotacoes_Devs.pdf` §5.1 ("Segmento e Categoria"), a lista de
referência que o cliente entregou. TX-P2C0 confirmou 14 segmentos / 75 categorias folha contra essa
fonte — a estimativa antiga de planejamento ("~15 × ~85") não foi usada. **"Outros" não existe na
lista do cliente** e não foi inventado aqui; `test:tx-p2c` prova isso (item 21).

**Fonte da verdade é `docs/taxonomia/catalogo-v1.json`, não esta migration.** O arquivo carrega os
89 UUIDs (14 segmentos + 75 categorias), nome/slug/ordem/tema exatamente como saem do PDF, e é ele
que `scripts/test-tx-p2c.ts` lê para comparar com o banco — a migration é gerada a partir do JSON,
nunca o contrário. Divergir os dois é o que os testes 24-32 pegam.

**UUIDs explícitos, gerados uma única vez — nunca `gen_random_uuid()`.** Local, QA e produção
carregando o mesmo slug com IDs diferentes quebraria silenciosamente o de-para do cutover (TX-P2D):
o vínculo `estabelecimento → categoria folha` é por UUID, não por slug. Reproduzir localmente é
rodar esta migration de novo (mesmo `db:reset` de sempre), nunca regenerar os IDs.

**Sem `ON CONFLICT`.** Um catálogo parcialmente aplicado tem de derrubar a migration, não seguir
como se nada tivesse acontecido — silêncio aqui seria pior que a falha aparecer no `db:reset`.

**Todas as 75 folhas herdam do segmento** (`icon_override` / `tema_override` NULL): a fonte não
define overrides, e o contrato de herança já é da TX-P2B.

**`esportes` existe em dois segmentos** (Fitness e Saúde, Educação) — não é bug nem duplicata
acidental, é o próprio caso que `unique (segmento_id, slug)` da TX-P2B foi desenhado para permitir.
`test:tx-p2c` prova que aparece exatamente duas vezes, nos dois segmentos certos (item 17).

**De-para do cutover, versionado e ainda não aplicado a nada.** `docs/taxonomia/depara-v1.json`
registra três mapeamentos que o TX-P2D vai precisar — nenhum deles foi escrito em
`public.categorias`, `public.estabelecimentos`, `public.estabelecimento_categorias` ou
`public.cupons` nesta migration:

| de-para | conteúdo |
|---|---|
| `legado_para_segmento` | as 6 categorias legadas (`alimentacao`, `fitness`, `beleza`, `eletronicos`, `educacao`, `pet`) → **segmento**, nunca categoria folha — o legado só tinha um nível, e esse nível corresponde ao segmento do modelo novo |
| `estabelecimentos` | os 6 estabelecimentos demo do seed → categoria principal + folhas, incluindo a remoção do vínculo decorativo `e1 → fitness` (seed.sql:38) — não há evidência de negócio para um restaurante em Fitness e Saúde |
| `cupons` | os 14 cupons demo do seed (`c01`–`c12`, `p-campanha-esgotada`, `p-campanha-expirada`) → categoria folha |

`test:tx-p2c` valida a consistência interna do de-para (itens 38-51): toda referência resolve dentro
do catálogo, e os invariantes cupom↔estabelecimento e principal↔categorias fecham 14/14 e 6/6.

**`test:tx-p2c` é somente leitura sobre o catálogo real** — os únicos INSERTs tentados (RLS negativa)
são recusados por ausência de grant antes de qualquer validação de conteúdo, então nunca criam
linha. Não há fixture para limpar.

✅ **Aplicada no hospedado (TX-P2CD, banco-antes-código) e IMUTÁVEL.** `20260830130000` está no
Supabase de produção desde então — não editar este arquivo nunca mais. Os 14 segmentos e as 75
categorias folha estão presentes lá, com paridade EXATA contra `docs/taxonomia/catalogo-v1.json`
(89 UUIDs, todo campo) — provado por leitura direta antes do PR, sem `test:tx-p2c --hosted` (essa
suíte tenta DML negativo, incompatível com produção). O runtime publicado continua **legado**: as
três views da TX-P2A seguem lendo `public.categorias` de sempre, e `catalogo_filtros` /
`catalogo_categorias` continuam com as mesmas 6 linhas de antes desta migration. O de-para
(`docs/taxonomia/depara-v1.json`) segue apenas registrado — nenhuma linha de
`estabelecimentos`/`estabelecimento_categorias`/`cupons` foi tocada. **O cutover é migration NOVA**,
não uma edição deste arquivo.

## TX-P2D1 — limpeza dos cupons extra (QA/dev) do hospedado

`20260830140000_tx_p2d1_cleanup_cupons_extras.sql`

**DATA cleanup, não DDL estrutural.** A auditoria TX-P2D0 encontrou 34 cupons no hospedado onde só
14 são esperados (`docs/taxonomia/depara-v1.json`). Os 20 a mais são artefatos de QA/dev — todos sob
`e1` (o estabelecimento de teste), criados entre 22/07 e 10/08 durante testes de fases anteriores
contra o hospedado, nunca limpos. Um deles (`84e451a7`, "Café do dia") é literalmente o cupom citado
em `docs/taxonomia/relatorio-v2-transcricao.md` §3.3 — não é ruído aleatório, é resíduo de
investigação de bug real.

**Decisão do líder técnico (TX-P2D1A): remover os 20, sem mapear para a taxonomia nova e sem
expandir o conjunto de categorias de `e1` para preservá-los.** Não é cutover — os 20 cupons
continuam com `categoria_id` legado (texto) até serem apagados; a taxonomia 14×75 não é tocada por
esta migration.

**Contas de teste/demo não são apagadas.** Só os 20 cupons e os fatos que dependem EXCLUSIVAMENTE
deles: `cupom_eventos` (78 linhas) e `cupons_usuario` (21 linhas), via `ON DELETE CASCADE` já
existente nas duas FKs — a migration não faz `delete` explícito nessas duas tabelas de propósito,
para que o próprio apply prove que o contrato de FK está correto. Boa parte dessas 21 ativações
pertence a `consumidor@`/`convidado@` (as contas com atividade real do cliente, ver §1 deste
documento) — a decisão foi tomada sabendo disso, não por trás dela.

**Portabilidade local/QA/hospedado.** Os 20 IDs só existem no hospedado. Em `db:reset` local,
`public.cupons` está vazio quando esta migration roda (`seed.sql` roda DEPOIS das migrations), então
o `target_count` é 0 e a migration é **NO-OP** — não é um caminho de teste hipotético, é o que
acontece em todo `db:reset` local, comprovado por `test:tx-p2d1`. `target_count` só pode ser 0 (nada
a fazer) ou 20 (o estado exato auditado); qualquer coisa entre 1 e 19 é estado parcial e a migration
**aborta alto** — nunca faz limpeza parcial.

**Asserts fail-high antes de qualquer `delete`:** os 20 existem exatamente, nenhum coincide com um
ID canônico, os 14 canônicos continuam presentes, todos os 20 têm `estabelecimento_id='e1'` e
`categoria_id='alimentacao'`, e as dependências batem **exatamente** com os números que a auditoria
mediu (78 `cupom_eventos`, 21 `cupons_usuario`) — se o hospedado tiver mudado entre a auditoria e o
apply, a migration recusa seguir em vez de presumir que nada mudou.

> ⚠️ **A auditoria original (TX-P2D0) errou o soft reference de `pontos_transacoes` — e o preflight
> hospedado (TX-P2D1D0) pegou isso antes do apply, exatamente para o que preflight read-only serve.**
> A checagem original comparava `pontos_transacoes.referencia_id` direto contra IDs de cupom, o que é
> **trivialmente sempre zero** — `referencia_id` guarda `cupons_usuario.id::text` (confirmado no corpo
> de `public.validar_cupom`), nunca um ID de cupom. Rodando a checagem CORRETA
> (`referencia_id = cupons_usuario.id::text` para os `cupons_usuario` ligados aos 20 extras) pela
> primeira vez contra o hospedado, o resultado real é **26 linhas** — 17 `resgate` + 9 `nps`, somando
> **1120 pontos** — geradas exclusivamente pelos usos/NPS desses cupons de QA/dev.
>
> **Decisão do líder técnico (TX-P2D1B): remover essas 26 linhas junto do cleanup.**
> `public.pontos_transacoes` é o ledger **fonte de verdade** — o saldo do usuário é `SUM(pontos)`,
> sem saldo persistido separado para sincronizar — e preservar esses 26 fatos depois de apagar os
> cupons/ativações que os geraram deixaria pontos órfãos semanticamente. **Isto só é aceitável porque
> os dados atuais são de desenvolvimento/teste/demo — não é precedente para dado real de cliente**,
> onde ledger histórico pediria estratégia de auditoria/compensação, nunca simplesmente apagar.

**Ledger de pontos: capturado antes, apagado por `referencia_id`, nunca por `usuario_id`.** Os IDs
dos 21 `cupons_usuario` alvo são capturados em variável ANTES de qualquer `delete` — o `CASCADE`
apaga essas linhas junto com os cupons, e sem os IDs guardados não haveria como localizar os pontos
depois. O `delete` em `pontos_transacoes` é restrito a `referencia_id = ANY(...)` desses 21 IDs
exatos — nunca por `usuario_id`, que apagaria bônus/visita/indicação e pontos de cupons canônicos da
mesma conta. Antes de apagar, a migration prova 26/17/9/1120 exatos (e que resgate+nps esgota o
total — nenhuma outra ação no conjunto); `GET DIAGNOSTICS` confere que o `delete` removeu exatamente
26 linhas, abortando (com rollback de tudo, inclusive esse `delete`) se não bater.

**Asserts depois do `delete`:** zero dos 20 restam em `cupons`/`cupom_eventos`/`cupons_usuario`/
`pontos_transacoes` (via os 21 IDs capturados), exatamente os 14 canônicos restam em `cupons`, os
totais gerais de `cupom_eventos`/`cupons_usuario` caem exatamente 78/21 (valor absoluto quando o
total geral também batia com a auditoria), o ledger geral de pontos cai em **DELTA** exato de −26
linhas / −1120 pontos (não em valor absoluto — o total geral varia por ambiente/atividade orgânica,
o que não pode variar é a queda causada por esta limpeza), e `segmentos`/`categorias_novas`/
`categorias` legado/`estabelecimentos`/`estabelecimento_categorias` continuam com as mesmas
contagens de sempre.

**`test:tx-p2d1` (19 testes) prova o estado CONVERGIDO**, não o delete em si (impossível localmente,
já que os 20 nunca existem fora do hospedado): a migration é posterior às três hospedadas, o de-para
continua com exatamente os 14 canônicos, o conjunto de `cupons` do banco é exatamente esses 14, e
nenhum `pontos_transacoes` local referencia um `cupons_usuario` ligado a qualquer um dos 20
removidos.

**Simulação destrutiva local (TX-P2D1AF / TX-P2D1B) provou o arquivo SQL real** — via
`docker exec ... psql`, nunca uma migration de teste separada — em quatro caminhos: sucesso completo
(34→14 cupons, −78 eventos, −21 ativações, −26/−1120 no ledger, por-usuário confirmado sem tocar
bônus/visita/indicação); estado parcial 19/20 (aborta, zero mutação); drift do ledger (25 em vez de
26 pontos, aborta, zero mutação); e um cenário de atomicidade com um 35º cupom não auditado, onde a
falha acontece **depois** dos dois `delete`s já terem executado dentro da transação — provando que o
bloco `DO $$ ... $$` desfaz mutação real já feita, não só aborta antes de mexer em algo.

✅ **Aplicada no hospedado (TX-P2D1D) e IMUTÁVEL.** `20260830140000` está no Supabase de produção
desde então, com o mesmo hash validado em todo o ciclo de preflight (`4cf2f9dc2b64214691881693e3306e11bcf975f3`)
— não editar este arquivo nunca mais, pelo mesmo motivo das três anteriores da cadeia.

Estado final confirmado por leitura direta pós-apply: os 20 cupons QA/dev saíram de `public.cupons`;
os 78 `cupom_eventos` e as 21 `cupons_usuario` associados saíram via `ON DELETE CASCADE`; os 26
`pontos_transacoes` derivados desses usos (17 `resgate` + 9 `nps`, 1120 pontos) saíram pelo `delete`
explícito restrito por `referencia_id`. Os quatro deltas globais bateram exatos com a previsão feita
antes do apply: `cupom_eventos` −78, `cupons_usuario` −21, `pontos_transacoes` −26 linhas / −1120
pontos. `public.cupons` convergiu para **exatamente** os 14 IDs de `docs/taxonomia/depara-v1.json` —
nem um a mais, nem um a menos. Nenhuma conta, nenhum estabelecimento e nenhuma linha da taxonomia
14×75 foi tocada; `segmentos`/`categorias_novas`/`categorias` legado/`estabelecimentos`/
`estabelecimento_categorias` e as três views da TX-P2A saíram do apply com as mesmas contagens de
sempre. O snapshot read-only pré-delete (fora do Git) foi preservado durante toda a validação.

## TX-P2D1E — canonicaliza o staging antes dos shadows do cutover

`20260830150000_tx_p2d1e_canonicaliza_staging_taxonomia.sql`

**Corrige três dívidas do contrato de staging por forward migration, antes do TX-P2D2 (shadows)
começar a escrever em `segmentos`/`categorias_novas`.** Não toca `20260829120000` / `20260830120000`
/ `20260830130000` / `20260830140000` — todas continuam hospedadas, imutáveis, e seus arquivos
`.sql` não foram editados. Onde o texto delas ficou desatualizado por essa migration (o vocabulário
do domain, o mecanismo de reparenting), a correção está em notas ⚠️ nas seções acima — o `.sql`
histórico permanece intocado, só a prosa deste arquivo (editável) foi atualizada.

**1. Rename físico:** `segmentos.icon` → `icone`; `categorias_novas.icon_override` → `icone`;
`categorias_novas.tema_override` → `tema`. `NULL` continua significando "herdar do segmento" — só o
NOME mudou. `ALTER TABLE ... RENAME COLUMN` preserva dado, `NULL`s, UUIDs e as expressões das
`CHECK` constraints automaticamente (Postgres rastreia por posição de coluna, não por texto); só os
NOMES das constraints (`segmentos_icon_nao_vazio` → `segmentos_icone_nao_vazio`, etc.) precisaram de
`RENAME CONSTRAINT` explícito, para não ficarem enganosos.

**2. `public.tema_visual`: de whitelist fechada para validação de formato.** A constraint original
(`tema_visual_check`, nome auto-gerado — confirmado no catálogo antes de escrever a migration, não
hardcodado às cegas) comparava `value` contra um array fixo de 14 strings. A nova
(`tema_visual_formato`) exige `value ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and length(value) <= 50` — slug
minúsculo, sem CSS, até 50 caracteres. Os 14 valores do seed continuam válidos pelo novo formato, e o
`drop constraint` + `add constraint` roda na mesma transação: o Postgres valida TODO uso atual do
domain (as 14 linhas de `segmentos.tema` e as ~10 de `categorias_novas.tema` com override) antes de
confirmar — se algum valor existente não batesse com o novo formato, a migration teria abortado
sozinha. Sem `ALTER TYPE ... ADD VALUE` (armadilha das migrations 5/8: não dá para usar o valor novo
na mesma transação em que nasce) — aqui nem se aplica, porque não é mais enum, é regra de formato.

**3. `categorias_novas.segmento_id` ganha trigger de imutabilidade incondicional.**
`trg_categorias_novas_impedir_reparent` (`BEFORE UPDATE OF segmento_id`) chama
`impedir_reparent_categoria_nova()`, que recusa qualquer `UPDATE` onde `new.segmento_id is distinct
from old.segmento_id` — **independente de grant, de a categoria já ter cupom, de estar ativa, ou de
quem executa**. Provado localmente inclusive como `service_role` via PostgREST (o papel mais
privilegiado que a API expõe) e como `postgres` superuser via `psql` direto (mais privilegiado que
`service_role`): os dois têm o `UPDATE` negado do mesmo jeito. O `revoke execute ... from public,
anon, authenticated` na função não é o que bloqueia o reparenting — triggers `BEFORE` disparam
independente de grant de `EXECUTE` na função (isso só importaria para alguém chamar a função como
RPC direta, o que não faz sentido fora de contexto de trigger). Um `UPDATE` que reafirma o *mesmo*
`segmento_id` (sem mudar o valor) não é bloqueado — a função usa `is distinct from`, reage a mudança
de valor, não à presença da coluna na cláusula `SET`. Mover uma folha de segmento continua sendo:
desativar a categoria antiga + criar uma nova.

**Testes atualizados, não enfraquecidos.** `scripts/test-tx-p2b.ts` tinha três casos que provavam
"fora do vocabulário fechado é NEGADO" com um valor sintaticamente válido (`turquesa`,
`alimentacao`, `neon`) — sob o novo domain de formato, esses valores **são aceitos**, e os testes
foram invertidos para provar exatamente isso (a extensibilidade), não removidos. Os casos que
continuam negados (vazio, CSS, hex, `rgb()`, maiúscula, espaço em qualquer ponta, underscore, hífen
malformado em qualquer ponta) ganharam cobertura nova onde faltava (espaço no início, underscore,
hífen no início) — o rigor sobre FORMATO aumentou; só o rigor sobre um vocabulário fechado de
produto, que nunca deveria ter sido responsabilidade do schema, foi removido. `test:tx-p2b`: 96 → 109
testes (13 novos: `20c2`, `20j`, `20k`, `20l`, `20m`, `21f`, e os 7 de reparenting `35`–`41`).
`test:tx-p2c` permanece 71 (mesmos testes, campos renomeados para `icone`/`tema`).

**`docs/taxonomia/catalogo-v1.json` também foi renomeado** (`icon`→`icone`,
`icon_override`/`tema_override`→`icone`/`tema`, valores `null` preservados) — não é migration
hospedada, pode ser editado livremente. A migration `20260830130000` (que gerou os dados a partir
dele) permanece intocada e imutável; o JSON é a fonte versionada, não o `.sql` já aplicado.

**Runtime segue incólume.** Nenhuma tela lê `segmentos`/`categorias_novas` hoje — confirmado antes e
depois desta migration. As três views da TX-P2A continuam lendo `public.categorias` legado e
devolvendo 6/6/6. `database.types.ts` regenerado (`icone` presente, `icon_override`/`tema_override`
zerados).

✅ **Aplicada no hospedado e IMUTÁVEL.** `20260830150000` foi ao ar no Supabase de produção (`bpeqpxvxgdyjjdcoycgp`) junto com `20260830160000`/`20260830170000` — mesmo apply, mesma janela. Hash SHA-256 do arquivo validado antes e depois do apply: `e0fced8603e30a533afdbf0c1cfde85fe97a2633a5511f3197ae72c2620cf266`. Não editar este arquivo nunca mais, pelo mesmo motivo das anteriores da cadeia. Ver seção «PUBLICAÇÃO» ao final do capítulo MARCO 1 para o estado hospedado completo.

## MARCO 1 — shadows UUID, relações novas e snapshots imutáveis

Continuação direta da TX-P2D1E: ali o *staging* (`segmentos`/`categorias_novas`) foi canonicalizado;
aqui o resto do banco ganha os **campos-sombra** que vão substituir o legado no cutover, sem tocar
uma tela sequer. Duas migrations, a mesma regra das anteriores: **aditivas**, `ON DELETE RESTRICT`
em toda FK para categoria (histórico nunca é apagado por physical delete, só por desativação), e
falha alta (`RAISE EXCEPTION`) em qualquer contagem que não bater.

### `20260830160000_m1_relacoes_uuid_shadow.sql`

**Schema novo, todo NULL/vazio até o backfill do fim da própria migration:**

- `public.cupons.categoria_nova_id uuid null references categorias_novas(id) on delete restrict` —
  a folha UUID do cupom. `cupons.categoria_id text` (legado) **não é tocado, não é substituído**.
- `public.estabelecimentos.categoria_principal_id uuid null references categorias_novas(id) on
  delete restrict` — a folha UUID pré-selecionada nos forms (equivalente novo do
  `estabelecimentos.categoria_id` legado).
- `public.estabelecimento_categorias_novas (estabelecimento_id text, categoria_id uuid, criado_em
  timestamptz, PK (estabelecimento_id, categoria_id))` — o N:N novo, RLS ligada, **leitura pública**
  (`grant select` a `anon`/`authenticated`, policy `using (true)`), **zero grant de escrita** para
  qualquer papel da aplicação. Só `service_role` escreve.

**Duas famílias de invariante, as duas nos DOIS SENTIDOS, via trigger — não via grant, não via
CHECK estático (dependem de outra linha/tabela, CHECK não alcança):**

1. **Principal ∈ join, e categoria em uso não sai do join.** `checar_principal_novo_no_conjunto()`
   (`BEFORE INSERT OR UPDATE OF categoria_principal_id` em `estabelecimentos`) recusa definir uma
   principal que não esteja em `estabelecimento_categorias_novas` para aquele estabelecimento.
   `impedir_remover_categoria_do_conjunto_em_uso()` (`BEFORE DELETE OR UPDATE OF estabelecimento_id,
   categoria_id` em `estabelecimento_categorias_novas` — a função e o nome do trigger foram
   estendidos no HARDENING FINAL, ver abaixo) recusa remover — ou mudar a chave, o equivalente de
   remover — exatamente a relação que hoje é (a) a principal do estabelecimento, OU (b) está em uso
   por `categoria_nova_id` de algum cupom daquele estabelecimento. Remover qualquer OUTRA relação
   continua permitido, e um `UPDATE` que reafirma a MESMA chave (sem mudar valor) não é bloqueado.
   Provado nos dois sentidos, e nos dois eixos (principal / uso por cupom), via `psql` direto como
   `service_role`/`postgres`.
2. **Categoria do cupom ∈ join do seu estabelecimento, e ativa NO MOMENTO da seleção.**
   `checar_categoria_nova_cupom()` (`BEFORE INSERT OR UPDATE OF categoria_nova_id,
   estabelecimento_id` em `cupons`) recusa `categoria_nova_id` que não esteja em
   `estabelecimento_categorias_novas` para o `estabelecimento_id` daquele cupom
   (`categoria_nova_fora_do_conjunto`), e recusa uma categoria/segmento com `ativo = false` **só
   quando o valor está sendo definido/alterado** (`categoria_nova_inativa_para_nova_selecao`) — uma
   categoria desativada **depois** de já estar num cupom não invalida esse cupom; a checagem não
   roda em leitura nem é reavaliada por nenhum job, só dispara em escrita da própria coluna. Como a
   trigger já dispara em `UPDATE OF ... estabelecimento_id`, mudar o estabelecimento de um cupom
   mantendo uma `categoria_nova_id` que o NOVO estabelecimento não tem também é negado — auditado no
   HARDENING FINAL isolando esse caso do check LEGADO equivalente (que usa outra tabela e teria
   bloqueado por um motivo diferente em muitos pares óbvios).

**Backfill do de-para (`docs/taxonomia/depara-v1.json`), idempotente por necessidade, não por
estilo:** o `supabase db reset` local aplica **todas** as migrations antes de rodar `seed.sql` — as
linhas que este backfill referencia (`estabelecimentos` e1–e6, os 14 `cupons` canônicos) só existem
no HOSPEDADO no instante em que a migration roda; localmente ainda não existem. A saída foi
`private.aplicar_backfill_m1_taxonomia()`, uma função `returns void` com guarda `contagem é 0 (no-op)
ou N exato (aborta no meio)`: a própria migration a chama uma vez no fim (efeito real no hospedado,
NO-OP seguro local) e `supabase/seed.sql` a chama de novo no fim (efeito real local, depois que os
dados do seed existem). Uma fonte só da lógica de mapeamento, nos dois ambientes — nunca uma segunda
cópia divergente. Resultado, nos dois lados: **10 relações** em `estabelecimento_categorias_novas`
(exatamente o de-para — deliberadamente **sem** `e1 → fitness`, que era vínculo legado decorativo,
nunca replicado no shadow), **6/6** `categoria_principal_id` preenchidos, **14/14**
`cupons.categoria_nova_id` preenchidos.

**HARDENING FINAL: a função vive em `private`, não em `public`, e não é mais `SECURITY DEFINER`** —
ver seção própria ao final deste capítulo.

### `20260830170000_m1_snapshots_taxonomia.sql`

**Snapshot histórico, server-owned, imutável.** `public.cupom_eventos.categoria_id` e
`public.cupons_usuario.categoria_id` (as duas `uuid null references categorias_novas(id) on delete
restrict`) guardam qual categoria folha o cupom tinha **no momento** daquele evento/uso — não a
categoria atual do cupom, que pode mudar depois.

- **Captura automática, incondicional (HARDENING FINAL):** `capturar_categoria_nova_evento()` /
  `capturar_categoria_nova_uso()` (`BEFORE INSERT`) **sempre** derivam `categoria_id` a partir de
  `cupons.categoria_nova_id`, sem olhar o que o caller mandou. A versão original só preenchia "se o
  caller não mandou nada" (`new.categoria_id is null`) — o que deixava a porta aberta para um caller
  (RPC, Server Action, PostgREST direto, **inclusive `service_role` da aplicação**) mandar um UUID
  qualquer e ele ser aceito como se fosse o snapshot real. Agora o valor recebido é **ignorado e
  sobrescrito** antes de a linha existir: o snapshot nunca é input, é sempre fato derivado. Se o
  shadow do cupom ainda for `NULL` (transição), o snapshot nasce `NULL` também, mesmo que o caller
  tenha mandado um UUID — não é erro, é o estado esperado até aquele cupom terminar de ser
  classificado. Provado (`scripts/test-m1-taxonomia.ts`, itens 42–43): INSERT mentindo a categoria
  grava a categoria REAL do cupom, não a mentira.
- **Imutabilidade incondicional:** `impedir_mudar_categoria_evento()` / `impedir_mudar_categoria_uso()`
  (`BEFORE UPDATE OF categoria_id`, `IS DISTINCT FROM`) recusam **qualquer** UPDATE que mude um
  `categoria_id` já preenchido — `NULL → UUID` (backfill/transição) passa, `UUID → UUID diferente`
  nunca, **para qualquer role, incluindo `service_role` da aplicação** (mesmo mecanismo já provado em
  `trg_categorias_novas_impedir_reparent`, TX-P2D1E: trigger `BEFORE` não é gated por `EXECUTE` grant
  na função). Não existe RPC de bypass, não existe grant de escrita pública nessas colunas. Continua
  valendo mesmo depois da captura passar a ser incondicional (item 44 do teste).
- **Backfill dos fatos já existentes**, mesmo padrão idempotente (`private.aplicar_backfill_m1_snapshots()`,
  chamada pela migration e por nascer de novo em `seed.sql`), mas com assert de **orfandade zero**
  em vez de contagem fixa — o volume de `cupom_eventos`/`cupons_usuario` varia por ambiente/atividade
  orgânica; o que não pode existir é um fato cujo cupom já tem `categoria_nova_id` e cujo snapshot
  ficou `NULL`. HARDENING FINAL: função em `private`, não mais `SECURITY DEFINER` (ver seção própria).

**Prova histórica completa** (`scripts/test-m1-taxonomia.ts`, itens 26–28): cupom em categoria A →
evento captura A → cupom recategorizado para B (válida, ∈ join) → o evento antigo **continua A** →
um evento novo **já captura B** → tentar alterar o snapshot antigo de A para B direto é **negado**. A
suíte reverte o cupom de teste (`c01`) para a categoria original no `finally`, para o mapeamento
exato do de-para continuar batendo depois da suíte rodar.

### Transição — como a escrita nova se comporta hoje

Nenhum Server Action/RPC escreve `categoria_nova_id`/`categoria_principal_id` ainda — o cutover de
runtime é Marco 2+. O que já é verdade, provado por `scripts/test-m1-taxonomia.ts` (itens 29–30):

- **INSERT de cupom só com o campo legado (`categoria_id` texto) continua funcionando sem erro** —
  `categoria_nova_id` nasce `NULL`, nenhum trigger bloqueia. É o caminho que o portal/`/e` usam hoje.
- **Um shadow `NULL` gerado por essa escrita legítima é detectável por query** (`select count(*) from
  cupons where categoria_nova_id is null`) — não existe estado silenciosamente incompleto. Isto é o
  gate que o Marco 2 usa para achar o que falta classificar.
- **Deliberadamente não resolvido agora:** um slug legado ambíguo (`alimentacao` → `restaurante` OU
  `pizzaria`) não tem resolução automática segura — adivinhar uma folha específica seria inventar dado
  que ninguém informou. Fica nulável até existir uma decisão de produto ou uma tela que pergunte.

### Runtime — acoplamentos físicos removidos onde a fronteira já existia

Sem mudar UX/formato de saída: `src/app/e/perfil/page.tsx` e `buscarCategoriasEstab()`
(`src/lib/data/estab.ts`) liam `public.categorias` **direto** (embed `categorias(label)` num caso,
`.from("categorias")` solto no outro) para resolver só o `label` de uma categoria já conhecida — a
mesma informação que `buscarCatalogoCategorias()` (a fronteira da TX-P2A, `src/lib/data/taxonomia.ts`)
já expõe. As duas trocaram a leitura direta por um lookup no catálogo da fronteira; a consulta ao
N:N legado (`estabelecimento_categorias`, específica de cada estabelecimento) continua onde estava,
porque não é isso que a fronteira generaliza. Nenhum import de `"categorias"` sobrou em `src/`
(`grep` confirmado). Isto não é o cutover de UX (Parte M do prompt) — é só remover a distância física
entre tela e o ponto único de troca, para o Marco 2 não precisar caçar consumidor por consumidor.

### Segurança da nova join (Parte N)

`estabelecimento_categorias_novas`: `anon` e `authenticated` **leem** (policy `using (true)`,
confirmado via `anon` real), **não escrevem** (INSERT/UPDATE/DELETE negados para os dois papéis,
confirmado via chamada real, não só inspeção de grant). `categoria_nova_id`/`categoria_principal_id`
herdam o `grant insert`/`grant select` de tabela que `cupons`/`estabelecimentos` já tinham para
`authenticated` — isso permite a um lojista **classificar um cupom novo na criação** (o trigger ainda
valida que a categoria pertence ao próprio estabelecimento e está ativa), mas **não** existe `grant
update` de coluna para essas duas colunas: reclassificar um cupom/estabelecimento já existente por
`authenticated` é negado (confirmado via `psql`: `authenticated` tenta `UPDATE categoria_nova_id` e
recebe erro de privilégio, não erro de invariante). Nenhuma função de trigger é `SECURITY DEFINER`
desnecessária; todas usam `SET search_path TO ''` e qualificam `public.` internamente. As duas funções
de backfill (`private.aplicar_backfill_m1_taxonomia()` / `private.aplicar_backfill_m1_snapshots()`)
não são mais `SECURITY DEFINER` — ver HARDENING FINAL abaixo.

### HARDENING FINAL — três fechamentos pós-auditoria

Auditoria final do Marco 1 (ainda antes de qualquer hospedagem) achou três lacunas — todas corrigidas
**editando diretamente** `20260830160000`/`20260830170000` (não hospedadas, sem custo de nova
migration) e o `supabase/seed.sql`. Nenhuma mudou o schema visível a ponto de exigir nova coluna;
`database.types.ts` foi regenerado mesmo assim (as duas funções de backfill saem de `Functions` — não
existem mais em `public`, ver abaixo).

1. **Invariante reversa cupom → join.** A proteção original de `estabelecimento_categorias_novas`
   só olhava `categoria_principal_id`. Faltava o outro lado: nada impedia `DELETE (e1, pizzaria)` do
   join enquanto um cupom de `e1` ainda tivesse `categoria_nova_id = pizzaria` — o cupom ficaria com
   uma categoria fisicamente fora do conjunto do próprio estabelecimento, exatamente o estado que a
   invariante de `checar_categoria_nova_cupom()` existe para impedir do outro lado. A função
   (renomeada `impedir_remover_principal_novo_do_conjunto()` → `impedir_remover_categoria_do_conjunto_em_uso()`)
   agora nega os dois casos, e o trigger passou a disparar também em `UPDATE OF estabelecimento_id,
   categoria_id` (mudar a chave de uma relação em uso é tratado como removê-la) — um `UPDATE` que
   reafirma a MESMA chave sem mudar valor continua permitido. Provado (itens 38–40b): remover relação
   em uso é negado; recategorizar o cupom para liberar a relação e SÓ ENTÃO remover funciona; a
   proteção de principal continua intacta; `UPDATE` de chave numa relação em uso é negado.
2. **Mudança de `estabelecimento_id` do cupom.** Auditado, não corrigido — já funcionava, porque
   `checar_categoria_nova_cupom()` já disparava em `UPDATE OF ... estabelecimento_id` e valida contra
   `NEW.estabelecimento_id`. O risco real era um teste que provasse isso por engano: mover `c11`
   (pet/banho-tosa) de `e6` para `e1` já falha por um motivo DIFERENTE — o check LEGADO
   (`checar_categoria_cupom()`, `categoria_fora_do_conjunto`), já que `e1` não tem `pet` no legado.
   Isso mascararia um buraco real no check NOVO. O teste isolante usa `c03` (fitness legado/academia
   nova, de `e2`) → `e1`: `e1` TEM `fitness` no legado (o vínculo decorativo do item 15) mas NÃO tem
   `academia` no join novo — só o check NOVO bloqueia esse caso, com `categoria_nova_fora_do_conjunto`.
   Provado isolado do legado (itens 41–41b).
3. **Snapshot 100% server-owned.** `capturar_categoria_nova_evento()`/`_uso()` preenchiam
   `categoria_id` só quando `new.categoria_id is null` — um caller que mandasse um UUID no INSERT
   tinha esse valor aceito como se fosse o snapshot real, nenhuma validação rodava. Agora as duas
   funções **sempre** sobrescrevem `NEW.categoria_id` com o valor derivado de
   `cupons.categoria_nova_id`, incondicionalmente — o campo enviado pelo caller nunca chega a ser
   gravado. Provado com um INSERT deliberadamente mentiroso (itens 42–43): `cupom_eventos`/
   `cupons_usuario` recebem a categoria REAL do cupom, não a mandada; a imutabilidade continua negando
   UPDATE depois disso (item 44).

**Efeito colateral desejado, não um quarto item:** as duas funções de backfill deixaram de viver em
`public` — agora são `private.aplicar_backfill_m1_taxonomia()` / `private.aplicar_backfill_m1_snapshots()`.
Não são API de produto, só ferramenta de migration/seed/reset administrativo, e `private` não está em
`schemas = ["public", "graphql_public"]` (`supabase/config.toml`) — a função simplesmente não existe
do ponto de vista do PostgREST, para nenhum papel, `service_role` incluído. O `revoke execute ...
from public, anon, authenticated` que as duas já tinham foi mantido como defesa em profundidade (mesmo
padrão de `private.hmac_cpf`), não é o que efetivamente bloqueia. As duas também deixaram de ser
`SECURITY DEFINER`: só rodam como `postgres` (migration/seed), que já tem acesso direto às tabelas —
`DEFINER` só se justifica quando quem chama precisa de um privilégio que não tem. Provado (itens
45–49): `anon` e `authenticated` recebem erro tentando `.rpc(...)` as duas funções; até `service_role`
via API REST não alcança (o bloqueio é a ausência da função no schema exposto, não um grant).

### Estado

**Prova integrada:** `scripts/test-m1-taxonomia.ts` (`npm run test:m1-taxonomia`) — **64 testes**
(44 da primeira rodada do Marco 1 + 20 do HARDENING FINAL), cobrindo canonicalização (regressão
leve), os dois shadows, as 10 relações, os invariantes em TODOS os sentidos provados (principal↔join,
cupom↔join, join→cupom reverso, estabelecimento_id↔categoria), os snapshots (captura incondicional +
imutabilidade + prova de recategorização + prova de injeção maliciosa), a transição, o legado intocado
(`categorias` = 6, `estabelecimento_categorias` = 7, views TX-P2A = 6/6/6), e a inacessibilidade das
duas funções de backfill via RPC para `anon`/`authenticated`/`service_role`. Cleanup de toda fixture
provado no próprio teste (nenhuma linha residual, `c01` de volta à categoria original, relação
`e1`/pizzaria de volta ao join).

✅ **`20260830160000` e `20260830170000`: aplicadas no hospedado e IMUTÁVEIS**, no mesmo apply que
`20260830150000`. Hashes SHA-256 validados antes e depois do apply:
`10282c0868b7d67bdd1730ee5f907444f1fee3dab9326047c58f42198c6469bb` (160000) e
`552f01ea4fa382cb6c66475964e02b675da8e6314aaab5b747f631f7cfc87727` (170000).
**CUTOVER (runtime lendo os campos-sombra em vez do legado) AINDA NÃO ACONTECEU** — views da TX-P2A
continuam 6/6/6, nenhuma tela lê `categoria_nova_id`/`categoria_principal_id`/
`estabelecimento_categorias_novas`. Publicar o schema não publicou o comportamento.

### PUBLICAÇÃO — apply hospedado (Supabase `bpeqpxvxgdyjjdcoycgp`, sa-east-1)

Autorizado explicitamente pelo responsável do projeto. Preflight completo (28 gates, read-only +
dry-run) rodou antes, sem nenhuma escrita; o apply real (`npx supabase db push --linked`) rodou uma
única vez, aplicando as três migrations em ordem (150000 → 160000 → 170000), exit code 0. Ledger
confirmado `local == remote` para as três logo em seguida.

**Estado hospedado confirmado pós-apply** (todas as contagens lidas do próprio banco de produção,
nenhuma assumida):

- `segmentos` = 14, `categorias_novas` = 75 (inalterados).
- `cupons` = 14, `categoria_nova_id` preenchido em **14/14**, 0 NULL, mapping **14/14** exatamente
  igual a `docs/taxonomia/depara-v1.json`.
- `estabelecimentos` = 6, `categoria_principal_id` preenchido em **6/6**, mapping **6/6** exato.
- `estabelecimento_categorias_novas` = **10** relações, conjunto idêntico ao de-para (zero extra,
  zero faltando), `e1 → fitness` confirmadamente ausente.
- `cupom_eventos` = 20508, `categoria_id` preenchido em **20508/20508**, 0 NULL, 0 referência órfã.
- `cupons_usuario` = 7, `categoria_id` preenchido em **7/7**, 0 NULL, 0 referência órfã.
- `pontos_transacoes`: COUNT = 11, SUM(pontos) = 2870 — **idênticos ao pré-apply**. Nenhuma das três
  migrations menciona essa tabela; confirmado tanto por leitura do texto quanto por leitura do banco.
- Legado intocado: `categorias` = 6, `estabelecimento_categorias` = 7. Views TX-P2A = **6/6/6**.
- Os 8 triggers do Marco 1 (reparent, cupom↔join, principal↔join, join→cupom reverso, captura +
  imutabilidade dos dois snapshots) confirmados instalados com a definição exata já testada local.
- `private.aplicar_backfill_m1_taxonomia` / `private.aplicar_backfill_m1_snapshots`: confirmadas
  **só** em `private` (zero cópia em `public`), `SECURITY DEFINER = false`, inalcançáveis via API —
  prova estrutural, nenhuma RPC foi chamada no hospedado.

**Nenhuma linha foi deletada.** Zero `DELETE` nos três arquivos, confirmado por leitura e por
resultado (nenhuma contagem caiu). `git push`/PR/merge tratados como GATE separado, registrados na
seção de Git deste repositório quando acontecerem — a publicação do SCHEMA não implica cutover de
runtime nem deploy de código.

---

## `20260831120000_m2_bridge_taxonomia.sql` — MARCO 2A · BRIDGE do cutover de runtime

**Status: aplicada e provada LOCAL. NÃO hospedada.** Nenhuma escrita foi executada no Supabase
`bpeqpxvxgdyjjdcoycgp` neste trabalho. As sete migrations anteriores da cadeia de taxonomia continuam
imutáveis; nenhum arquivo até `20260830170000` foi tocado.

Esta é a metade de BANCO do cutover: o Marco 1 publicou o schema novo em modo sombra, e o runtime
continuava 100% no legado. Aqui o banco passa a oferecer tudo de que o código novo precisa — o
contrato exato com o código antigo (o que continua funcionando e o que fica deliberadamente
congelado) está na seção seguinte.

### O contrato real da janela (corrigido no HARDENING FINAL)

A primeira versão deste documento dizia "o código antigo sobrevive integralmente" a esta migration.
**Isso nunca foi verdade** para CRIAÇÃO e RECATEGORIZAÇÃO de cupom, e a auditoria do HARDENING FINAL
(mesmo commit, migration ainda local) fechou o gap em vez de deixá-lo como uma lacuna silenciosa:

**Funciona sem mudança nenhuma**, entre esta migration hospedada e o runtime novo em produção:
leitura, discovery, navegação (views P2A/legado intocadas); resgate/ativação de cupom existente;
edição de cupom que **não muda a categoria**.

**Fica temporariamente bloqueado, de propósito**, só nesta janela:
- **CRIAR** cupom pelo runtime antigo — todo INSERT de `anon`/`authenticated` agora exige
  `categoria_nova_id`; o código antigo nunca a preenche.
- **MUDAR** a categoria legada de um cupom via API — qualquer UPDATE que troque `categoria_id`
  de valor (inclusive para NULL) é recusado para `anon`/`authenticated`/`service_role`.

Motivo: não existe informação suficiente no modelo antigo para escolher, com segurança, uma das 75
folhas novas — inventar essa escolha (de-para arbitrário) é proibido (ver seção "categoria_id
legado" acima). Isto é um **write-freeze deliberado e curto**, não um bug.

**Exceção documentada:** o requisito de `categoria_nova_id` no INSERT é aplicado só a
`anon`/`authenticated` — não a `service_role`. Neste projeto `service_role` nunca é o canal da
aplicação publicada (ver §"A `service_role` NUNCA é provisionada em plataforma de build" no
CLAUDE.md); é o papel usado por ~30 fixtures de regressão em suítes **anteriores ao Marco 1**
(`test-rls`, `fase3`, `fase4`, `fase5`, `fase6`, `fase6.5`, `fase9`, `fase9c`, `fase9d1` — nada
de taxonomia) que criam cupom só com `categoria_id`. Bloquear também `service_role` fecharia zero
caminho real e quebraria essas suítes sem necessidade. Já a limpeza de um shadow já definido
(UUID → NULL) **não tem essa exceção**: nenhum papel via API pode fazer isso, `service_role`
incluído — ele é operador de teste/migração, não sinônimo de "pode desfazer o cutover".

### Por que ela é aditiva, passo a passo

A migration vai ao ar **antes** do deploy do runtime novo, e isso só é seguro porque cada passo é
invisível ao código publicado hoje:

1. **três views novas** — ninguém as lê ainda;
2. **`cupons.categoria_id` vira nullable** — o código antigo sempre manda valor num INSERT (o caso
   que a nulidade serve é o do runtime NOVO);
3. **`checar_categoria_cupom`** ganha uma saída antecipada para NULL; o caminho de EDIÇÃO com valor
   preenchido e sem mudança continua validado como sempre — só a MUDANÇA de valor via API passou a
   ser recusada (hardening final);
4. **`checar_edicao_cupom`** passa a olhar `categoria_nova_id` **sem** deixar de olhar
   `categoria_id` — serve aos dois códigos ao mesmo tempo para o que continua permitido (edição
   sem trocar categoria);
5. **grants** são adição, nunca remoção;
6. **policies novas** da junção nova espelham as que a junção legada já tem, numa tabela que o
   código antigo não lê;
7. **HARDENING FINAL** — `checar_categoria_nova_cupom` (redefinida aqui via `create or replace`;
   nasceu na `20260830160000`, hospedada e imutável) passa a exigir `categoria_nova_id` em todo
   INSERT de `anon`/`authenticated`, e a recusar qualquer limpeza de um shadow já definido (UUID
   → NULL), em qualquer papel via API. Fecha o gap descrito no "contrato real" acima.

A ordem inversa (código primeiro) é impossível: o runtime novo não roda sem as views e o grant.

### Preconditions e postconditions — estruturais, não fotografadas

`raise exception` em qualquer divergência, antes de qualquer DDL. As condições são universais
("TODO cupom tem folha", "`count(*) = count(categoria_id)`"), não contagens do retrato de hoje:
hardcodar `20508` ou `cupons = 14` faria a migration falhar em qualquer instante que não fosse
aquele — inclusive no `db reset` local, onde no momento em que ela roda as tabelas de dado ainda
estão **vazias** (o `seed.sql` só roda depois de todas as migrations). Vazio satisfaz toda condição
universal, que é o comportamento correto. Os totais entram como `raise notice` — baseline
observável, nunca contrato. As duas únicas contagens exatas são as do CATÁLOGO (14 segmentos /
75 folhas), que vêm da TX-P2C e são idênticas em local e hospedado.

### O que ela faz

- **`catalogo_segmentos`** (14) — o que a descoberta pública OFERECE. Filtra `ativo`.
- **`catalogo_folhas`** (75) — as folhas ATRIBUÍVEIS agora. Filtra `ativo` nos dois níveis (folha e
  segmento). `icone`/`tema` já chegam resolvidos por `coalesce(folha, segmento)` — a herança é regra
  de modelo e vive no banco, não em 75 cópias no TypeScript, e é o que faz o app React Native
  receber a mesma resposta pelo mesmo PostgREST.
- **`folha_para_segmento`** (75) — folha → segmento + visual. **NÃO filtra `ativo`**, de propósito:
  é a view do HISTÓRICO. Carrega `ativo`/`segmento_ativo` para o form de edição distinguir
  "categoria atual, mantenha" de "categoria selecionável".

  As três views da TX-P2A ficam **intocadas** servindo o legado. São views NOVAS e não um
  `create or replace` das antigas porque o modelo novo guarda `tema` (token) onde o antigo guarda
  `gradiente` (CSS): a FORMA da relação muda, e mudar a forma exige DROP/CREATE, que derrubaria o
  código publicado no meio da janela. Expandir, nunca contrair.

- **`cupons.categoria_id` → nullable, escrita congelada.** A coluna é `text NOT NULL → categorias(id)`
  e `categorias` tem SEIS linhas: as folhas dos OITO segmentos que nunca existiram no legado
  (turismo-hotelaria, moda, automotivo, entretenimento, serviços, saúde, casa-decoração,
  infantil-maternidade) **não têm valor legado possível**, e inventar um de-para é proibido. Os
  cupons de hoje preservam o valor como rede de rollback; cupom novo nasce com NULL aqui e UUID em
  `categoria_nova_id`. Sem rename e sem drop: os dois quebrariam o código publicado no ato.

- **`checar_edicao_cupom` passa a enxergar `categoria_nova_id`** em `v_mudou_algo` **e** em
  `v_material`. Esta é a mudança menos óbvia e a mais importante: sem ela, com o grant de UPDATE
  concedido abaixo, trocar a categoria de um cupom seria um update "que não mudou nada" — retorno
  antecipado, zero registro em `moderacao_historico` e zero rebaixamento para moderação. Um lojista
  publicaria em "Restaurante", seria aprovado, e migraria para "Academia" sem nenhum moderador ver,
  pelo form ou pelo PostgREST direto.

- **`grant update (categoria_nova_id) on cupons to authenticated`** — uma coluna, só. O INSERT nessa
  coluna já existia (herdado do grant de tabela; a migration `20260830160000` revogou UPDATE, nunca
  INSERT). A barreira real não é o grant: é o par de triggers acima.

- **Junção nova vira operável.** A policy `using (true)` que o Marco 1 criou para a tabela SHADOW é
  substituída pelo trio que a junção LEGADA sempre teve — ao virar fonte de runtime ela passaria a
  expor ao anônimo os ids de estabelecimentos pendentes/suspensos, que `public.estabelecimentos`
  esconde. E "dono e admin leem" não é cosmético: é o que faz `/e/cupom/novo` listar categorias com
  o estabelecimento ainda pendente. Escrita: `grant insert, delete` + policies **só admin**, mesma
  decisão da Fase 4.

- **Vínculo NOVO exige folha ativa** (`checar_categoria_nova_ativa_no_vinculo`) — a outra ponta de
  `ativo`, que faltava. O cupom já tinha a regra; o estabelecimento não, e nada impedia criar um
  vínculo para uma folha fora de catálogo, que só falharia depois, na hora de criar o cupom.
  Não-retroativo, como todas as outras: só dispara em INSERT ou UPDATE que muda a chave.

### `ativo` — onde é filtro e onde não é

`ativo` governa **NOVA SELEÇÃO**, nunca o histórico.

- **É filtro** em: `catalogo_segmentos`, `catalogo_folhas`, `checar_categoria_nova_cupom`,
  `checar_categoria_nova_ativa_no_vinculo`, e no que os forms oferecem.
- **NÃO é filtro** em: `folha_para_segmento`, no predicado de descoberta
  (`idsFisicosDoFiltro` — cupom vivo numa folha desativada continua sob o chip do segmento), na RLS
  de `segmentos`/`categorias_novas` (`using (true)` — a tabela é catálogo de referência), nos
  snapshots, e na categoria ATUAL de um cupom em edição.

### Snapshots — contrato documentado

`cupom_eventos.categoria_id` e `cupons_usuario.categoria_id` são FATOS HISTÓRICOS. A pergunta "qual
era a categoria quando o fato ocorreu?" se responde por eles, **nunca** por
`cupons.categoria_nova_id` (que é a categoria *atual*). Nenhum relatório de hoje agrupa por
categoria — verificado: `cupom_metricas` e as views de métrica não mencionam categoria — então nada
precisou ser reescrito. O contrato fica registrado aqui e nos comentários das colunas.

### Decisões NOT NULL — explícitas, coluna a coluna

| Coluna | Decisão |
|---|---|
| `cupons.categoria_nova_id` | **NOT NULL fica para o CONTRACT**, migration separada, pós-deploy |
| `cupons.categoria_id` (legado) | **DROP NOT NULL** — sem isso não há como criar cupom nas 8 famílias novas |
| `cupom_eventos.categoria_id` | **continua NULL** — caminho de escrita mais quente do app; o trigger já garante o preenchimento, e um NOT NULL não adicionaria garantia, só um modo de falha novo (log de evento derrubando em produção) |
| `cupons_usuario.categoria_id` | **continua NULL** — mesmo raciocínio; a falha cairia em `ativar_cupom` |
| `estabelecimentos.categoria_principal_id` | **continua NULL** — não existe fluxo de criação de estabelecimento no código; `checar_principal_novo_no_conjunto` já garante o invariante. A precondition assere 6/6 hoje |
| `estabelecimentos.categoria_id` (legado) | **inalterada** (NOT NULL) — ninguém cria estabelecimento por código |

### ⚠️ A migration de CONTRACT (`20260831130000`) AINDA NÃO EXISTE — e não pode existir ainda

`supabase db push --linked` aplica **todas** as migrations pendentes de uma vez. Deixar o contract
pronto no diretório significaria aplicá-lo JUNTO com o bridge — e `categoria_nova_id SET NOT NULL`
quebraria a criação de cupom pelo código que está em produção agora, que não preenche essa coluna.

O contract só será escrito depois de, nesta ordem: (a) esta migration hospedada, (b) runtime novo em
produção, (c) smoke de produção passando. `scripts/test-m2-cutover.ts` tem uma asserção (40c) que
FALHA se um arquivo `20260831130000*` aparecer no diretório antes disso.

### Estado local provado

`npm run verify` **exit code 0** (capturado sem pipe — `| tail` devolveria o exit do `tail`), com
`db:reset` + 21 suítes + `next build`. Zero FAIL no log inteiro — rodado de novo depois do
HARDENING FINAL, mesmo commit.

- **`npm run test:m2-cutover`**: **75 PASS, 0 FAIL** (67 do runtime cutover + 8 do hardening final:
  A-G, mais E2). Cobre as três views (14/75/75), herança `coalesce` nas 75, não-escrita via view
  pelas três, RLS da junção nova nas quatro pontas (anon/dono/lojista/admin), `ativo` nos dois lados
  com folha desativada e reativada no cleanup, grant de UPDATE + rebaixamento para moderação com
  `editado_material` no histórico, os 14 ícones e os 14 temas registrados, o legado intocado
  (6 / 7 / views P2A 6/6/6) — **e agora também**: INSERT old-shaped de `authenticated` recusado
  (A), INSERT new-shaped aceito (B), `authenticated` **e** `service_role` recusados ao limpar
  `categoria_nova_id` para NULL (C/D — sem exceção de papel), `authenticated` recusado ao mudar
  `categoria_id` legado de um valor válido para outro (E), o MESMO valor continua gravável (F), e
  os 14 cupons canônicos do seed (via psql administrativo) saem com `categoria_nova_id` preenchida
  (G) — provando que o caminho administrativo não foi afetado pelo freeze.
- **Exceção testada, não presumida:** item 40b prova que `service_role` CONTINUA podendo criar
  cupom sem folha — design deliberado (ver "contrato real da janela" acima), não lacuna. Substituiu
  uma versão anterior deste teste que tentava provar nullability via `information_schema` através
  do PostgREST — inviável (PostgREST só expõe `public`; a chamada nunca testaria nada de verdade).
- **Regressões preservadas:** `test:tx-p2a` 63, `test:tx-p2b` 109, `test:tx-p2c` 71, `test:tx-p2d1`
  19, `test:m1-taxonomia` 65 — todas verdes, sem uma linha tocada por causa do hardening final
  (o freeze é invisível para quem já manda `categoria_nova_id` corretamente).
- **Blast radius do hardening, medido e resolvido:** o requisito "INSERT sem categoria_nova_id é
  recusado" tem, em tese, ~30 pontos de conflito em 10 suítes anteriores ao Marco 1
  (`test-rls`, `fase3`, `fase4`, `fase5`, `fase6`, `fase6.5`, `fase7-storage`, `fase9`,
  `fase9c`, `fase9d1`) que criam cupom via `service_role` só com `categoria_id`. Isento
  `service_role` (ver "contrato real" acima), restaram exatamente **3** pontos reais — os únicos
  que usam `authenticated`/`lojista`/`dono` para inserir cupom sem folha:
  `test-fase4.ts` (fixture "fitness (dentro)"), `test-fase6.ts` (fixture de auto-publish) e
  `test-fase9d1.ts` (`base` compartilhado da "nova campanha"). Os três ganharam
  `categoria_nova_id` resolvido dinamicamente contra `estabelecimentos.categoria_principal_id` de
  e1 — mudança mecânica de 1 campo, sem tocar a lógica ou as asserções de cada teste
  (`test:fase4` 42 PASS, `test:fase6` 177 PASS, `test:fase9d1` 87 PASS, todas inalteradas).
- **Contratos que mudaram de propósito** (reescritos, não acomodados): `test-m1-taxonomia` itens 34
  (a `using (true)` da junção shadow deu lugar à policy de estabelecimento ativo) e 37 (o grant de
  UPDATE em `categoria_nova_id` passou a existir; a garantia deixou de ser "não há grant" e passou a
  ser o par de triggers). `test-tx-p2a` bloco H: a prova ESTRUTURAL continua a mesma ("estas telas
  consomem a metade operacional da fronteira"), só o nome da função mudou, porque `ativo` separou o
  catálogo operacional em `buscarCatalogoFolhas` (o que se pode escolher) e
  `buscarCatalogoResolucao` (o que uma folha já atribuída é). O arquivo em si **não** ficou
  intocado — só o SQL/views P2A hospedado é que continua imutável.
- `database.types.ts` regenerado: 1293 → **1413 linhas**, sentinelas presentes, não truncado.

### Zero consumer funcional do legado

Busca ESTRUTURAL por `.from()` (e não `grep categoria_id`, que engana — `categoria_id` também é o
nome da coluna em `estabelecimento_categorias_novas`, `catalogo_folhas` e `folha_para_segmento`):
**nenhum** `.from("categorias")`, `.from("estabelecimento_categorias")`, `.from("catalogo_filtros")`,
`.from("catalogo_categorias")` ou `.from("categoria_para_filtro")` em `src/`. Todo hit remanescente
de `categoria_id` pertence a uma relação NOVA.

### Line endings — prova canônica de imutabilidade

`core.autocrlf = true` (global) e não existe `.gitattributes`. Medido nesta máquina: para as três
migrations hospedadas, `sha256sum` do working tree **diverge** de `git show <commit>:<path> |
sha256sum`, enquanto `git hash-object <path>` bate exatamente com o blob de
`git rev-parse <commit>:<path>`.

A prova de que uma migration versionada não mudou é `git rev-parse <commit>:<path>` (ou
`git hash-object <path>`, que aplica o filtro `clean`). `sha256sum` do working tree **não serve** e
daria falso positivo de alteração. Para migration ainda não commitada, validar o arquivo que o CLI
de fato lê, antes do apply. **Não normalizar as migrations existentes** — isso reescreveria blobs de
arquivos hospedados e imutáveis.

---

## `20260831130000_m2_contract_taxonomia.sql` — MARCO 2B · CONTRACT da taxonomia (LOCAL, NÃO HOSPEDADA)

**Status: aplicada e provada LOCAL. NÃO hospedada.** Nenhuma escrita foi executada no Supabase
`bpeqpxvxgdyjjdcoycgp` neste trabalho — as únicas interações com o projeto hospedado (via MCP)
foram leituras (`execute_sql`/`query_logs` com `select`, `show log_statement`), nenhum
insert/update/delete/DDL. `20260831120000` continua imutável: blob
**`8d1d5b3a8cbaafb3c7031caac1d03648182d1eef`**, confirmado idêntico (`git rev-parse
HEAD:<path>` == `git hash-object <path>`) antes e depois deste trabalho. Nenhuma migration anterior a
`20260831130000` foi editada.

### MARCO 2A — fechamento formal

**PASS.** `20260831120000_m2_bridge_taxonomia.sql` hospedada; runtime 14×75 em produção. PR #8
merged (merge SHA `038fac47cc2ace7f471c6de6b5658382d391e41b`), deployment
`dpl_8mhXYvQhQPUTR2PGmmeGMSG2LGt3` READY. Write-freeze do bridge encerrado. Smoke real de produção
provou: `authenticated` QA → INSERT `categoria_nova_id` UUID com `categoria_id` legado NULL → PASS;
recategorização Restaurante→Pizzaria → PASS; `moderacao_historico` registrando `editado_material` →
PASS.

### Anomalia da fixture QA no smoke de produção — investigada, classificação B

Durante o smoke, uma fixture criada/recategorizada/excluída via `excluir_cupom` deixou de existir
fisicamente minutos depois, sem DELETE explícito no relatório do smoke. Investigação READ-ONLY, sem
nenhuma operação destrutiva:

- **`excluir_cupom`** (migration `20260818130000`) é exclusivamente soft-delete —
  `update ... set status = 'excluido'`, nenhum `delete` — confirmado lendo a função linha a linha.
- **Nenhum trigger, rule, event trigger ou FK em `public.cupons`** executa DELETE físico. Auditado via
  busca estrutural em todas as migrations: os únicos `on delete cascade` apontam DE
  `cupom_eventos`/`cupons_usuario` PARA `cupons` (o inverso do que causaria isto); as FKs de categoria
  são `on delete restrict`.
- **Nenhuma Edge Function** existe no repositório (`supabase/functions` não existe).
- **`postgrest_logs` e `edge_logs`** (últimas 24h, via Supabase MCP) não mostram nenhuma requisição
  DELETE contra `cupons` no período.
- **`postgres_logs`** não é conclusivo: `log_statement = ddl` no projeto (confirmado via
  `show log_statement`), então DML comum (INSERT/UPDATE/DELETE, inclusive via psql/service_role) nunca
  é logado ali, só DDL. Ausência de evidência aqui não é evidência de ausência.
- **Contagens hospedadas no momento da auditoria:** `cupons` = 14 linhas (exatamente o baseline
  canônico), 0 órfãos em `categorias_novas`, 0 fora da junção do próprio estabelecimento — nenhum sinal
  de impacto em registro preexistente/real.

**Classificação: B — causa não determinada.** Nenhum mecanismo de hard-delete foi encontrado no
banco/runtime auditado, e não houve evidência de impacto nos dados preexistentes. Uma ação externa ao
runtime auditado (por exemplo, cleanup manual fora da API REST) é possível, mas **não foi comprovada**
— não há log, rastro ou confissão que sustente essa hipótese especificamente sobre qualquer outra.
Não é C: não há mecanismo desconhecido capaz de apagar cupons reais.

### Decisões NOT NULL — coluna a coluna, com a prova

| Coluna | Decisão | Prova (hospedado, no momento da auditoria) |
|---|---|---|
| `cupons.categoria_nova_id` | **SET NOT NULL** | 14/14 preenchidos, 0 órfão, 0 fora da junção |
| `cupom_eventos.categoria_id` | **SET NOT NULL** | 20508/20508 preenchidos, 0 órfão; trigger sempre deriva de `cupons.categoria_nova_id`, que passa a ser sempre não-nulo nesta mesma migration — fecha a única origem legítima de NULL |
| `cupons_usuario.categoria_id` | **SET NOT NULL** | 7/7 preenchidos, 0 órfão; mesmo raciocínio |
| `estabelecimentos.categoria_principal_id` | **continua NULLABLE** | Busca estrutural por `.from("estabelecimentos").insert` em `src/` não encontrou NENHUM caminho de criação de estabelecimento — só `supabase/seed.sql` (roda como `postgres`, fora de grant/RLS). NOT NULL protegeria um fluxo que não existe no runtime |

As duas linhas de snapshot **superam, não contradizem**, a decisão registrada na seção do Marco 2A
acima ("`cupom_eventos.categoria_id` continua NULL... um NOT NULL não adicionaria garantia, só um modo
de falha novo"). Aquele texto foi escrito quando `categoria_nova_id` AINDA era nullable, e o risco que
citava — evento/ativação falhando porque o cupom-fonte não tinha folha ainda — é exatamente o risco
que a linha `cupons.categoria_nova_id` elimina na origem, nesta mesma migration. A premissa mudou; a
conclusão muda com ela.

### Blast radius de fixtures — inventário e migração

Toda fixture POSITIVA de cupom (`.from("cupons").insert(...)`) que ainda fabricava cupom só com
`categoria_id` legado ganhou `categoria_nova_id`, resolvida DINAMICAMENTE contra
`estabelecimentos.categoria_principal_id` (ou o de-para exato do catálogo, no caso do seed) — nunca um
UUID hardcoded solto. Intenção de cada suíte preservada; só o fixture ganhou o campo:

- `scripts/test-fase3.ts` — 2 fixtures (`PEND`, `PEND_REJ`).
- `scripts/test-fase4.ts` — 4 fixtures (`BUG1`, `BUG1-exp`, `NOVO`, `ANTIGO`); "fitness (dentro)" já
  vinha migrada do Marco 2A.
- `scripts/test-fase5.ts` — `base` compartilhado (5 fixtures: `LEGADO`, `DENTRO`, `FORA_DIA`,
  `FORA_HORA`, `LIMITE2`).
- `scripts/test-fase6.ts` — `base` compartilhado (`FIXO`, `VARIAVEL`, `ILIMITADO`, `LIMITADO`,
  `NOVO`); `AUTO` já vinha migrada do Marco 2A.
- `scripts/test-fase65.ts` — `baseCupom` compartilhado (`BASE`, `CICLO`, `LEGADO`).
- `scripts/test-fase9.ts` — 4 fixtures (`CUPOM_F9`, `CUPOM_RECUSA`, fila A/B, janela controlada A-E).
- `scripts/test-fase9c.ts` — `base` compartilhado (`CUPOM_IMG`, `CUPOM_JAN`, `CUPOM_EXCL`,
  `CUPOM_VIVO`).
- `supabase/seed.sql` — os 14 cupons canônicos: `categoria_nova_id` resolvida por slug (os mesmos
  pares `(segmento_slug, categoria_slug)` de `docs/taxonomia/depara-v1.json` / da CTE
  `depara_cupons` em `20260830160000`) DENTRO do próprio INSERT, porque o padrão antigo (nasce NULL,
  backfill via UPDATE depois) deixou de funcionar sob NOT NULL — o UPDATE de
  `aplicar_backfill_m1_taxonomia()` só toca `where categoria_id is null`, e não dá mais para nascer
  NULL. A chamada que faz efeito real foi antecipada para ANTES do INSERT de cupons (a junção nova
  precisa existir primeiro, por causa do trigger `checar_categoria_nova_cupom`); as duas chamadas no
  fim do arquivo viraram verificação idempotente, não o mecanismo que preenche. É uma TERCEIRA
  expressão do mesmo mapeamento de 14 linhas (a segunda é a CTE em `160000`) — migrations anteriores
  são imutáveis, então não havia como evitar; se `depara-v1` mudar, as três precisam mudar juntas.

**8 arquivos de teste + o seed migrados — 22 fixtures de cupom.** Fixtures NEGATIVAS (testam rejeição
por outro motivo — `test-fase4.ts` "pet fora do conjunto", `test-rls.ts` "anon não insere",
`test-m2-cutover.ts` item A "old-shaped") não precisaram de `categoria_nova_id`: continuam sendo
rejeitadas pelo TRIGGER, que dispara antes da constraint física ser avaliada — comportamento
inalterado, intenção preservada.

**Dois itens mudaram de PROPÓSITO** (reescritos, não acomodados — mesma doutrina dos itens 34/37 do
Marco 2A):

- `test-m2-cutover.ts` item **40b**: provava que `service_role` continuava isento por design. Agora
  prova que a isenção do TRIGGER não sobrevive à constraint FÍSICA — `service_role` também é recusado
  (`23502 not_null_violation`). Item **40c**: a guarda que falhava se `20260831130000` existisse antes
  do smoke de produção passar foi invertida — agora confirma que o arquivo existe.
- `test-m1-taxonomia.ts` itens **29/30**: provavam que o fluxo legado sobrevivia com shadow NULL
  (write-freeze transitório). Agora provam que esse caminho está fechado (`23502`) e que shadow NULL
  não existe mais em lugar nenhum.

### Preconditions/postconditions — mesma doutrina estrutural da 120000

Fail-high, `count(*) = count(coluna)` / zero-órfão, nunca contagem fotografada (`cupons=14` etc. entra
só como `raise notice`). **Corrigido em iteração (auditoria local):** a primeira versão da
postcondition checava `count(*) from public.categorias/estabelecimento_categorias` esperando >0 —
errado, porque essas tabelas são populadas por `supabase/seed.sql`, não por migration, e estão
legitimamente vazias no momento em que a migration roda dentro de `db reset` (mesmo raciocínio do
"vazio satisfaz condição universal" que a 120000 já aplicava a `cupons`). Corrigida para checar
EXISTÊNCIA da tabela (`information_schema.tables`), não contagem de linhas — o erro só apareceu
porque `db reset` de verdade rodou e falhou alto, exatamente o que uma precondition/postcondition
fail-high deve fazer.

**Corrigido em iteração (preflight de hospedagem):** a postcondition original só verificava, via
`information_schema`, as três colunas que a migration ALTERA (`cupons.categoria_nova_id`,
`cupom_eventos.categoria_id`, `cupons_usuario.categoria_id`) mais `cupons.categoria_id` legado. Não
afirmava estruturalmente que `estabelecimentos.categoria_principal_id` continua `YES` (nullable), nem
que `categorias_novas`/`estabelecimento_categorias_novas` continuam existindo — invariantes que a
migration DELIBERADAMENTE não toca, mas que só estavam provados por leitura externa (`psql` fora da
migration), não pelo próprio artefato que será hospedado. Adicionadas as verificações que faltavam:
`estabelecimentos.categoria_principal_id` = `YES` e `exists()` para as duas tabelas novas — mesmo
padrão já usado para `categorias`/`estabelecimento_categorias` legado. `db:reset` + `verify` completo
rodados de novo depois da adição: mesmo resultado (1152 PASS / 0 FAIL), confirmando que a checagem
nova não altera nenhum comportamento, só fecha uma lacuna de prova.

### DDL — `NOT VALID` + `VALIDATE` + `SET NOT NULL`

Mesmo padrão de duas etapas já usado em `20260802120000` (`cupons_prazo_ativacao_min`):
`add constraint ... check (col is not null) not valid` → `validate constraint` (varre e falha alto se
houver violação) → `alter column ... set not null` → `drop constraint` (a CHECK temporária vira
redundante; NOT NULL já é a garantia definitiva). Com a CHECK já validada cobrindo a coluna, o
Postgres 12+ **pula o scan completo da tabela** na etapa `SET NOT NULL` — mas essa etapa **ainda
exige um lock breve de alteração de schema** (a definição da coluna muda no catálogo); isto não é
"lock zero", é trabalho de scan evitado. Relevante sobretudo para `cupom_eventos`, que já tem 20508
linhas hoje e só cresce: sem CHECK validada antes, um `SET NOT NULL` direto faria um scan bloqueante
proporcional ao tamanho da tabela, além do lock de catálogo que ocorre de qualquer forma. Com ~20 mil
linhas o risco operacional esperado é baixo, mas a janela de lock existe e não deve ser documentada
como inexistente.

### Comentários atualizados via `comment on` (não edita migrations anteriores)

`cupons.categoria_nova_id`, `cupom_eventos.categoria_id`, `cupons_usuario.categoria_id` e a função
`checar_categoria_nova_cupom()` ganharam `comment on` novos nesta migration — o texto "shadow,
STAGING"/"continua NULL" da `160000`/`170000`/`120000` deixou de descrever o estado real. Isto não
edita o arquivo daquelas migrations (que continuam imutáveis, blobs intactos): é uma instrução `comment
on` nova, como de costume neste repositório.

### O que continua igual

Sem DROP, sem RENAME, sem cleanup físico. `public.categorias` (6 linhas), `estabelecimento_categorias`
(7 linhas), `cupons.categoria_id` (legado, nullable, congelado desde o Marco 2A) — todos intocados.
`checar_categoria_nova_cupom` não foi simplificado nem removido: continua a autoridade de NEGÓCIO
(membership no conjunto do estabelecimento, folha ativa, proibição de limpar shadow UUID→NULL via
API); a constraint física é defesa em profundidade sobre um invariante mais estreito (a coluna não
pode estar vazia), não substituição do trigger.

### Testes e verify

`test:m2-cutover` 75 PASS · `test:m1-taxonomia` 65 PASS · `test:tx-p2a` 63 · `test:tx-p2b` 109 ·
`test:tx-p2c` 71 · `test:tx-p2d1` 19 · `test:fase3` 22 · `test:fase4` 42 · `test:fase5` 64 ·
`test:fase6` 177 · `test:fase65` 44 · `test:fase9` 57 · `test:fase9c` 72 · `test:fase9d1` 87 —
contagens inalteradas em toda suíte à exceção dos dois itens reescritos acima (que trocaram de
propósito, não de contagem). **`npm run verify` (sem pipe, exit code capturado direto): 0.**
`db:reset` + 21 comandos de suíte (1152 PASS, 0 FAIL no total) + `next build` — build completo, sem erro.
`database.types.ts`: 1413 → **1414 linhas**, sentinelas presentes
(`profiles`/`estabelecimentos`/`cupons`/`cupons_usuario`), não truncado; `cupons.categoria_nova_id`,
`cupom_eventos.categoria_id` e `cupons_usuario.categoria_id` saem sem `| null` no tipo `Row` gerado —
`cupons.categoria_id` (legado) mantém `| null`.

### Blob/hash

`20260831120000`: **`8d1d5b3a8cbaafb3c7031caac1d03648182d1eef`** — inalterado (ver confirmação no
topo desta seção).

`20260831130000` (local, ainda não hospedada): **`6e58d532b41401cd4561dec995743b8ca3f2e2c6`** —
arquivo real que o CLI aplicaria, conferido via `git hash-object` (hash recalculado depois da adição
das checagens de `estabelecimentos.categoria_principal_id`/`categorias_novas`/
`estabelecimento_categorias_novas` na postcondition, descrita acima).

### Consequência do rollback, depois de hospedar

Registrado explicitamente antes de qualquer decisão de hospedar: **depois que `20260831130000` for
aplicada no hospedado, não será mais seguro fazer rollback (Instant Rollback ou deploy de código
antigo) para um runtime pré-Marco-2 que cria cupom sem `categoria_nova_id`.** Isto é **intencional** —
é o próprio propósito do contract: transformar o UUID de requisito "esperado pelo runtime novo" em
requisito estrutural permanente do banco, que nenhum código, papel ou via de escrita pode contornar.

Na prática:
- Rollback de **código** continua possível, mas só para versões que já preenchem
  `categoria_nova_id` no INSERT (o runtime atual, pós-Marco-2A, já preenche — ver "MARCO 2A" acima).
  Um rollback para antes do Marco 2A (código que só manda `categoria_id` legado) passaria a falhar
  toda criação de cupom com `23502 not_null_violation`, para qualquer papel, service_role incluído.
- **Legado físico permanece no banco** (`categorias`, `estabelecimento_categorias`,
  `cupons.categoria_id`) para investigação ou cleanup futuro (Marco 3) — mas sua presença NÃO
  significa que o banco volta a aceitar escrita no formato pré-cutover. O contract é sobre ESCRITA
  NOVA, não sobre leitura do histórico.
- O caminho de reversão seguro, se necessário depois de hospedar, é **rollback de schema** (nova
  migration que reverte `SET NOT NULL` para nullable) — não Instant Rollback de deployment, que reverte
  só o código, nunca o banco.

### GATE 19 — nada foi hospedado

Nenhum `supabase db push --linked`, nenhuma escrita SQL contra o hospedado, nenhum push, PR, merge ou
deploy neste trabalho. Confirmações:

- **`20260831120000` NÃO FOI ALTERADA.**
- **`20260831130000` EXISTE APENAS LOCALMENTE e NÃO FOI HOSPEDADA.**
- **NENHUMA ESCRITA FOI EXECUTADA NO SUPABASE HOSPEDADO NESTE TRABALHO** — as únicas interações com o
  projeto hospedado, via Supabase MCP, foram leituras (`execute_sql`/`query_logs` com `select`,
  `show log_statement`); nenhum insert/update/delete/DDL.
- **O CONTRACT FINAL NÃO REMOVEU NENHUMA ESTRUTURA LEGADA.**

---

## CLIENT-RETURNS-01 — logo do estabelecimento + edição admin de cupom

| # | Arquivo | O que faz |
|---|---|---|
| 36 | `20260902120000_cr01_estab_logo.sql` | Coluna `estabelecimentos.logo` (path no bucket `cupom-imagens`, mesmo contrato de `cupons.imagem`) + `grant update (logo)`. |
| 37 | `20260902130000_cr01_admin_editar_cupom.sql` | RPC `admin_editar_cupom(text, jsonb)` — admin corrige campos permitidos; recusa `estabelecimento_id`/`status`/`categoria_id`/`moderacao_historico`; append `editado_admin`. |

> **Obs. 36:** nome e cidade já eram graváveis (migration 12). A logo reusa o bucket e as policies da Fase 7 — pasta por `estabelecimento_id`, magic bytes na Action. Galeria (várias fotos) ficou de fora: exigiria ordem/legenda/lugar×produto.

> **Obs. 37:** admin não tem policy de UPDATE em `cupons`. O trigger `checar_edicao_cupom` isenta admin e portanto não grava histórico — a RPC grava à mão. Não rebaixa para pendente: o admin é o revisor (pedido do cliente era corrigir sem rejeitar e recriar). `categoria_id` legado continua congelado.

> **Não hospedada neste WP.** Local only até autorização de deploy.

### Preflight de hospedagem — read-only, aguardando autorização

Rodado depois das duas correções documentais acima e da adição da postcondition do Gate 8. Tudo
read-only contra o hospedado; nada aplicado.

- **Ledger** (`npx supabase migration list --linked`): `local == remote` para toda migration até
  `20260831120000` inclusive. Única pendência: `20260831130000` (`remote` vazio).
- **Dry-run** (`npx supabase db push --linked --dry-run`, exit 0): lista **exclusivamente**
  `20260831130000_m2_contract_taxonomia.sql`. Nenhuma outra migration pendente.
- **Baseline hospedado imediato:** `cupons` 14 total / 0 NULL em `categoria_nova_id`; `cupom_eventos`
  20508 total / 0 NULL em `categoria_id`; `cupons_usuario` 7 total / 0 NULL em `categoria_id`; 0
  órfãos nas três relações; 0 cupom fora da junção do próprio estabelecimento — idêntico ao medido na
  auditoria anterior (nenhuma escrita ocorreu no meio tempo).
- **Schema hospedado pré-contract** (`information_schema.columns`): as três colunas-alvo ainda
  `is_nullable = YES` (nenhum apply parcial/externo); `estabelecimentos.categoria_principal_id` e
  `cupons.categoria_id` também `YES`, como esperado.
- **Runtime em produção:** `dpl_8mhXYvQhQPUTR2PGmmeGMSG2LGt3` continua `READY`, `production`, commit
  `038fac4`/`main` — sem novo deployment desde o Marco 2A. Não foi feito novo smoke de escrita (só
  confirmação de saúde/identidade do deployment).

---

## CLIENT-RETURNS-02 — descoberta do consumidor (filtros, geo, preferências, planos)

| # | Arquivo | O que faz |
|---|---|---|
| 38 | `20260902140000_cr02_descoberta_consumidor.sql` | Enum `tipo_promocao` + `cupons.valor_compra_minimo`; `estabelecimentos.bairro/latitude/longitude` (par + range); tabelas `preferencias_usuario`, `consentimentos_usuario`, `aceites_documento` (RLS dono); `handle_new_user` grava aceite versionado; RPCs batch `sinais_descoberta` / `estoque_cupons`; `checar_edicao_cupom` e `admin_editar_cupom` passam a enxergar tipo/mínimo. |

> **Obs. 38:** lat/lng do **consumidor** não entram no banco — só as coordenadas públicas do ponto de venda. Default `tipo_promocao='desconto'` é o tipo genérico do schema (janela código-antigo), não adivinhação de título. `valor_compra_minimo` NULL = sem piso. Consentimento é `(usuario, finalidade, versao, concedido_em, revogado_em)`, não um boolean solto. Recusar personalização não bloqueia o app.

---

## PRE-CALL-FIX-02 — paridade validação código ↔ CPF

| # | Arquivo | O que faz |
|---|---|---|
| 39 | `20260902160000_pre_call_validacao_cpf.sql` | `validar_cupom`: autoridade com `owner_id is distinct from uid` (NULL deixa de falhar aberto). Backfill `e3..e6.owner_id ← e1.owner_id` quando e1 já tem dono. |

> **Obs. 39:** Causa raiz do sintoma "CPF não acha / código valida": órfãos e3..e6 + `<>` vs NULL. `buscar_ativacoes_por_cpf` não muda — já usava `estabs_do_dono()`. Seed-users passa a ligar e3..e6 ao lojista no reset local. **CRM-01:** a migration local (nunca hospedada) foi renumerada para `20260907130000_product_complete_web_crm.sql`.

> **Não publicar ainda** neste WP — só implementação/teste local no lote pré-call.

---

## CLIENT-CALL-CLOSURE-01 — pausa, indicadores de vitrine, UX de reativação

| # | Arquivo | O que faz |
|---|---|---|
| 40 | `20260907120000_client_call_coupon_pause_metrics.sql` | RPCs `pausar_cupom` / `retomar_cupom` (owner only, `indisponivel` = pausado); RPC batch `indicadores_vitrine_cupons` (ocupados/disponíveis/resgates confirmados, sem PII); `ativar_cupom` trava a linha sempre (fronteira pausa×ativação); `validar_cupom` carimba `esgotado` também a partir de pausado. |

> **Obs. 40:** Não reescreve `janela_alcance` nem a conta de reserva (`validado + ativo vigente`). A pausa não invalida códigos já emitidos. Retomar recusa expirado/esgotado/excluído/pendente/rejeitado — não pula moderação nem validade. **CRM-01:** a migration local (nunca hospedada) foi renumerada para `20260907130000_product_complete_web_crm.sql`, depois desta.

---

## PRODUCT-COMPLETE-WEB / CRM-01 — clientes do estabelecimento (portal)

| # | Arquivo | O que faz |
|---|---|---|
| 41 | `20260907130000_product_complete_web_crm.sql` | Índice parcial `cupons_usuario` (validado); `private.crm_exportacoes` (auditoria sem PII); RPCs `crm_clientes`, `crm_cliente_detalhe`, `crm_export_dados`, `crm_registrar_exportacao` (SECURITY DEFINER, posse via `owner_id = auth.uid()`, e-mail só via `auth.users`, sem CPF). |

> **Obs. 41:** relação CRM = só `cupons_usuario.status = 'validado'` nos cupons do estabelecimento da sessão. Ativo/expirado sem validação não entra. Sem tabela desnormalizada de clientes. Exportação xlsx/pdf no app; a tabela private só guarda metadados (formato, contagens, filtros não-PII). Renumerada de `20260902150000` (nunca hospedada) para depois de `20260907120000`. `crm_estab_da_sessao` escolhe `order by id limit 1` — alinhado a `estabs_do_dono()` após o seed multi-estab do FIX-02.

> **Não hospedada neste WP.** Local only até autorização de deploy. Não edita migrations ≤ `20260907120000`.

