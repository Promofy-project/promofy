/**
 * Seed de usuários de teste (Fase 1) — roda APÓS `supabase db reset`
 * (o npm script `db:reset` encadeia os dois passos).
 *
 * Usa a admin API com SUPABASE_SERVICE_ROLE_KEY — chave que JAMAIS
 * pode chegar ao browser; este script roda apenas no Node local.
 *
 * Cria (idempotente):
 *   consumidor@promofy.test / promofy123  (role padrão)
 *   lojista@promofy.test    / promofy123  (app_metadata.role=lojista)
 *   admin@promofy.test      / promofy123  (app_metadata.role=admin)
 * Liga estabelecimentos.e1.owner_id ao lojista e vincula a 1ª
 * avaliação do seed ao consumidor (exercita a FK usuario_id).
 */
import { config } from "dotenv";
// Alvo padrão = stack local; `--hosted` aponta ao Supabase hospedado
// (.env.hosted.local, gitignored). dotenv NÃO lê .env.local sozinho.
const hosted = process.argv.includes("--hosted");
const envFile = hosted ? ".env.hosted.local" : ".env.local";
config({ path: envFile });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error(
    `Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em ${envFile}.\n` +
      "Local: rode `supabase start` (ver .env.local.example). Hosted: preencha .env.hosted.local.",
  );
  process.exit(1);
}

// Alerta de alvo — este script usa service_role e ESCREVE dados.
console.log(`\n[seed-users] alvo: ${hosted ? "HOSPEDADO" : "local"} (${envFile}) → ${new URL(url).host}\n`);

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface UsuarioTeste {
  email: string;
  role: "consumidor" | "lojista" | "admin";
  nome: string;
}

const USUARIOS: UsuarioTeste[] = [
  { email: "consumidor@promofy.test", role: "consumidor", nome: "Lucas Orladi" },
  // 2º consumidor de demo (cliente + esposa usando ao mesmo tempo, sessões separadas)
  { email: "convidado@promofy.test", role: "consumidor", nome: "Convidada Demo" },
  { email: "lojista@promofy.test", role: "lojista", nome: "Sabor & Cia" },
  { email: "lojista2@promofy.test", role: "lojista", nome: "PowerFit Academia" },
  { email: "admin@promofy.test", role: "admin", nome: "Equipe Promofy" },
];

/** CPF fictício do consumidor de demo — máscara vira 123.***.***-09. */
const CPF_DEMO = "123.456.789-09";

/** Bônus de boas-vindas (Fase 2): mantém o saldo da demo (era o
 * SALDO_BASE mockado). Novos usuários reais começam em 0. */
const BONUS_DEMO = 1250;

const SENHA = "promofy123";

async function acharPorEmail(email: string): Promise<string | null> {
  // Base de teste é minúscula — paginação simples basta.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function garantirUsuario(u: UsuarioTeste): Promise<string> {
  const existente = await acharPorEmail(u.email);
  if (existente) {
    console.log(`= ${u.email} já existe (${existente})`);
    return existente;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: SENHA,
    email_confirm: true,
    // role em app_metadata (NÃO user_metadata): o usuário não consegue
    // se auto-atribuir — só a admin API escreve aqui. O trigger
    // handle_new_user copia para profiles.role.
    app_metadata: u.role === "consumidor" ? {} : { role: u.role },
    user_metadata: { nome: u.nome },
  });
  if (error) throw error;
  console.log(`+ ${u.email} criado (${data.user.id})`);
  return data.user.id;
}

async function main() {
  const ids: Record<string, string> = {};
  for (const u of USUARIOS) {
    ids[u.email] = await garantirUsuario(u);
  }
  // atalhos por papel (lojista = dono do e1; lojista2 = dono do e2)
  ids.consumidor = ids["consumidor@promofy.test"];
  ids.convidado = ids["convidado@promofy.test"];
  ids.lojista = ids["lojista@promofy.test"];
  ids.lojista2 = ids["lojista2@promofy.test"];
  ids.admin = ids["admin@promofy.test"];

  // O GoTrue insere o usuário (disparando handle_new_user) ANTES de
  // mesclar o app_metadata customizado — então o trigger vê role vazio
  // e cria o profile como consumidor. Corrigimos o role explicitamente
  // via service_role (única via de escrita de role nesta fase).
  for (const u of USUARIOS) {
    if (u.role === "consumidor") continue;
    const { error } = await admin
      .from("profiles")
      .update({ role: u.role })
      .eq("id", ids[u.email]);
    if (error) throw error;
    console.log(`+ profiles.role → ${u.role} (${u.email})`);
  }

  // CPF fictício do consumidor (a máscara do produto precisa de algo
  // para mascarar) — incondicional p/ cobrir stacks já existentes.
  {
    const { error } = await admin
      .from("profiles")
      .update({ cpf: CPF_DEMO })
      .eq("id", ids.consumidor);
    if (error) throw error;
    console.log("+ consumidor.cpf (demo)");
  }
  {
    const { error } = await admin
      .from("profiles")
      .update({ cpf: "987.654.321-00" })
      .eq("id", ids.convidado);
    if (error) throw error;
    console.log("+ convidado.cpf (demo)");
  }

  // Liga e1 (Sabor & Cia) ao lojista e e2 (PowerFit) ao lojista2 —
  // dois donos distintos p/ provar isolamento entre estabelecimentos.
  for (const [estId, dono] of [
    ["e1", ids.lojista],
    ["e2", ids.lojista2],
  ] as const) {
    const { error } = await admin
      .from("estabelecimentos")
      .update({ owner_id: dono })
      .eq("id", estId);
    if (error) throw error;
    console.log(`+ ${estId}.owner_id → dono`);
  }

  // Bônus de boas-vindas dos consumidores de demo (consumidor + convidado —
  // cliente e esposa começam iguais). Ledger; select-first idempotente
  // (índice único usuario/acao/referencia protege).
  for (const bonusUid of [ids.consumidor, ids.convidado]) {
    const referencia = `bonus:${bonusUid}`;
    const { data: existente } = await admin
      .from("pontos_transacoes")
      .select("id")
      .eq("usuario_id", bonusUid)
      .eq("acao", "bonus")
      .eq("referencia_id", referencia)
      .maybeSingle();
    if (!existente) {
      const { error } = await admin.from("pontos_transacoes").insert({
        usuario_id: bonusUid,
        acao: "bonus",
        pontos: BONUS_DEMO,
        referencia_id: referencia,
      });
      if (error && error.code !== "23505") throw error;
      console.log(`+ bônus de boas-vindas (${BONUS_DEMO} pts) → ${bonusUid}`);
    } else {
      console.log(`= bônus de boas-vindas já lançado → ${bonusUid}`);
    }
  }

  // Vincula a avaliação da "Mariana Alves" ao consumidor de teste
  // (exercita a FK usuario_id; o nome exibido não muda).
  {
    const { error } = await admin
      .from("avaliacoes")
      .update({ usuario_id: ids.consumidor })
      .eq("usuario_nome", "Mariana Alves")
      .is("usuario_id", null);
    if (error) throw error;
    console.log("+ avaliação vinculada ao consumidor");
  }

  console.log("\nSeed de usuários OK. Credenciais (local/teste):");
  for (const u of USUARIOS) console.log(`  ${u.email} / ${SENHA} (${u.role})`);
  console.log("  (lojista = e1 Sabor & Cia · lojista2 = e2 PowerFit)");
}

main().catch((err) => {
  console.error("Seed de usuários falhou:", err);
  process.exit(1);
});
