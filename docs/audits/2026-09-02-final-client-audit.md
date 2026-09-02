# Auditoria final do cliente — Promofy

**Data:** 2026-09-02  
**Branch:** `feat/client-returns-consumidor`  
**HEAD:** `1501cbd788e79df163ec1bd7e268be38d3b533d1`  
**Ancestral CLIENT-RETURNS-01:** `d567a550e758cd3a0df86df2f152feb6d15dcd7e`  
**Migrations locais do lote (imutáveis nesta auditoria):** `20260902120000`, `20260902130000`, `20260902140000`  
**Suítes frescas:** CR-01 56/0 · CR-02 77/0 · M3A 64/0 · M3B 57/0 · `npm run verify` EXIT 0 · build PASS  
**Publicação:** nenhum push / PR / deploy / `db push` hospedado neste lote

## Veredito

**FINAL CLIENT AUDIT = PASS**  
**CLIENT RETURNS = COMPLETE — READY FOR CONSOLIDATED PUBLICATION**  
**BLOCKER CLIENT RETURNS = nenhum**  
Correções mínimas de código exigidas por este WP: **nenhuma**. Galeria (QA v2 §1.7) é dívida de produto sob `PRODUCT-COMPLETE-WEB`, não blocker de Client Returns.

Este arquivo é a **fonte oficial de verdade** do restante do trabalho até 100% do escopo contratual (web + apps + billing + legal + handover).

---

## 1. Método e inventário de fontes

### 1.1 Método

1. Confrontar cada requisito QA v1/v2 e cada promessa citada nos documentos recentes do cliente com o **runtime** em `src/`, migrations, seed e suítes.
2. Distinguir **retorno QA** (fechável em CR-01/02) de **produto final** (futuro WP).
3. Classificar só com o conjunto permitido abaixo.
4. **Não inventar** resolução de contradições, KPIs, regras de billing nem valores comerciais ausentes do runtime.
5. Afirmações do tipo “o Termo diz X” vêm de **fonte secundária** (WP / DE-PARA), não do PDF integral no repo.

### 1.2 Classificações permitidas

`FEITO` · `FEITO — SOLUÇÃO EQUIVALENTE/MELHOR` · `PARCIAL` · `PENDENTE` · `PENDENTE — FUTURO WP` · `BLOCKER CLIENT RETURNS` · `DECISÃO DO CLIENTE NECESSÁRIA` · `CONTRADIÇÃO DOCUMENTAL` · `AJUSTE DOCUMENTAL` · `FORA DO ESCOPO CONFIRMADO`

### 1.3 Inventário de fontes

| Fonte | No repo? | Papel nesta auditoria |
|---|---|---|
| Política de Privacidade v2.0 (PDF integral) | **FONTE AUSENTE NO REPO** | Só via claims do WP `FINAL-CLIENT-AUDIT-01` |
| Política de Cookies v2.0 | **FONTE AUSENTE NO REPO** | Idem |
| Termos de Uso Consumidor v2.0 | **FONTE AUSENTE NO REPO** | Idem |
| Termos de Uso Parceiros v3.0 | **FONTE AUSENTE NO REPO** | Idem |
| Termo PromoPoints v1.0 | **FONTE AUSENTE NO REPO** | Idem + DE-PARA CR-02 §W |
| Dashboard Operacional Promofy v1.0 | **FONTE AUSENTE NO REPO** | Lista A1–D7 por nome curto no WP |
| Anexo I / deck “Promoção na palma da mão” | **FONTE AUSENTE NO REPO** | Proxy: landings `para-empresas` / `para-voce` |
| WP `FINAL-CLIENT-AUDIT-01` (texto de requisitos) | Transcript / working copy | Claims secundários sobre o que os docs dizem |
| Relatório de fechamento CR-02 (DE-PARA) | Transcript / `_tmp_cr02_report` | Status pós-CR-02 |
| Matriz QA v1+v2 (explore agent @ HEAD) | Transcript `c450c66b…` | Parte 1 item a item |
| Matriz promessas vs runtime (explore agent) | Transcript `a54e019c…` | Partes 2–41 |
| `docs/superpowers/plans/2026-08-17-relatorios-qa-v1-v2.md` | Sim | Matriz original + correções ao relatório |
| `docs/taxonomia/relatorio-v2-transcricao.md` | Sim | Transcrição QA v2 |
| `docs/taxonomia/Promofy_Anotacoes_Devs.pdf` | Sim | Taxonomia / anotações; **não** é o pacote legal |
| Runtime `src/`, migrations, seed, testes | Sim | Evidência primária |

PDF legal completo **não** está versionado. Onde houver tensão entre claim secundário e runtime, a classificação registra a tensão — **sem escolher um lado**.

### 1.4 Formato das linhas de requisito

Cada linha relevante usa: **fonte | requisito | estado atual | evidência | classificação | próximo destino**.

---

## PARTE 1 — QA V1 E V2 (item a item)

**Método desta parte:** matriz do explore agent revalidada contra `src/` + suítes CR/QA no HEAD `1501cbd`.  
**BLOCKER CLIENT RETURNS nesta parte: nenhum.**  
Galeria (v2 §1.7) = **PARCIAL** (dívida de produto). Bug alegado v2 §3.1 (ativado com botão bloqueado) = **CONTRADIÇÃO DOCUMENTAL** (não reproduzível no código; ver plano).

