# FASE 2 — Relatório de Implementação (Regras de negócio no servidor)

*Branch: `fase-2-regras-servidor` · Data: 2026-07-13 · Status: **concluída e validada***

---

## 1. O que foi feito (por entrega/commit)

| Commit | Entrega |
|---|---|
| `2d8efea` | M5 (enums `pendente`/`bonus`) + M6 (índice parcial de ativação, índice de idempotência do ledger, prazo default 5h) + seed com **datas relativas** |
| `94085ec` | M7: RPCs `security definer` (`ativar_cupom`, `validar_cupom`, `responder_nps`, `registrar_evento_cupom`, `saldo_pontos`, `meu_estado_consumidor`) + **revoke** dos grants diretos de escrita; test-rls adaptado (25 asserções) |
| `879b21b` | Seed Fase 2 (lojista2, CPF do consumidor, bônus de boas-vindas) + `test-fase2.ts` (27 asserções de fluxo) + `npm run verify` |
| `330d1da` | App do consumidor: Server Actions, provider hidratado do banco (`key` por usuário), ciclo real, polling, NPS, eventos, pontos reais, card-convite anônimo, `gamification` lê da config |
| `8b35ac6` | Portal: validação real (transação) + criação de cupom persistida (status `pendente`, campos completos) |
| `6a2df3e` | Admin: tabela de pontos lida de `config_pontos` (mata a duplicação na leitura) |
| *(este)* | README + este relatório |

## 2. Critérios de aceite — como cada um foi provado

1. **Ativar cupom → linha em `cupons_usuario`; reload mantém o mesmo código** ✅
   E2E (Playwright): consumidor ativa `c02` → código **PRMF-4DGX-DU82** aparece no sheet; SQL confirma a linha (`status='ativo'`, `expira_em ≈ +5h`); após reload, "Ver cupom ativo" reabre com **o mesmo código**. O comportamento "zera no reload" da demo morreu.
2. **Lojista valida o código real → consumidor vê "utilizado", pontos sobem, evento e ledger batem** ✅
   E2E: lojista valida **PRMF-SM23-FKQY** no portal → dados reais (título, nome, CPF **123.***.***-09** mascarado no SQL); as métricas do portal subiram de eventos reais (Resgates 1.395 → 1.397). No fluxo do consumidor, o **polling (5s)** detectou a validação e abriu o NPS sozinho; o extrato final em `pontos_transacoes` = **bônus 1250 + resgate 50 + nps 30 = 1330** (SQL).
3. **Código de outro estabelecimento, expirado ou já validado → erros distintos, nada gravado** ✅
   `test-fase2` prova: `lojista2` (e2) validando código do e1 → `outro_estabelecimento`; código forçado a expirar (service_role) → `expirado`; revalidar → `ja_validado`; consumidor chamando `validar_cupom` → `sem_permissao`; lojista no próprio cupom → `cupom_proprio`. Em todos, o ledger não muda.
4. **NPS grava uma vez e credita uma vez (repetir não duplica)** ✅
   E2E + `test-fase2`: responder → credita `nps`; responder de novo → `ja_respondido`, saldo inalterado (índice único `(usuario_id, acao, referencia_id)` + `on conflict do nothing`).
5. **Cupom criado no portal persiste, sobrevive a reload, campos completos** ✅
   E2E: "Sobremesa grátis no jantar" salvo → SQL mostra `status='pendente'`, `prazo_ativacao_horas=5`, `limite_por_usuario=1`, `limite_total=500`, `horarios` jsonb com `dias/inicio/fim` (campos antes **descartados**); após reload aparece no topo com chip **"Em análise"**.
6. **`npm run verify` verde do zero** ✅
   `db:reset` (6 migrations + seed + seed-users) → `test:rls` **25/25** → `test:fase2` **27/27** → `next build` compila. As datas relativas garantem que a suite continua verde nos próximos meses.

## 3. Como as regras vivem no servidor

```
Ação do usuário → Server Action ("use server") → RPC security definer (1 transação)
                                                     ├─ checa papel/posse/limites/validade
                                                     ├─ muta cupons_usuario / cupom_eventos / pontos_transacoes
                                                     └─ retorna {ok, ...} | {ok:false, motivo}
```

