import { createClient } from "@/lib/supabase/server";
import { ConfiguracoesClient } from "./configuracoes-client";

/**
 * Server component: lê a tabela de pontos (config_pontos) do banco — a
 * FONTE ÚNICA que o app do consumidor também consome. Encerra a
 * duplicação que existia entre gamification.ts e esta tela. A edição
 * (escrita) fica para a Fase 3.
 */
export default async function AdminConfiguracoes() {
  const supabase = createClient();
  const { data } = await supabase.from("config_pontos").select("acao, pontos");
  const configPontos = Object.fromEntries(
    (data ?? []).map((r) => [r.acao, r.pontos]),
  );
  return <ConfiguracoesClient configPontos={configPontos} />;
}