### Relatório v1

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| QA v1 §1 | Visualizar senha nos 4 logins | Implementado | `password-input.tsx`, `field.tsx` troca `type=password`; `/m/login`, `/e/login`, `login-painel` (portal+admin); `test-qa-relatorios` | **FEITO** | — |
| QA v1 §2.1 | Selo “cupom utilizado” na home | Overlay real | `cupom-selo-utilizado.tsx`; `m/page.tsx` | **FEITO** | — |
| QA v1 §2.1 | “Usar cupom” × “Regras de uso” | Rótulo estável; sem `i % 3` | `m/page.tsx`; `test-qa-relatorios` | **FEITO** | — |
| QA v1 §2.2 | Janela: botão borrado + mensagem | Fora da janela bloqueia UI + RPC | `cupom-acao-usar.tsx`; `janelaAlcancavel` no detalhe | **FEITO** | — |
| QA v1 §2.3 | Cupom de teste | Referência de QA no seed, não tarefa de produto | `supabase/seed.sql` | **FORA DO ESCOPO CONFIRMADO** | — |
| QA v1 §3.1 | Editar cupom reprovado/pendente | Reenvio + edição | `reenviar_cupom_moderacao`; `coupon-portal-card.tsx`; CR-01 | **FEITO** | — |
| QA v1 §3.1 | Ativo só editável sem resgate acionado | Trigger P0601–P0606 | mig. edição cupom; `ERRO_EDICAO` em actions | **FEITO** | — |
| QA v1 §3.2 | Código sem hífens na entrada | Normaliza 8 chars (`PRMF-XXXX-XXXX`) | `codigo-cupom.ts`; nota: QA falava “12 dígitos” | **FEITO** (+ **AJUSTE DOCUMENTAL** no número) | Decisão formato Parte 15 |
| QA v1 §3.3 | Taxas / formas / ilimitado / prazo 5h | Forms lojista | `novo-cupom-form.tsx` (portal + `/e`) | **FEITO** | — |
| QA v1 §3.3 | Benefício no template na criação | Renderiza `beneficio` | `coupon-card.tsx`; suíte QA | **FEITO** | — |
| QA v1 §3.4 | Economia variável “a partir de” | Rótulo + schema | `cupom-campos.ts:rotuloEconomia` | **FEITO** | — |
| QA v1 §4 | Rejeitar com motivo | Admin | `admin/.../cupons-client.tsx` | **FEITO** | — |
| QA v1 §4 | Editar após rejeição (estabelecimento) | Portal/`/e` | cards + forms | **FEITO** | — |
| QA v1 §4 | Editar após rejeição (**admin**) | RPC + UI | `admin_editar_cupom`; CR-01 | **FEITO** | — |
| QA v1 §5.1 | Segmento + Categoria (~15×~85) | Catálogo 14×75 canônico | `catalogo_segmentos` / folhas; CR-02 | **FEITO — SOLUÇÃO EQUIVALENTE/MELHOR** (+ **AJUSTE DOCUMENTAL** 14×75) | Manter taxonomia |
| QA v1 §5.2 | Localização (perto/bairro/cidade) | Geo device + filtros reais | `distancia.ts`; `filtros-client.tsx`; CR-02 | **FEITO** | — |
| QA v1 §5.3 | Tipo de promoção | Enum + filtro | `tipo-promocao.ts`; mig. CR-02 | **FEITO** | — |
| QA v1 §5.4 | Tipo de consumo (filtro) | Filtro sobre `formas_consumo` | `passarFiltroConsumidor`; CR-02 | **FEITO** | — |
| QA v1 §5.5 | Valor compra mínimo (slider) | Coluna + UI “Sem limite” | `valor_compra_minimo`; CR-02 | **FEITO** | — |
| QA v1 §5.6 | Descoberta / Em alta | Trilhos com RPC batch | `sinais_descoberta` / `estoque_cupons`; `descoberta.ts` | **FEITO** | — |
| QA v1 §5.7 | Relevância / Afinidade | Motor determinístico + consent | `recomendacao.ts`; CR-02 | **FEITO** | — |

### Relatório v2

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| QA v2 §1.1 | Edição: data início, horários, dias, ocultar | Portal e `/e` cobrem | Forms; premissa do PDF estava errada | **FEITO** | — |
| QA v2 §1.2 | Crop de imagem | Canvas 2:1 | `crop-imagem.tsx`; `recorte-imagem.ts`; CR-01 | **FEITO** | — |
| QA v2 §1.3 | Reativar esgotado/expirado | Esgotado → nova campanha; expirado → prorrogar/reenviar | `coupon-portal-card.tsx`; CR-01 | **FEITO — SOLUÇÃO EQUIVALENTE/MELHOR** | — |
| QA v2 §1.4 | Botão “Novo cupom” no dashboard | Link `/portal/cupons?novo=1` | `portal/(painel)/page.tsx` | **FEITO** | — |
| QA v2 §1.5 | Validação por CPF no portal | Dialog + fluxo CPF | `validar-cupom-dialog.tsx`; `ValidarPorCpf`; CR-01 | **FEITO** | — |
| QA v2 §1.6 | Exclusão de cupom | Soft delete | `excluir_cupom` + UI portal/`/e`; CR-01 | **FEITO** | — |
| QA v2 §1.7 | Logo + **galeria** | Logo persiste; galeria explícita “ainda não” | `estabelecimento-form.tsx`; `estabelecimento/page.tsx` | **PARCIAL** | `PRODUCT-COMPLETE-WEB` (não CR blocker) |
| QA v2 §1.8 | Filtros listagem portal | Status/atributos | `filtrarListagemLojista`; CR-01 | **FEITO** | — |
| QA v2 §2.1 | Ver imagem na moderação | Campo `imagem` no admin | `data/admin.ts`; `ImagemModeracao` | **FEITO** | — |
| QA v2 §2.2 | Admin editar cupom | RPC + action + UI | CR-01 | **FEITO** | — |
| QA v2 §2.3 | Cupons usados em lista vertical | Lista, não join por vírgula | `usuarios-client.tsx:ListaVertical` | **FEITO** | — |
| QA v2 §3.1 | “Utilizado” sem ativação válida (bug alegado) | Backend não ativa com botão bloqueado; hipótese = ativação legítima prévia | Plano §Correções; `cupom-acao-usar`; RPC | **CONTRADIÇÃO DOCUMENTAL** | Pedir `ativado_em`/`row_id` ao QA se reabrir |
| QA v2 §3.1 | Ativação antecipada (overlap 5h) | `janela_alcance` | mig. fase9; `janela.ts` | **FEITO** | — |
| QA v2 §3.2 | Usar × Regras | Idem v1 §2.1 | — | **FEITO** | — |
| QA v2 §3.3 | Ativações > cliques | Clique gravado em `ativar_cupom` (servidor) | mig. fase9 ativar; cliente sem fire-and-forget | **FEITO** | — |
| QA v2 §4.1 | Planos anuais | Copy contrato anual; sem toggle Mensal\|Anual | `/m/planos`; `public.planos`; CR-02 | **FEITO** | Billing enforce depois |
| QA v2 §4.2 | Histórico (incl. excluídos) | Soft delete + eventos; admin histórico; portal Excluídos | CR-01 | **FEITO — SOLUÇÃO EQUIVALENTE/MELHOR** | — |
| QA v2 §4.3 | Modo noturno | Produto light-only forçado | `globals.css` `color-scheme: light`; CR-01 | **FEITO — SOLUÇÃO EQUIVALENTE/MELHOR** | — |
| QA v2 §5.1 | NPS fórmula oficial | RPC indicadores | mig. 25; portal | **FEITO** | — |
| QA v2 §5.2 | Onde o consumidor dá feedback | Dialog + card pendente | `nps-dialog.tsx`; `nps-pendente-card.tsx` | **FEITO** | — |

