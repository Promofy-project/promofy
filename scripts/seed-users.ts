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
config({ path: ".env.local" }); // dotenv NÃO lê .env.local sozinho

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.\n" +
      "Rode `supabase start` e copie os valores (ver .env.local.example).",
  );
  process.exit(1);
}

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
  { email: "lojista@promofy.test", role: "lojista", nome: "Sabor & Cia" },
  { email: "admin@promofy.test", role: "admin", nome: "Equipe Promofy" },
];

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
    ids[u.role] = await garantirUsuario(u);
  }

  // O GoTrue insere o usuário (disparando handle_new_user) ANTES de
  // mesclar o app_metadata customizado — então o trigger vê role vazio
  // e cria o profile como consumidor. Corrigimos o role explicitamente
  // via service_role (única via de escrita de role na Fase 1).
  for (const u of USUARIOS) {
    if (u.role === "consumidor") continue;
    const { error } = await admin
      .from("profiles")
      .update({ role: u.role })
      .eq("id", ids[u.role]);
    if (error) throw error;
    console.log(`+ profiles.role → ${u.role} (${u.email})`);
  }

  // Liga o estabelecimento e1 (Sabor & Cia) ao lojista de teste.
  {
    const { error } = await admin
      .from("estabelecimentos")
      .update({ owner_id: ids.lojista })
      .eq("id", "e1");
    if (error) throw error;
    console.log("+ e1.owner_id → lojista");
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
}

main().catch((err) => {
  console.error("Seed de usuários falhou:", err);
  process.exit(1);
});
