# LEGAL-PRIVACY-01H — auditoria da fonte primária (docs/legal/source/)

**Data:** 2026-09-08
**Branch:** `feat/legal-privacy-data-lifecycle`
**Método:** cada um dos 5 `.docx` foi descompactado (é um `.zip`) e seu `word/document.xml` convertido
para texto puro, parágrafo a parágrafo, sem reescrever nenhuma palavra. O texto extraído vive,
verbatim, em `src/lib/legal-content/*.ts`. Toda afirmação abaixo cita o documento real — nenhuma vem
de memória do WP anterior (`docs/audits/2026-09-02-final-client-audit.md`), que já registrava
explicitamente que os PDFs/DOCX não estavam no repositório naquele momento.

---

## 1. Política de Privacidade v2.0 (`02_Politica_de_Privacidade_v2_0.docx`)

| Campo | Valor extraído do documento |
|---|---|
| Nome | Política de Privacidade — Promofy |
| Versão | 2.0 |
| Status textual | "Última atualização: **[DATA DE PUBLICAÇÃO]**" — placeholder literal, não uma data |
| Identidade/CNPJ | PROMOFY TECNOLOGIA INOVA SIMPLES (I.S.), CNPJ 68.003.330/0001-74, sede Quadra ARSO 151 QI 26, nº 42B, Alameda 34, Plano Diretor Sul, Palmas–TO, CEP 77.025-440 |
| Contatos | `contato@usepromofy.com` (citado no preâmbulo); `privacidade@usepromofy.com` (§4, §7, §8) |
| Infraestrutura mencionada | "**Supabase, Google Cloud Platform**" (§3, compartilhamento com provedores de tecnologia) — **contradiz o runtime real (Vercel + Supabase)** |
| Regras de produto | Planos/assinaturas via execução de contrato; CRM export para parceiros; sugestões por IA/recomendação personalizada com base em consentimento |
| Aceite | "O uso da Promofy implica aceite integral desta Política" (§9) — aceite implícito pelo uso, não um checkbox explícito descrito neste documento (diferente do Termo Consumidor, que É explícito) |
| Alterações/reaceite | §8: alterações relevantes comunicadas com **antecedência mínima de 10 dias** antes de entrarem em vigor |
| Retenção | §6: dados mantidos enquanto o vínculo estiver ativo; após encerramento, **anonimização em até 30 dias**, salvo obrigação legal; dados fiscais retidos 5 anos (CTN); exclusão antecipada a pedido do usuário, efetivada em até 30 dias |
| Dados coletados | Nome, CPF, nascimento, RG (quando aplicável), e-mail, telefone, dados de pagamento (via gateway, cartão não armazenado), dispositivo, IP, geolocalização (mediante autorização), interações; para parceiro: razão social, CNPJ, endereço, geolocalização, dados do representante (nome/CPF/cargo/telefone/e-mail) |
| Cookies | Remete à Política de Cookies (não repete o conteúdo aqui) |
| PromoPoints | Não citado nominalmente nesta política (fica no Termo dedicado) |
| Segurança | TLS 1.2+, MFA para produção, logs de auditoria ≥12 meses, backups criptografados diários, least privilege, notificação de incidente relevante em até 24h |

**Achado adicional:** o e-mail no preâmbulo aparece com "CEP 77.025-440" duplicado na mesma frase (erro de digitação do próprio documento-fonte, não nosso) — registrado, não corrigido.

---

## 2. Política de Cookies v2.0 (`03_Politica_de_Cookies_v2_0.docx`)

| Campo | Valor extraído do documento |
|---|---|
| Nome | Política de Cookies — Promofy |
| Versão | 2.0 |
| Status textual | "Última atualização: **[DATA DE PUBLICAÇÃO]**" — mesmo placeholder |
| Identidade/CNPJ | PROMOFY TECNOLOGIA INOVA SIMPLES (I.S.), CNPJ 68.003.330/0001-74 |
| Contatos | `privacidade@usepromofy.com` (§6, §8); `contato@usepromofy.com` (§8) |
| Infraestrutura mencionada | Não cita infra de hosting diretamente |
| Regras de produto | Descreve **5 tipos de cookies**: Necessários (legítimo interesse), Desempenho, Funcionalidade, Publicidade, **Terceiros — nomeadamente Google Analytics e Meta Ads** (todos os 4 últimos por consentimento) |
| Aceite | Descreve um "**painel de consentimento granular**" que permite aceitar categorias específicas (§4) — **este painel não existe no runtime** |
| Alterações/reaceite | §7: mudanças relevantes comunicadas com antecedência mínima de 10 dias |
| Retenção | Não aplicável (não é sobre dados pessoais diretamente, é sobre cookies) |
| Dados | N/A — este documento é sobre cookies, não dados pessoais em geral |
| Cookies | Ver acima — é o assunto inteiro do documento |
| PromoPoints | Não mencionado |