### Contagens Parte 1

| Classificação | Qtd (linhas da matriz) |
|---|---|
| FEITO | 33 |
| FEITO — SOLUÇÃO EQUIVALENTE/MELHOR | 5 |
| PARCIAL | 1 (galeria) |
| CONTRADIÇÃO DOCUMENTAL | 1 (bug alegado §3.1) |
| FORA DO ESCOPO CONFIRMADO | 1 |
| BLOCKER CLIENT RETURNS | **0** |

**Conclusão Parte 1:** retornos QA funcionais do lote Client Returns estão fechados. Nada foi empurrado silenciosamente para “futuro” sob rótulo de retorno QA.

---

## PARTE 2 — Cadastro do consumidor

Fonte secundária: Termos Consumidor v2 (WP). Runtime: `/m/cadastro`, `cadastrarAction`, `profiles`.

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Cons. / WP | CPF | Campo + metadata → `profiles.cpf`; índice em dígitos; **sem UNIQUE forte** | cadastro; mig. 27 | **PARCIAL** | PRODUCT-COMPLETE / Legal (unicidade) |
| Termos Cons. | E-mail | Obrigatório Auth | `cadastrarAction` | **FEITO** | — |
| Termos Cons. | Nome completo | Obrigatório | cadastro | **FEITO** | — |
| Termos Cons. | Celular | Campo | metadata/perfil | **PARCIAL** | Endurecer validação se Termo exigir |
| Termos Cons. | Data de nascimento | Campo; **sem gate de idade** | UI | **PARCIAL** | **DECISÃO DO CLIENTE** 18+/emancipação |
| Termos Cons. | Senha | Obrigatória | Auth | **FEITO** | — |
| Termos Cons. | Aceite | Checkbox `required` + server + `aceites_documento` | mig. CR-02; `documentos-legais.ts` v2.0 | **FEITO** (Termos Consumidor) | LEGAL-CONSENT (demais docs) |
| Termos Cons. | Código promocional opcional | Disabled “Em breve”; sem fake success | `m/cadastro` | **PARCIAL** | BILLING |
| Termos Cons. | 18+ ou emancipado | Só coleta data | — | **PENDENTE** + **DECISÃO DO CLIENTE NECESSÁRIA** | Não implementar gate sem resposta |

---

## PARTE 3 — Aceites (arquitetura versionada)

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| CR-02 / Termos | Aceite auditável (documento, versão, timestamp, titular) | Tabela `aceites_documento` + trigger no cadastro | mig. `20260902140000`; `DOCUMENTO_TERMOS_CONSUMIDOR` / `VERSAO_TERMOS_CONSUMIDOR` | **FEITO** (fundação) | LEGAL-CONSENT |
| Legal | Suportar Privacidade / PromoPoints / Parceiro / versões futuras | Schema genérico `(usuario, documento, versao, …)`; UI hoje grava só termos consumidor | `documentos-legais.ts`; actions auth | **PARCIAL** — arquitetura **suporta**; conteúdo/fluxos multi-doc **PENDENTE — FUTURO WP** | LEGAL-CONSENT |

---

## PARTE 4 — Termos parceiro / cadastro

Fonte secundária: Termos Parceiros v3. Schema atual: `estabelecimentos` (`nome`, `cidade`, `bairro`, `lat/lng`, `logo`, `owner_id`, …).

| REQUISITO | EXISTE? | PERSISTE? | EDITÁVEL? | VALIDADO? | DESTINO |
|---|---|---|---|---|---|
| Razão social / CNPJ **ou** nome / CPF (PF) | Não (só `nome` fantasia/loja) | — | — | — | PRODUCT-COMPLETE-WEB |
| Endereço completo | Não (cidade/bairro; sem rua/CEP) | Parcial geo | Sim perfil | Soft | PRODUCT-COMPLETE-WEB |
| Representante legal | Não | — | — | — | PRODUCT-COMPLETE-WEB |
| Nome do representante | Não | — | — | — | PRODUCT-COMPLETE-WEB |
| CPF do representante | Não | — | — | — | PRODUCT-COMPLETE-WEB |
| Cargo | Não | — | — | — | PRODUCT-COMPLETE-WEB |
| E-mail | Via Auth do owner; não campo de empresa | Auth | Conta | Auth | PRODUCT-COMPLETE-WEB (empresa) |
| Telefone | Não no schema estab | — | — | — | PRODUCT-COMPLETE-WEB |
| Logotipo | Sim | Sim (`logo`) | Sim portal | Upload/magic bytes CR-01 | FEITO (logo) |

**Classificação geral cadastro parceiro completo:** **PENDENTE — FUTURO WP** (`PRODUCT-COMPLETE-WEB`). Logo: **FEITO**.

---

## PARTE 5 — Gratuidade do parceiro

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Parceiros / comercial | Participação gratuita | `/portal/planos` “Gratuito para o parceiro”; sem R$149/R$349; item fora do menu de contratação | `portal/(painel)/planos/page.tsx`; sidebar CR-02 | **FEITO** | Manter coerência com marketing |

---