- **`ativar_cupom`**: exige sessão; expira lazy vencidas; idempotente (reativação vigente e corrida via constraint-aware retry); valida cupom/estabelecimento ativos, janela BRT, `limite_por_usuario` (validadas + ativas vigentes) e `limite_total`; grava evento `ativacao`; código gerado no banco.
- **`validar_cupom`**: exige posse do estabelecimento; motivos distintos; **recheck lockado de `limite_total`**; numa transação: `status='validado'`, evento `validacao`, crédito `resgate`. CPF mascarado no SQL — CPF completo nunca sai para o portal.
- **`responder_nps`**: idempotente; credita `nps` uma vez.
- **`registrar_evento_cupom`**: só `visualizacao`/`clique`, cupom visível, dedup 1/usuário/cupom/dia (BRT), anônimo é no-op.
- **`saldo_pontos` / `meu_estado_consumidor`** (invoker): leitura sob RLS; hidratam o app em 1 round-trip.
- **Escrita direta bloqueada**: `revoke insert, update on cupons_usuario from authenticated` — a RPC é o único caminho (test-rls prova `42501`).

## 4. Decisões relevantes (D-F2)

| # | Decisão |
|---|---|
| D2 | `limite_por_usuario` conta **validadas + ativas vigentes** (expiradas liberam vaga) — divergência consciente da letra "contar ativações"; guarda anti-farm de expiradas fica para a Fase 3 |
| D5/D6 | Prazo de ativação padrão **5h**; seed com **datas relativas** (`current_date + N`) para a checagem de validade não matar a demo nem apodrecer a suite |
| D7 | "Hoje" de negócio = **America/Sao_Paulo** (`hoje_brt()`) na validade e no dedup — cupom "válido até X" não morre 21:00 BRT; alinhado ao `formatShortDate` |
| D8 | Saldo real = `SUM(pontos_transacoes)`; `SALDO_BASE` removido. Consumidor de demo mantém 1250 via **lançamento `bonus` "Bônus de boas-vindas"** (`referencia 'bonus:<uid>'`, por usuário) |
| D13 | `m/layout` lê cookies ⇒ **todo `/m` é dinâmico** (aceito); hidratação em 1 RPC com try/catch → anônimo se o banco cair; `src/app/m/error.tsx` como boundary |
| D14 | Provider com `key={userId}` — login/logout re-hidratam (sem estado obsoleto/vazado) |
| D16 | Consumidor vê "utilizado" por **polling 5s** (flip → NPS automático); botão "Simular validação" removido |
| D20 | `criarCupomAction` deriva `estabelecimento_id` do `owner_id` (nunca do form); `validade_fim` obrigatória; nasce `pendente` |

## 5. Segurança — resumo

- Transições de estado **só** por RPC `security definer`; cliente nunca escreve `status`/`validado_em`/`codigo`/`pontos`. `test-rls` prova `42501` no INSERT/UPDATE direto.
- Idempotência de pontos garantida por índice único + `for update` (dupla validação/NPS não credita em dobro).
- CPF completo nunca trafega para o portal (mascarado no SQL).
- `service_role` só em `scripts/` (Node local); actions usam RPC, não service_role.
- `registrar_evento_cupom` não deixa forjar `validacao`/`ativacao` nem inflar métrica de cupom invisível.

## 6. Telas ainda no mock (fora de escopo desta fase)

`/m/buscar`, `/m/favoritos` (agora **filtram** por estabelecimento ativo, espelhando a RLS), `/m/cupom/[id]` (detalhe SSG do mock — os ids batem com o banco), `/m/estabelecimentos`, `/m/planos`, `/m/premiacoes` e ranking, além das telas do `/admin` (exceto a leitura de `config_pontos`). O detalhe do cupom já dispara evento de `visualizacao` real via componente client invisível.

## 7. O que ficou para a Fase 3

- **Admin operacional:** moderar/aprovar cupom `pendente`; editar `config_pontos` (escrita); CRUD de estabelecimentos/usuários/cupons; ações reais (suspender/reativar).
- **Ranking real** (view agregada; hoje é seed/mock por causa da RLS).
- **Scanner QR** de verdade; **upload de imagem** (storage está desligado — `imagem` fica vazio).
- **Realtime** no lugar do polling; **cron** de expiração (hoje é lazy); guarda anti-farm de ativações expiradas.
- **Supabase hospedado** + `db push` + deploy; **pagamento**/assinaturas; migração de ids `text`→`uuid`; unificação dos planos landing×app.

## 8. Notas

- O provider ganhou hidratação e ações assíncronas mantendo a **mesma API pública** (`getStatus`, `getEstado`, `getPontos`, `ativarCupom`, `verCupomAtivo`, `fecharCupomAtivo`, `responderNps`, `fecharNps`, `sheetId`, `npsId`), então os componentes existentes seguiram funcionando; `simularValidacao` foi removido (era da demo) e `consultarCupom`/`abrirNps` foram adicionados para o polling e a recuperação de NPS.
- Em desenvolvimento no Windows, rodar `npm run build` com o `npm run dev` ativo corrompe o `.next` compartilhado (404 de chunks → sem hidratação). Ao alternar entre build e navegação, reinicie o dev (`rm -rf .next && npm run dev`).
