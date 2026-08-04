# CLAUDE.md — como se trabalha neste repositório

Instruções operacionais do Promofy. O `README.md` cobre setup e design system; aqui ficam **processo,
princípios permanentes e armadilhas já pagas**. O `MIGRATIONS.md` é o diário de bordo do banco.

---

## 1. Princípios permanentes

Estes não são preferências — cada um foi comprado com um incidente.

### Nativo é o destino

> Regra no servidor, lógica pura em `src/lib` sem API de navegador, só-web isolado atrás de ponto trocável.

O app React Native vai **traduzir**, não decidir. Consequências práticas:

- **Regra de negócio vive no banco**, não na Server Action. O lojista tem `grant update` em 24 colunas de
  `cupons` e fala PostgREST direto — uma matriz de imutabilidade escrita só na Action seria decorativa
  (é o raciocínio da migration 20, e antes dele o da 9 e o da 19).
- **Módulos puros** (`src/lib/cupom-patch.ts`, `cupom-campos.ts`, `moderacao.ts`, `janela.ts`): sem
  `server-only`, sem DOM, **sem `Intl`**. O Hermes pode não trazer `Intl` completo — a Fase 5 registrou
  `Intl` como a dependência mais frágil desta camada. Importe-os por caminho relativo, não pelo alias do
  tsconfig do Next.
- **Só-web fica confinado num arquivo**, com o ponto de troca declarado em comentário. Precedentes:
  `src/components/password-input.tsx`, `src/components/campo-imagem.tsx`.

### As contas do cliente são intocáveis

`consumidor@promofy.test` e `convidado@promofy.test` têm **atividade real do cliente** — é a demo que o Lucas
mostra. Elas nunca são alvo de suíte, nunca são restauradas "para o baseline esperado" sem medir o estado real
antes.

- **Smoke** usa `convidado@`. `consumidor@` **nunca é tocado**.
- **Suítes `test:*:hosted` só com conta `qa-*` efêmera** — `scripts/_qa-conta.ts` cria e destrói a própria.
  Medido na Fase 4: `test:rls:hosted` contra a conta compartilhada apagaria 3 linhas de `cupons_usuario`,
  12 de `cupom_eventos` e 4 de `pontos_transacoes`, derrubando o saldo de 1.410 para 1.250.
- **Verifique a premissa antes de qualquer operação destrutiva.** Uma instrução que diz "restaure para o estado
  X" pode partir de uma premissa errada — cheque o estado real primeiro.

### Banco antes do código

Migrations são **aditivas** e vão ao ar **antes** do deploy, com OK explícito por passo. Existe sempre uma
janela em que o schema novo roda com o código antigo — o schema tem de sobreviver a ela. Quando a janela não
pode ser aditiva (migration 21 dropou e recriou `rejeitar_cupom`), ela precisa ser **curta e sem fila**, e isso
se planeja antes.

---

## 2. Fluxo de uma fase

```
branch  →  push  →  PREVIEW URL  →  smoke na preview  →  OK do Neemias  →  merge --no-ff  →  produção
```

1. **Branch** a partir da `main` (`fase-N-assunto`).
2. **Migrations primeiro**, com a entrada no `MIGRATIONS.md` no mesmo commit.
3. **`npm run verify`** verde (inclui `db:reset`, todas as suítes e o `next build`).
4. **Push da branch.** A Vercel constrói a **preview** automaticamente.
5. **Smoke na preview** — não em produção. Só depois disso é que se fala em merge.
6. **OK humano do Neemias.** Explícito, por passo, não presumido.
7. **Merge `--no-ff`** → push → acompanhar o build de produção até READY.
8. **Rollback armado antes do push:** anote o id do deployment atual
   (`npm run vercel:deployments`); ele é o candidato a Instant Rollback.

### O risco do preview — leia antes de rodar qualquer coisa

**A preview aponta para o banco de PRODUÇÃO.** Não há banco de staging. Um bug numa branch escreve em dados
reais do cliente, e a preview é justamente onde roda código que ainda não passou por revisão.

Regras, sem exceção:

- Smoke de preview usa **apenas** `qa-*` ou `convidado@`. Nunca `consumidor@`.
- **Nenhuma** suíte `test:*:hosted` contra preview — as suítes semeiam e apagam.
- Nada destrutivo: sem `delete` em massa, sem reset, sem "limpar para testar".
- Se a fase precisar de dados descartáveis, crie-os com prefixo próprio (`f65-*`, `f7-*`) e apague-os no fim.