## PARTE 6 — Gestão de cupons (verbos)

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Parceiros | **CRIAR** | Lojista cria → `pendente` | `criarCupomAction` | **FEITO** | — |
| Termos Parceiros | **ATIVAR** (no ar) | Só admin `aprovar_cupom` coloca ativo | moderação | **PARCIAL** (lojista cria; admin ativa) | Confirmar se Termo = “publicar após aprovação” ou self-activate |
| Termos Parceiros | **PAUSAR** | Enum `indisponivel` existe; lojista sem grant/RPC de pausar | grants excluem `status` | **PENDENTE** | PRODUCT-COMPLETE-WEB |
| Termos Parceiros | **REATIVAR** | Sem verbo lojista dedicado (além de fluxos esgotado/expirado/reenvio) | cards portal | **PENDENTE** | PRODUCT-COMPLETE-WEB |
| Termos Parceiros | **EDITAR** | Patch + imutabilidade no banco | `editarCupomAction`; triggers | **FEITO** | — |
| Termos Parceiros | Sem limite arbitrário de ativos | Sem teto no código | — | **FEITO** (ausência) | Billing/entitlements futuros |
| Termos Parceiros | Revisão manual / regras / horários / consumo / limites / imagem / mínimo | Presentes nos forms | portal + `/e`; `valor_compra_minimo` | **FEITO** | — |

---

## PARTE 7 — Validação

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Parceiros | Por código | RPC real `/e` + portal | `validar`; placeholders `PRMF-…` | **FEITO** | — |
| Termos Parceiros | Contingência nome + CPF | Busca + confirma | `validar-por-cpf.tsx`; mig. CPF | **FEITO** | — |
| Termos Parceiros | QR por **câmera** lojista | Stub “Em breve” | `qr-scanner.tsx` | **PENDENTE — FUTURO WP** | APP NATIVO / P1 |
| UX | QR exibido ao consumidor | Padrão visual (`QrFake`), não câmera | `cupom-ativo-sheet.tsx` | **PARCIAL** | APP / produto |

---

## PARTE 8 — CRM → P0

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos + comercial | CRM (nome, e-mail, celular, nascimento, histórico no estab, só clientes legítimos) | Dados de perfil existem no consumidor; **sem** tela CRM lojista; sem relação “cliente do estabelecimento” exposta | landings prometem; grep export = vazio | **PENDENTE — FUTURO WP** | **P0 CRM / PRODUCT-COMPLETE-WEB** |
| Comercial | Export XLSX / PDF | Ausente | — | **PENDENTE — FUTURO WP** | P0 CRM |

**Respostas obrigatórias:**  
- Dados que já existem: `profiles` (nome, e-mail, cpf, tel, nascimento), `cupons_usuario` / eventos por cupom/estab.  
- Relações: validação liga consumidor↔cupom↔estab; não há entidade CRM.  
- Lojista consulta CRM? **Não.**  
- Exportação? **Não.**

---

## PARTE 9 — LGPD CRM (fronteira)

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Parceiros | Parceiro controlador dos dados do CRM | Sem CRM; RLS já isola preferências do consumidor do lojista | CR-02: lojista ≠ prefs | **PENDENTE** (desenhar com CRM) | P0: RLS/RPC/export/audit trail **A nunca vê B** |
| Privacidade | Preferências/consent dono-only | RLS | mig. CR-02; suíte | **FEITO** (base) | Estender ao CRM |

---

## PARTE 10 — Planos UI (consumidor)

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos / CR-02 | Promo / Básico / Plus / Família / VIP | Linhas em `public.planos` | seed; `/m/planos` | **FEITO** (apresentação) | BILLING |
| Termos / QA | Pagos = contrato anual 12 meses; 12x ≠ plano mensal | Copy anual; `periodo` = rótulo da parcela | seed comentários; CR-02 | **FEITO** (UI) | — |
| Termos | Promo gratuito | `preco=0` | seed | **FEITO** | — |
| Termos | CTAs sem checkout fake | “Pagamento em breve” | `/m/planos` | **FEITO** (honestidade) | BILLING-MP |

---

## PARTE 11 — Entitlements (matriz)

Fonte secundária: Termos Consumidor (claims WP). Runtime: benefícios em **texto** no seed; **sem** enforcement de cota/geo/família/VIP×2.

| PLANO | PROMESSA (Termo/WP) | IMPLEMENTADA? | BACKEND? | UI? | PENDÊNCIA |
|---|---|---|---|---|---|
| Promo | 1 cupom/mês; catálogo selecionado; piso ≥ preço Básico | Não | Não | Texto honesto (“quando cobrança estiver no ar”) | **BILLING / ENTITLEMENTS P0** |
| Básico | Até 5 / cidade | Não enforce | Não | Benefícios listados | Idem |
| Plus | Ilimitado / cidade+região | Não enforce | Não | Benefícios listados | Idem |
| Família | Ilimitado / 4 perfis | Não | Não | Texto | Idem + modelo multi-perfil |
| VIP | Ilimitado / antecipado / exclusivos / pontos×2 | Bloqueado por convite na UI | Flag `bloqueado` | Badge Convite | Idem + convites |

**Classificação:** **PENDENTE — FUTURO WP** (`BILLING / ENTITLEMENTS P0`).

---

## PARTE 12 — Mercado Pago → BILLING-MP P0

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos / produto | Destino = Mercado Pago | Sem SDK/checkout; CTAs “em breve”; perfil pagamento “ainda não” | `perfil/pagamento`; planos | **PENDENTE — FUTURO WP** | **BILLING-MP P0** (cobrança, PIX, cartão, 12x, webhook, idempotência, assinatura, atraso, bloqueio, estorno, chargeback, arrependimento, reconciliação) |
| — | Checkout fake | **Não existe** (correto) | — | **FEITO** (não fingir) | — |

---

## PARTE 13 — Freemium

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Cons. | Gratuito só vê cupons com desconto ≥ preço vigente do Básico | Sem filtro de catálogo freemium | `precoPlanoBasico()` lê banco; **não** aplicado ao discovery | **PENDENTE — BILLING** | BILLING + entitlements |
| CR-02 | Sem R$9,90 hardcoded em **motor de regra** | Preço no seed/banco; helper lê banco | `src/lib/data/planos.ts`; landings podem mostrar “R$ 9,90” como **copy** de marketing | **FEITO** (regra) + notar copy marketing | Não confundir landing com regra |