**Contradição central (Fase 5-B):** o documento descreve Google Analytics, Meta Ads, remarketing e um painel granular de consentimento. **Runtime auditado (grep completo em `src/`): zero tracker opcional, zero painel granular.** Ver §Fase 10 abaixo — este documento fica DRAFT até o cliente decidir se atualiza o texto para refletir o runtime atual ou se de fato pretende adotar esses trackers.

---

## 3. Termos de Uso — Consumidor v2.0 (`04_Termos_de_Uso_Consumidor_v2_0.docx`)

| Campo | Valor extraído do documento |
|---|---|
| Nome | Termos de Uso — Plataforma Promofy, Usuários Consumidores |
| Versão | 2.0 |
| Status textual | "[DATA DE PUBLICAÇÃO]" |
| Identidade/CNPJ | **Contradição interna do próprio documento**: cabeçalho diz "CNPJ 68.003.330/0001-74"; a tabela de identificação (§1) diz "CNPJ: **A ser obtido no ato da abertura**" — as duas frases estão no MESMO arquivo |
| Contatos | `contato@usepromofy.com`; DPO/Privacidade `privacidade@usepromofy.com` |
| Infraestrutura | Não cita diretamente |
| Regras de produto | Idade 18+/emancipado (§3); CPF único, não permite conta duplicada; planos Promo/Básico/Plus/Família/VIP com preços **R$9,90/R$19,90/R$29,90 — batem com o seed atual**; planos pagos são **anuais** (12 meses, à vista ou parcelado), cancelamento não interrompe cobrança das parcelas restantes; **direito de arrependimento 7 dias** (CDC art. 49); código do cupom formato **PRM-XXXXXX**, validade 5h, push 1h antes de expirar; cancelamento **não permitido após exibição do código**; bloqueio de reativação por 24h após cancelamento; bloqueio de 24h se cancelar o mesmo cupom 3+ vezes no mesmo dia; "Resgatado sem baixa" não gera PromoPoints nem NPS; catálogo do plano gratuito limitado a cupons com desconto ≥ preço do plano Básico |
| Aceite | §Preâmbulo: "declara ter lido, compreendido e aceito integralmente" — "condição essencial para utilização"; §3: "aceite dos Termos de Uso é obrigatório para finalizar o cadastro" |
| Alterações/reaceite | §14: antecedência mínima de 10 dias; uso contínuo após alteração implica concordância |
| Retenção | §12: remete à Política de Privacidade após encerramento; encerramento não exime pagamento de parcelas vincendas do plano anual (ressalvado o direito de arrependimento) |
| Dados | Remete à Política de Privacidade (§11) |
| Cookies | Não tratado aqui (documento próprio) |
| PromoPoints | §6/§7: resgate confirmado + NPS geram pontos; ranking mensal; indicação com link exclusivo; **não especifica os valores numéricos aqui** (ficam no Termo dedicado) |

---

## 4. Termo de Uso — Estabelecimentos Parceiros v3.0 (`05_Termos_de_Uso_Parceiros_v3_0.docx`)

