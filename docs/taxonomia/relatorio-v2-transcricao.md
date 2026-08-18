# Promofy — Relatório de Testes e Ajustes (v2)

> Transcrição do PDF recebido em 17/08/2026, versionada porque o plano
> `docs/superpowers/plans/2026-08-17-relatorios-qa-v1-v2.md` argumenta contra ela item a item.
> O v1 está em `docs/taxonomia/Promofy_Anotacoes_Devs.pdf`.
>
> **Quatro afirmações deste relatório não sobreviveram à leitura do código** — estão marcadas
> com ⚠️ abaixo, e a análise completa está na seção "Correções ao relatório" do plano.

Documento de repasse para a equipe de desenvolvimento. Organizado por área. **BUG** indica
comportamento incorreto; **MELHORIA** indica ajuste ou nova funcionalidade.

## 1. App / Portal do Estabelecimento

### 1.1 Edição de cupom — campos ausentes ⚠️

A tela de edição não permitiria inserir/alterar: data de início da validade; horários de consumo;
dias da semana válidos; opção de ocultar o cupom até o início da validade.

Consequência relatada: cupons criados pelo app do estabelecimento são preenchidos com todos os
dias e horário 00:00–23:59, o que descaracteriza cupons com restrição de dia/horário.

> ⚠️ **O formulário do portal tem os quatro campos** (`novo-cupom-form.tsx:391-397,409-426,445-482`),
> e o mesmo componente serve criação e edição. A hipótese que sobra é o formulário do **`/e`**,
> que é reduzido — ver Task 9 do plano.

### 1.2 Imagem do cupom — não editável (portal e app)

Não é possível ajustar/enquadrar a imagem. Imagens fora da proporção do card ficam
descentralizadas ou cortadas. Recomenda-se crop no momento do upload.

### 1.3 Reativação de cupons esgotados/expirados

Cupons esgotados/expirados que passam por edição não retornam ao fluxo de validação — não há
opção de reenviar para análise. Pedido: reativação pela própria edição, com reenvio automático.

### 1.4 Botão "Novo cupom" no dashboard — **BUG**

O botão não funciona (não abre o fluxo de criação).

### 1.5 Validação de cupom no portal

No portal, a validação só é possível através do código.

### 1.6 Exclusão de cupom

Não há forma prática de o estabelecimento excluir um cupom, no portal ou no app.

### 1.7 Campo "Estabelecimento" (portal)

Permitir alterar a logo. Avaliar galeria de imagens do local e dos produtos.

### 1.8 Campo "Cupons" (portal) — filtragem

Filtrar cupons por status, dia da semana, regras de consumo e outros critérios.

## 2. Painel do Admin

### 2.1 Avaliação de cupom — visualização da imagem

Ao avaliar um cupom, permitir ver a imagem vinculada. Hoje não é possível conferir na análise.

### 2.2 Edição de cupom pelo admin

O admin não consegue editar cupons. Habilitar — útil para corrigir inconsistências simples sem
rejeitar e recriar.

### 2.3 Lista de cupons utilizados pelo consumidor

Em Admin > Usuários, a lista aparece como nomes por extenso separados por vírgula. Sugestão:
lista vertical.

## 3. App do Consumidor

### 3.1 Cupom marcado como "Utilizado" sem ativação válida — **BUG** ⚠️

Cupom "Sobremesa grátis no jantar" (Sabor & Cia), regra de consumo Sex 18:00–22:00.

- **17:48** — consumidor tenta usar antes do início; sistema exibe "Cupom fora do intervalo de
  consumo" e bloqueia o botão. *(correto)*
- **18:27** — já dentro do horário válido, o cupom aparece como "Utilizado", sem nova tentativa
  de ativação registrada na janela permitida.

Causa provável apontada pelo cliente: a validação considera apenas se o horário exato da tentativa
está dentro da janela, em vez de considerar se a janela de 5h a partir da ativação sobrepõe o
horário de consumo válido. E a ativação teria sido processada no backend apesar do bloqueio na tela.

> ⚠️ **A segunda metade não se reproduz no código.** O botão fora da janela chama `setErro(...)` e
> nunca a RPC (`cupom-acao-usar.tsx:153`); a RPC recusa antes do `insert`, atomicamente
> (migration 15:170-172); o provider só toca estado no ramo de sucesso. **A primeira metade
> procede:** a ativação antecipada é de fato recusada hoje — é a Onda B do plano.

### 3.2 Botões "Usar cupom" vs "Regras de uso"

Alguns cupons aparecem com "Usar cupom" e outros com "Regras de uso". Entender e padronizar.

> Confirmado como defeito: o rótulo era decidido por `i % 3`, a posição no grid. Corrigido.

### 3.3 Indicadores contraditórios — cupom "Café do dia" — **BUG** ⚠️

Mais ativações do que cliques. Teoria do cliente: ativações em sequência sem fechar a tela.
Sugestão: fechar a tela automaticamente após cada ativação.

> ⚠️ **A teoria não se sustenta** — cada ativação passa por `handleUsar`, que registra o clique.
> A causa real é assimetria de durabilidade: `ativacao` é gravada no servidor dentro de
> `ativar_cupom`; `clique` é fire-and-forget no cliente. Clique perdido na rede = ativação sem
> clique. A sugestão trataria o sintoma errado e pioraria a UX — ver Task 4 do plano.

## 4. Regras de Negócio e Observações Gerais

### 4.1 Estrutura de planos

Não separar "mensal" e "anual" como planos distintos. Todos são anuais, com pagamento parcelado
(12 parcelas) ou pagamento único com desconto. O cliente se ofereceu para explicar o modelo
comercial — **aceitar a oferta antes de implementar.**

### 4.2 Histórico de cupons

Manter histórico de todos os cupons — ativos, inativos, excluídos, editados — para consulta e
auditoria.

> Consequência de desenho: exclusão de cupom precisa ser **soft delete**, não `DELETE` físico.
> Ver Task 11 do plano.

### 4.3 Modo noturno

Verificar como apps e portais se comportam em dark mode. Confirmar o comportamento esperado.

> Resposta honesta: **não há dark mode.** `darkMode:["class"]` no Tailwind é scaffold do shadcn e
> nenhuma classe `dark:` existe no `src/`.

## 5. Dúvidas para os Devs

1. **O NPS exibido para o estabelecimento segue a fórmula oficial (% promotores − % detratores)?**
   > **Sim.** `indicadores_estabelecimento` (migration 25:52-62,101-103) usa as faixas canônicas
   > (0–6 detrator, 7–8 neutro, 9–10 promotor) e `round(((prom - detr) * 100) / total)`. Notas
   > nulas ficam fora da base, e zero respostas devolve `tem_dados:false` com `score:null` — não
   > devolve 0, que significaria outra coisa.

2. **Onde o consumidor envia o feedback dentro do app?**
   > Dois caminhos, ambos no `/m`: o `NpsDialog` (`src/components/nps-dialog.tsx`), que abre quando
   > o app observa o cupom virar `validado` ao vivo; e o `NpsPendenteCard`
   > (`src/components/nps-pendente-card.tsx`), card na home para a nota que ficou pendente quando a
   > validação aconteceu no balcão sem o celular presente (Fase 9, migration 28). O fluxo não foi
   > identificado no teste provavelmente porque exige uma validação concluída para aparecer.