---

## PARTE 14 — Cancelamento → CONTRADIÇÃO DOCUMENTAL

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Cons. (WP) | “Após exibição do código, cancelamento não permitido” **e** regras 24h / >3 cancel/dia | Sem action/RPC de cancelar ativação; unique impede reativar o mesmo cupom | Grep actions: zero `cancelar` | **CONTRADIÇÃO DOCUMENTAL** + **PENDENTE** | Pergunta ao cliente (Parte 44 #3); depois WP de regra |

**Pergunta oficial:** em que momento o cancelamento é permitido — antes de gerar o código, depois da ativação mas antes de visualizar, ou outro estado? **Não adivinhar.**

---

## PARTE 15 — Formato do código → DECISÃO + mapa de impacto

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Docs jurídicos (WP) | `PRM-XXXXXX` | Marketing/FAQ ainda citam `PRM-` | `para-voce` FAQ | **CONTRADIÇÃO DOCUMENTAL** / **AJUSTE DOCUMENTAL** | Decisão |
| Runtime | `PRMF-XXXX-XXXX` (8 chars, alfabeto 32) | Generator + normalização + validação | `codigo-cupom.ts`; RPCs; UI balcão | **FEITO** (sistema) | **DECISÃO DO CLIENTE NECESSÁRIA** |

### Mapa de impacto se mudar o formato

| Área | Impacto |
|---|---|
| Generator (DB) | Função/default que emite `PRMF-…` |
| Coluna / índices | Códigos já emitidos em produção/teste |
| RPCs `validar_*` / `ativar_*` | Parse e comparação |
| `normalizarCodigoCupom` | Aceitar legado + novo |
| QR / placeholders UI | `/e`, portal, sheet consumidor |
| Testes estáticos e suítes | Fixtures `PRMF-…` |
| Compatibilidade | Códigos já impressos/compartilhados |

**Não alterar nesta auditoria.**

---

## PARTE 16 — Prazo 5h

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos Cons. | Código válido por 5 horas | Default/mínimo **5h** (`PRAZO_ATIVACAO_MIN_HORAS=5`); **configurável ≥5** por cupom; alcance adicional via `janela_alcance` (overlap com horários) | `cupom-campos.ts`; forms; mig. fase9 | **FEITO — SOLUÇÃO EQUIVALENTE/MELHOR** | Documentar no Termo se “exatamente 5h” for marketing simplificado |
| — | Timezone | Janelas em horários locais do cupom; datas fuso-sensíveis tratadas com padrão do projeto | `janela.ts` / utils | **FEITO** (cuidado operacional) | Manter padrão anti-hidratação |

---

## PARTE 17 — Push 1h → P1

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos / FAQ | Push 1h antes de expirar | FAQ promete; sem push real; flag admin cosmético | `para-voce`; admin config | **PENDENTE — FUTURO WP** | **P1 PUSH / APP NATIVO**; **AJUSTE DOCUMENTAL** no FAQ até existir |

Não marcar FEITO por aviso web.

---

## PARTE 18 — Resgatado sem baixa (três invariantes)

Fonte: Termos Cons. (WP). Runtime: ativação expira sem validação no balcão.

| Invariante | Estado | Evidência | Classificação |
|---|---|---|---|
| Conta como consumido | Status `expirado` (sem nova ativação livre pelo unique) | mig. reservas / `ativar_cupom` | **FEITO** |
| Não gera PromoPoints | Pontos de resgate só em `validar_cupom` | RPCs pontos | **FEITO** |
| Não dispara NPS | NPS exige validado | `responder_nps` → `nao_validado` | **FEITO** |

**Os três invariantes = FEITO.**

---

## PARTE 19 — Indicação

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termos + PromoPoints | Link/código exclusivo, convertido com assinatura paga, pontos, antifraude | UI stub “Link”; enum `indicacao` em config; **sem writer** de crédito | `m/perfil/convide` | **PENDENTE — FUTURO WP** | **PROMOPOINTS / BILLING** |

---

## PARTE 20 — PromoPoints — DE-PARA de valores

Fonte Termo: claims WP. Runtime: `config_pontos` / seed / suíte AF CR-02. **Não alterado nesta auditoria.**

| Ação | Termo v1 (WP) | Runtime `config_pontos` | Classificação |
|---|---|---|---|
| Resgate confirmado | 100 | **50** | **DECISÃO DO CLIENTE NECESSÁRIA** |
| NPS | 50 | **30** | Idem |
| Indicação convertida | 200 | **100** (config; não creditado) | Idem + PENDENTE motor |
| Primeiro acesso | 50 | — (sem ação) | PENDENTE |
| Check-in diário | 5 | `visita` **10** (não creditado em RPC de produto) | DECISÃO + PENDENTE |
| Limite indicação 5/mês | Declarado | Ausente | PENDENTE |

Evidência: `supabase/seed.sql` L211–215; `gamification.ts` espelha seed.

---

## PARTE 21 — Aceite PromoPoints

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Termo PromoPoints | Participação voluntária + aceite específico | Pontos no resgate/NPS **sem** termo dedicado; cadastro só grava `termos_consumidor` | `aceites_documento`; ausência de doc PromoPoints | **PENDENTE — FUTURO WP** | **LEGAL-CONSENT + PROMOPOINTS** |

---

## PARTE 22 — Motor PromoPoints (fundação vs produto final)

| Item | Fundação? | Produto final? | Classificação |
|---|---|---|---|
| Ledger `pontos_transacoes` + saldo SUM | Sim | — | **FEITO** (fundação) |
| Idempotência `(usuario, acao, referencia)` | Sim | — | **FEITO** |
| Crédito resgate / NPS | Sim | — | **FEITO** (parcial produto) |
| Estorno / saldo negativo / expiração / ban | Não | Não | **PENDENTE** |
| Primeiro acesso / check-in / indicação creditada | Não | Não | **PENDENTE** |
| Ranking UI | Parcial (níveis client) | Premiações reais | **PARCIAL** |
| Recompensas / fulfillment | UI | Sem fulfillment | **PENDENTE** |

**Separação:** fundação ledger **existe**; produto gamificado completo **não**. Destino: **PROMOPOINTS P0**.

---

## PARTE 23 — Fraude (backlog)

Termo PromoPoints (WP) menciona: CPF, multi-conta, device, pagamento, autoindicação, automação, conluio, chargeback, estorno, banimento.

| Controle | Estado | Classificação |
|---|---|---|
| CPF indexado / validação formato | Existe ≠ antifraude completo | **PARCIAL** base |
| Multi-conta / device / autoindicação / automação / conluio | Ausente | **PENDENTE** backlog |
| Chargeback / estorno / ban | Dependem billing + ops | **PENDENTE** |

**Não fingir prontidão** porque CPF existe. Destino: **PROMOPOINTS + BILLING + RELEASE-SECURITY**.

---

## PARTE 24 — Privacidade (matriz)

Fonte: Privacidade v2 (WP). **Não começar a coletar** só porque o doc lista.

| DADO DECLARADO | COLETAMOS? | PRECISAMOS? | BASE LEGAL (doc WP) | RUNTIME | AÇÃO / Classificação |
|---|---|---|---|---|---|---|
| Nome | Sim | Sim | Cadastro/contrato | `profiles` | **FEITO** (coleta) |
| CPF | Sim | Sim (validação/antifraude) | — | `profiles.cpf` | **FEITO** (coleta) |
| Nascimento | Sim | Gate 18+? | — | Campo | **PARCIAL** + decisão |
| RG | Não | Não no produto atual | Claim WP | Zero no `/m` | **AJUSTE DOCUMENTAL** ou FUTURO se for coletar |
| E-mail / telefone | Sim | Sim | — | Auth/perfil | **FEITO** |
| Pagamento | Não (tela “ainda não”) | Billing | — | stub | **PENDENTE — BILLING** |
| Device / IP | Sessão Supabase; Sentry | Ops/segurança | — | `@sentry/nextjs` | Revisar citação Cookies/Privacidade |
| Preferências / interações / ativações | Sim | Produto | Consent para personalização | eventos + prefs | **FEITO** / gated |
| Geo consumidor | Só memória device | Distância | Autorização browser | `localizacao-dispositivo.tsx` | **FEITO** (não persiste) |
| Empresa / CNPJ / endereço / representante | Parcial (nome, cidade, logo, geo estab) | Cadastro parceiro | — | `estabelecimentos` | **PARCIAL** → PRODUCT-COMPLETE |

Infra: ver Parte 30.

---

## PARTE 25 — Personalização / consentimento

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Privacidade / CR-02 | Sem consent → sem profiling individual na recomendação | Modo neutro (cidade/popularidade/novidade) | `recomendacao.ts`; `consentimentoAtivo` | **FEITO** | Manter PASS |
| Privacidade / CR-02 | Com consent → preferências/histórico permitido | Switch + tabela versionável | `consentimentos_usuario`; preferências | **FEITO** | — |
| UX | Recusar não bloqueia o app | Sim | CR-02 | **FEITO** | — |

**Continua PASS.**

---

## PARTE 26 — Direitos do titular

| Direito | Forma hoje | Classificação |
|---|---|---|
| Acessar | Perfil / preferências (parcial) | **PARCIAL** — SELF-SERVICE limitado |
| Corrigir | Perfil/preferências editáveis | **PARCIAL** — SELF-SERVICE |
| Excluir conta | Ausente | **NÃO IMPLEMENTADO** → LEGAL-DATA-LIFECYCLE |
| Revogar consentimento | Switch personalização | **SELF-SERVICE** (finalidade personalização) |
| Portabilidade | Ausente | **NÃO IMPLEMENTADO** |
| Informação compartilhamento / oposição | Sem fluxo | **PROCESSO MANUAL** / PENDENTE |

---

## PARTE 27 — Exclusão / retenção → LEGAL-DATA-LIFECYCLE P0

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Privacidade (WP) | Anonimização ≤30 dias pós-encerramento, salvo retenção legal | Sem delete-account, soft-delete de conta, job ou retention policy | Grep: zero fluxo | **PENDENTE — FUTURO WP** | **LEGAL-DATA-LIFECYCLE P0** |

---

## PARTE 28 — Cookies

| Item | Presente hoje? | Classificação |
|---|---|---|
| Google Analytics / GTM | Não | **FORA DO ESCOPO CONFIRMADO** (hoje) |
| Meta Pixel / remarketing | Não | Idem |
| Firebase Analytics | Não | Idem |
| Cookies sessão Auth | Sim (`@supabase/ssr`) | Necessários — **FEITO** (técnico) |
| Consentimento granular opcional | Não | **PENDENTE — FUTURO WP** LEGAL — **obrigatório antes** de ligar tracking |
| Sentry | Sim | Observabilidade; alinhar doc Cookies |

**Não há tracking opcional sem consentimento → sem BLOCKER LEGAL por tracking hoje.** Banner granular = pré-condição de ativação futura.

---

## PARTE 29 — Segurança prometida

Fonte: Privacidade v2 (WP). **Não supor.**

| PROMESSA | ESTADO | EVIDÊNCIA | PENDÊNCIA |
|---|---|---|---|
| TLS 1.2+ | Provável via Vercel/Supabase managed | Infra provedor; sem prova documentada no app | Confirmar/documentar RELEASE-SECURITY |
| MFA produção | Não no produto | Sem TOTP/WebAuthn admin/consumidor | **PENDENTE** P0 pré-go-live |
| Audit logs ≥12 meses | Não evidenciados | — | **PENDENTE** |
| Backup diário criptografado | Supabase managed (não auditado aqui) | Sem runbook no repo | **PENDENTE** DR |
| Least privilege | RLS forte; service_role **não** em build | CLAUDE.md / histórico Fase 7 | Manter |
| Monitoramento contínuo | Sentry parcial | package | Expandir |
| Incidente relevante ≤24h | Sem processo versionado | — | **PENDENTE** runbook |

**Classificação geral:** **PENDENTE — FUTURO WP** `RELEASE-SECURITY` (P0 pré-go-live).

---

## PARTE 30 — Infraestrutura

| Fonte | Requisito | Estado atual | Evidência | Classificação | Próximo destino |
|---|---|---|---|---|---|
| Privacidade (WP) | Supabase + GCP | Runtime app: **Vercel + Supabase**; GCP não é o host do Next | README / CLAUDE / Vercel | **AJUSTE DOCUMENTAL** | Atualizar Política antes do go-live |

Não mudar infraestrutura nesta auditoria.

---

## PARTES 31–34 — Dashboard Operacional A/B/C/D

**Fonte completa Dashboard v1.0: AUSENTE NO REPO.** Nomes = WP. Admin atual declara ausência de MRR/funil fictício — **honestidade FEITO**.

### A — Operação

| KPI | Computável hoje? | Classificação |
|---|---|---|
| A1 ativos (estab/cupons) | Sim (status) | **PENDENTE** UI admin; computável |
| A2 novos ativados | `cupom_eventos` / `cupons_usuario` | Idem |
| A3 taxa ativação | Derivável | Idem |
| A4 cupons/estab | Sim | Idem |
| A5 confirmação (validação) | `tipo=validacao` | Idem |
| A6 sem baixa | `expirado` sem validado | Idem |
| A7–A8 churn risco/churn | Precisa assinatura | **PENDENTE** — Billing |

### B — Receita / aquisição

| KPI | Fonte | Classificação |
|---|---|---|
| B3–B8 assinantes/MRR/ARPU/churn/inadimplência | Billing | **PENDENTE — Billing** |
| B9–B12 CPA/CAC/LTV/orgânico | Marketing externo | **PENDENTE — externo** (não inventar) |

### C — Qualidade / produto

| KPI | Estado | Classificação |
|---|---|---|
| Conversão cupom / NPS / métricas | Portal lojista tem funil/NPS/`cupom_metricas` | **PARCIAL** |
| Rating lojas / tempo 1º resgate / zero resgate | Parcial / protótipo rating | **PENDENTE** / cuidado com colunas-protótipo |
| Bugs | Sentry / processo | Externo/processo |
| Admin sem KPI fictício | Explicitamente sem MRR fake | **FEITO** (honestidade) |

### D — Financeiro

| KPI | Classificação |
|---|---|
| D1–D7 MRR líquido, burn, caixa, runway, break-even, LTV:CAC | **PENDENTE — externo/manual** |

**Destino:** **P1 DASHBOARD OPERACIONAL** — só KPIs computáveis no produto; B/D marketing/financeiro manuais.

---

## PARTES 35–37 — Comercial / exclusividade / “5 minutos”

### Parte 35 — Material comercial

| Promessa | Runtime | Classificação |
|---|---|---|
| Parceiro gratuito | Sim | **REAL / FEITO** |
| CRM completo | Não | **PENDENTE** P0 (marketing **sobre-promete**) |
| Cliente chega / métricas / NPS / regras / mínimo | Métricas portal reais; mínimo CR-02 | **REAL** (parcial vs deck) |
| Exclusividade / destaque primeiros | Copy | **DECISÃO DO CLIENTE** — não virar regra backend sem OK |
| Footer Termos/Privacidade/Cookies/PromoPoints | Links sem textos legais hospedados | **PENDENTE** LEGAL |

### Parte 36 — Exclusividade

Termos parceiros (WP) **não** obrigam exclusividade; deck promove.  
**DECISÃO DO CLIENTE NECESSÁRIA:** A recomendação comercial · B flag opcional · C obrigação contratual.

### Parte 37 — “5 minutos”

Marketing: cadastro + cupom em 5 min. Termos: aprovação manual na tração. Cupom entra **`pendente`**.  
**PARCIAL / DECISÃO:** “cadastrado/submetido” ≠ “publicado ao consumidor”. Gerar pergunta (Parte 44).

---

## PARTES 38–40 — CNPJ, [DATA], fontes não confirmadas

| Fonte | Requisito | Classificação | Destino |
|---|---|---|---|
| Termos Cons. (WP) | CNPJ real em um trecho **e** “A ser obtido no ato da abertura” | **AJUSTE DOCUMENTAL** | Legal go-live |
| Docs (WP) | Placeholder `[DATA DE PUBLICAÇÃO]` | **AJUSTE DOCUMENTAL** | Antes do go-live |
| Vários | Google Cloud | **AJUSTE DOCUMENTAL** / não host do app | Parte 30 |
| Vários | Mercado Pago | **FUTURO CONFIRMADO** (destino billing) | BILLING-MP |
| Vários | Meta Ads / GA / Firebase Analytics | **NÃO UTILIZADO** hoje | Não ligar sem cookies granulares |

---

## PARTE 41 — Apps nativos

Dependências Anexo I / Termos / dashboard (claims):

| Item | Estado web | Destino |
|---|---|---|
| Push | Ausente | P1 APP |
| QR câmera lojista | Stub | P1 APP |
| Rating lojas real | Colunas/protótipo | APP + produto |
| Device / antifraude device | Ausente | APP + PromoPoints |
| Deep links / stores | Ausente | FINAL stores/handover |

**PENDENTE — FUTURO WP** `APPS NATIVOS` (P1 → FINAL).

---

## PARTE 42 — Roadmap oficial até 100% (ajustado pela evidência)

Ordem proposta após CR-01/02 **PASS** e esta auditoria:

1. **P0 — Publicação consolidada do lote Client Returns** (preview → OK humano → merge `--no-ff` → prod), com migrations `120000`/`130000`/`140000` aplicadas **antes** do deploy, conforme processo do repo.  
2. **P0 — CRM / PRODUCT-COMPLETE-WEB** (CRM + export + cadastro parceiro completo + galeria + PAUSAR/REATIVAR).  
3. **P0 — LEGAL / CONSENT / PRIVACY / DATA-LIFECYCLE** (hospedar textos, aceites multi-doc, cookies se tracking, direitos, exclusão/retenção 30d).  
4. **P0 — BILLING-MP + ENTITLEMENTS + FREEMIUM** (sem regras fictícias; Mercado Pago completo).  
5. **P0 — PROMOPOINTS + INDICAÇÃO + ANTIFRAUDE** (alinhar valores pós-decisão; motor; fraude mínima).  
6. **P0 pré-go-live — RELEASE-SECURITY** (MFA, backup/restore, auditoria, incidente, retenção).  
7. **P1 — PUSH / discovery restante / Dashboard A–C computável**.  
8. **P1 — APPS NATIVOS** (QR câmera, push, stores).  
9. **FINAL — Staging / RC / stores / handover.**

**Em paralelo (sem código de produto):** respostas às decisões Parte 44 + **AJUSTES DOCUMENTAIS** (CNPJ, datas, infra Vercel+Supabase, FAQ PRM/push).

---

## PARTE 43 — Percentuais (honestos)

Premissa: **100% = escopo contratual completo**, incluindo apps nativos, billing real, legal operacional, CRM, PromoPoints produto, security/DR e handover — não só “web demo estável”.

| Corte | Estimativa | Racional |
|---|---|---|
| **Web/backend produto core** (cupom, moderação, validação, discovery, taxonomia, consentimento base, planos UI, portal/admin) | **~74%** (faixa **70–78%**) | CR-01/02 + Marcos 3A/3B fecharam a maior parte dos retornos QA e do core; faltam CRM, entitlements, pausar, galeria, cadastro parceiro completo, legal UI |
| **Global até 100% contratual** | **~50%** (faixa **45–55%**) | Apps + billing + legal lifecycle + CRM + PromoPoints final + dashboard ops + security/DR ainda são blocos grandes; não inflar porque o web avançou |

Principais blocos restantes (peso): Billing/entitlements · CRM · Legal/consent/retenção · PromoPoints/indicação/fraude · Apps/push/QR · Dashboard ops · Security/DR.

---

## PARTE 44 — Perguntas ao cliente

Somente dúvidas genuínas (documentos PDF integrais ausentes do repo; claims WP não resolvem sozinhos):

1. **Formato oficial do código:** manter `PRMF-XXXX-XXXX` e corrigir Termos/FAQ, ou migrar para `PRM-XXXXXX`?  
2. **PromoPoints:** os valores do Termo v1 (100/50/200/50/5) devem substituir `config_pontos` (50/30/100/10)?  
3. **Cancelamento:** em que estado exato o consumidor pode cancelar (antes do código / após ativar / antes de visualizar / nunca)? Como conciliam as duas redações do Termo?  
4. **18+:** bloquear &lt;18, aceitar emancipados com comprovação, ou só declaração?  
5. **Exclusividade:** recomendação comercial, flag opcional ou obrigação?  
6. **Destaque dos primeiros parceiros:** algoritmo real ou só comunicação?  
7. **Validade/expiração de PromoPoints:** qual prazo?  
8. **Desconto pagamento anual à vista:** qual percentual/valor?

Extras genuínos desta auditoria:

9. **“5 minutos”:** significa submetido à moderação ou publicado ao consumidor?  
10. **ATIVAR no Termo parceiro:** self-activate do lojista ou “ativo após aprovação admin” (estado atual)?

---

## PARTE 45 — Blockers por tier

| Tier | Itens |
|---|---|
| **BLOCKER CLIENT RETURNS** | **Nenhum** |
| **BLOCKER PUBLICAÇÃO DO LOTE** | Processo (OK Neemias, migrations antes do deploy, smoke preview só `qa-*`/`convidado@`, env Preview). Não é gap de requisito QA. |
| **BLOCKER PRÉ-GO-LIVE** | Legal textos + lifecycle; Billing se monetizar; MFA/DR/incidente; cookies **se** ligar tracking; decisões 1–4 se marketing contradizer runtime |
| **DECISÃO CLIENTE** | Código formato · valores PromoPoints · cancelamento · 18+ · exclusividade · destaque · validade pontos · desconto à vista · “5 min” · verbo ATIVAR |
| **FUTURO CONTRATUAL** | CRM · entitlements · apps · dashboard ops · antifraude completo · galeria |

**Parte 46 (WP) — correções pequenas:** **nenhuma necessária** para fechar Client Returns.  
**Parte 47 — testes:** reutilizar evidência fresca (CR01/02, M3A/B, verify EXIT 0); sem alteração de código nesta auditoria.  
**Parte 48 — git:** sem push/PR/deploy/`db push`; artefato local `docs/audits/2026-09-02-final-client-audit.md`.

---

## Confirmações W (checklist)

- [x] **QA V1 E V2 FORAM AUDITADOS ITEM A ITEM.**  
- [x] **NENHUM RETORNO DO CLIENTE FOI SILENCIOSAMENTE EMPURRADO PARA O FUTURO.** (Galeria = PARCIAL explícita sob PRODUCT-COMPLETE-WEB, não retorno CR aberto.)  
- [x] **REQUISITOS DE PRODUTO FINAL FORAM DIFERENCIADOS DE RETORNOS QA.**  
- [x] **CONTRADIÇÕES DOCUMENTAIS NÃO FORAM RESOLVIDAS POR SUPOSIÇÃO.** (v2 §3.1 alegado; cancelamento; PRM vs PRMF; valores PromoPoints.)  
- [x] **NENHUM KPI FICTÍCIO FOI CRIADO.**  
- [x] **NENHUMA REGRA DE BILLING FICTÍCIA FOI CRIADA.**  
- [x] **NENHUMA MIGRATION HOSPEDADA FOI ALTERADA.**  
- [x] **NENHUMA ESCRITA FOI EXECUTADA NO SUPABASE HOSPEDADO.**  
- [x] **PROMOFY-01-09-2026.XML NÃO FOI ALTERADO.**

---

## Veredito final

| Item | Resultado |
|---|---|
| QA v1/v2 (retornos Client Returns) | Efetivamente zerados no runtime auditado |
| BLOCKER CLIENT RETURNS | **nenhum** |
| Correções mínimas de código neste WP | **nenhuma** |
| **FINAL CLIENT AUDIT** | **PASS** |
| **CLIENT RETURNS** | **COMPLETE — READY FOR CONSOLIDATED PUBLICATION** |

Próximo passo operacional (fora deste artefato): OK humano para publicação consolidada do lote + roadmap P0 acima — sem implementar Billing/CRM/Legal/Apps nesta etapa.