| Campo | Valor extraído do documento |
|---|---|
| Nome | Termo de Uso — Estabelecimentos Parceiros |
| Versão | 3.0 |
| Status textual | "[DATA DE PUBLICAÇÃO]" |
| Identidade/CNPJ | PROMOFY TECNOLOGIA INOVA SIMPLES (I.S.), 68.003.330/0001-74 — **sem a contradição** que aparece no Termo Consumidor |
| Contatos | `contato@usepromofy.com`; `privacidade@usepromofy.com` (§16) |
| Infraestrutura | Não cita diretamente |
| Regras de produto | Cadastro exige razão social/CNPJ (ou nome/CPF PF), endereço, dados do representante (nome/CPF/cargo/e-mail/telefone), logotipo; **revisão manual obrigatória** de cadastro e de cupons "durante a fase de tração" (sem prazo definido de quando essa fase acaba); parceiro pode **ativar, pausar, reativar e editar** cupons (bate com o runtime pós CLIENT-CALL-CLOSURE-01); validação por QR, código (PRM-XXXXXX) ou CPF+nome; **CRM gerado automaticamente a cada resgate confirmado**: nome, e-mail, celular, nascimento e histórico — **sem CPF**, batendo exatamente com o runtime auditado no SECURITY-RPC-AUDIT-01; export em **Excel e PDF** — bate com CRM-01; parceiro é **controlador** dos dados de CRM perante a LGPD; sem prazo mínimo de permanência na fase de tração; desligamento voluntário com aviso de 15 dias |
| Aceite | §Preâmbulo: "declara ter lido, compreendido e aceito integralmente... condição essencial" |
| Alterações/reaceite | §15: antecedência de 10 dias; permanência após notificação implica aceite da nova versão |
| Retenção | Não trata explicitamente de retenção/anonimização de dados do PARCEIRO (só do CRM de clientes, que ele controla) |
| Dados | Ver CRM acima |
| Cookies | Não tratado |
| PromoPoints | Não tratado (é doc de consumidor) |

---

## 5. Termo de Participação — PromoPoints v1.0 (`Termo_Gamificacao_PromoPoints_Promofy.docx`)

| Campo | Valor extraído do documento |
|---|---|
| Nome | Termo de Participação no Programa de Gamificação — Sistema PromoPoints |
| Versão | 1.0 |
| Status textual | Sem placeholder `[DATA DE PUBLICAÇÃO]` explícito, mas também **sem data real nenhuma** — só "Versão 1.0" |
| Identidade/CNPJ | PROMOFY TECNOLOGIA INOVA SIMPLES (I.S.), 68.003.330/0001-74 |
| Contatos | `contato@usepromofy.com` (§1) |
| Infraestrutura | Não citada |
| Regras de produto | Participação voluntária, 18+, 1 conta por pessoa, pontos vinculados ao CPF, **sem valor monetário**, intransferíveis. **Tabela de valores (§4)**: Consumir cupom com baixa = **100** pts (sem limite); Avaliar/NPS = **50** pts (1×/cupom); Indicar amigo que assina = **200** pts (5×/mês, só após assinatura paga do indicado + 7 dias de arrependimento decorridos); Primeiro acesso = **50** pts (1× por conta); Check-in diário = **5** pts (1×/dia). Framework extenso de fraude (§6-8): condutas proibidas, estorno, advertência, suspensão, exclusão, banimento — nada disso existe hoje no runtime |
| Aceite | §1.2: aceite ao marcar opção, ao acumular/resgatar pontos, ou ao praticar ação pontuável; §10 declaração de aceite explícita |
| Alterações/reaceite | §9.1: publicação da versão atualizada no app, "com indicação da data de vigência"; não reduz pontos já acumulados retroativamente (salvo estorno por irregularidade) |
| Retenção | §5.5: encerramento de conta implica perda do saldo de PromoPoints |
| Dados | CPF como identificador, dispositivo, meio de pagamento (para detecção de fraude em indicação) |
| Cookies | Não tratado |
| PromoPoints | É o documento inteiro — ver tabela acima |

---

## Achados adicionais fora do escopo dos 5 documentos legais

A pasta `docs/legal/source/` também contém `DASHBOARD ADMINISTRATIVO - PROMOFY.pdf` e
`Promocao-na-palma-da-mao.pdf`. Estes **não são os 5 documentos jurídicos** deste WP — correspondem ao
"Dashboard Operacional Promofy v1.0" e ao "Anexo I / deck" que `docs/audits/2026-09-02-final-client-audit.md`
Parte 31-34 e Parte 41 já haviam registrado como **FONTE AUSENTE NO REPO**. Não fazem parte do escopo
LEGAL-PRIVACY-01H (que é sobre Privacidade/Cookies/Termos/PromoPoints) — ficam anotados aqui como
"agora disponíveis" para um WP futuro de Dashboard Operacional, sem leitura/auditoria neste artefato.
