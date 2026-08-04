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

**Estado:** 21 aplicadas, local e hospedado alinhados (`21 = 21`).

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
