# CLIENT-CALL-CLOSURE-01 Implementation Plan

> Executor: inline (este WP). Sem commit/push. Sem CRM. Sem XML.

**Goal:** Fechar pausa/retomada, capacidade/FOMO, UX de reativação e paridade /e, sem reescrever janela nem reserva.

**Architecture:** Reusar `status_cupom.indisponivel` como Pausado. RPCs `pausar_cupom`/`retomar_cupom`/`indicadores_vitrine_cupons`. `ativar_cupom` passa a travar a linha sempre e reler o status sob lock. UI traduz; regra mora no banco.

**Tech Stack:** Postgres/RLS, Next.js 14, módulos puros em `src/lib`.

## Global Constraints

- Fonte de verdade: Lucas → QA v1/v2 → código atual → testes.
- Não reimplementar janela_alcance nem reserva se já passam.
- `indisponivel` = Pausado (Portal/e) / Temporariamente indisponível (consumidor).
- Disponíveis ≠ resgates. Ilimitado sem urgência falsa.
- Esgotado: nova campanha, histórico intacto. Expirado: prorroga → pendente.
- Sem escrita hospedada, sem CRM, sem XML, sem commit.

## Já correto (não refazer)

- Janela: `janela_alcance` + teto em `expira_em` (migrations 29/30/34).
- Reserva: ocupados = validado + ativo vigente; FOR UPDATE antes do clique.
- `/e` já persiste janela, limites, taxas, formas, tipo, imagem, crop 2:1.
- Crop: `CampoImagem` + `CropImagem` + `ASPECTO_IMAGEM_CUPOM = 2`.
- CPF/código/NPS: PRE-CALL + Fase 8/9. Só regressão.
- Dark: `html { color-scheme: light }`. Galeria: deferred.

## A fazer

1. Migration `20260907120000` — pausar/retomar + indicadores + lock de ativação + carimbo esgotado em pausado.
2. Ciclo/UI — `pausado` no portal; Pausar/Retomar; FOMO; Reativar.
3. Suíte `scripts/test-client-call-closure.ts` (itens 1–50).
4. Ajustar D1: `indisponivel` → `pausado` (contrato novo, explícito).