Confirme, uma vez por fase, que o ambiente **Preview** tem as duas `NEXT_PUBLIC_*`:

```
npm run vercel:env
```

A Fase 3 teve um deploy servindo 500 em todas as rotas do matcher (`MIDDLEWARE_INVOCATION_FAILED`) porque as
env vars não estavam aplicadas ao build. Não é hipotético.

---

## 3. Ferramentas

### Vercel — sem depender do OAuth

O conector MCP é conveniência (e expirou duas vezes no meio de um deploy). O caminho estável é a **API
REST** com token, em `scripts/vercel-api.ts`.

```
npm run vercel:deployments                              # o topo é o rollback candidate
npm run vercel:env                                      # NOMES por ambiente (nunca valores)
npm run vercel:env:set -- CHAVE preview,production      # lê o valor do .env.local
npm run vercel:rollback -- <deploymentId>
```

Token em `VERCEL_TOKEN` no `.env.local` (gitignored), com escopo do time **Promofy**.

**Por que não a CLI da Vercel:** ela consulta `/v2/user` no arranque, e um token de escopo de time recebe
404 ali — medido. Fazê-la funcionar exigiria um token de conta inteira, o oposto do que este projeto faz em
todo o resto. Se um dia `vercel dev`/`logs`/`deploy` forem necessários, aí se discute um token amplo e
temporário. O token vai no header, **nunca** em `--token`: argumento de processo é legível por outros
processos.

**Conta certa:** Supabase `bpeqpxvxgdyjjdcoycgp`, Vercel time `promo-project` / projeto `promofy` /
`promofy-pro.vercel.app`. **Nunca** as contas "Vertexa" — é outro projeto.

### Supabase

```
npm run db:reset      # supabase db reset + seed-users (auth.users some no reset)
npm run db:types      # regenera database.types.ts — confira o wc -l depois
npm run verify        # db:reset + todas as suítes + build
```

Aplicar no hospedado: `supabase migration list --linked` → `db push --linked --dry-run` → `db push --linked`.
MCP `apply_migration` + `migration repair` é **plano B**.

---

## 4. Armadilhas já pagas

| Armadilha | O que acontece |
|---|---|
| `npm run verify \| tail -80` | Devolve o exit code do **`tail`**, não do `verify`. Uma suíte vermelha passa por verde. |
| PowerShell 5.1 | Não tem `&&`; use os npm scripts (rodam no cmd.exe). `>` gera arquivo UTF-16 e quebra o build. |
| Datas fuso-dependentes | `new Date('2026-06-30')` é meia-noite UTC e desloca um dia em UTC-3 → SSR (Vercel/UTC) diverge do navegador (BR) e a **hidratação quebra só em produção**. Use o padrão de `formatShortDate` em `src/lib/utils.ts`. |
| `npm run build` com `npm run dev` ativo | Corrompe o `.next` compartilhado (404 de chunks, form vira GET). Mate o node, apague `.next`, suba de novo. |
| `"use server"` | **Todo export precisa ser `async`.** Um helper síncrono em `src/lib/actions/*` derruba o `next build`, e o `tsc` não pega. Helpers puros vão para `src/lib/`. |
| `ALTER TYPE ... ADD VALUE` | O valor novo não pode ser **usado** na mesma transação em que nasce — migration própria (padrão das 5 e 8). |
| `revoke` por coluna | É *no-op* quando existe grant de tabela. O padrão correto é `revoke update on table` + `grant update (colunas...)`. |
| `process.exit()` em suíte | **Não executa blocos `finally`** — a limpeza não roda e a conta `qa-*` fica órfã. `encerrar()` devolve o código; quem chama decide. |
| Docker local | Três stacks Supabase na mesma máquina. "studio unhealthy" costuma ser **contenção**, não defeito. |

---

## 5. Estrutura mental do projeto

| Rota | Quem usa | Login |
|---|---|---|
| `/m` | consumidor (app) | `/m/login` |
| `/e` | lojista no balcão | `/e/login` |
| `/portal` | lojista na web | `/portal/login` |
| `/admin` | equipe Promofy | `/admin/login` |

Contas de teste: `consumidor@` · `convidado@` · `lojista@` · `lojista2@` · `admin@` — todas `@promofy.test`,
senha `promofy123`. As duas primeiras são **do cliente** (ver §1).

**A fronteira de segurança real é o RLS no banco** — nenhuma regra vive só no front.
