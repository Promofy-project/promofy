import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Portabilidade — export dos próprios dados (Fase 14 LEGAL-PRIVACY-01).
 *
 * `auth.uid()` é a única autoridade: não há parâmetro de usuário nesta
 * rota, então não existe caminho para pedir o export de outra conta. RLS
 * ("dono le o proprio" em cada tabela) já limita cada seleção à própria
 * sessão; o filtro explícito por `uid` abaixo é defesa em profundidade,
 * não a fronteira real.
 *
 * Sem tokens/segredos: nenhuma tabela aqui guarda credencial — `profiles`
 * não tem hash de senha (isso vive em `auth.users`, gerenciado pelo
 * GoTrue e fora deste export).
 */
export async function GET() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) {
    return NextResponse.json({ ok: false, motivo: "sem_sessao" }, { status: 401 });
  }

  const [perfil, cupons, pontos, favoritos, avaliacoes, aceites] = await Promise.all([
    supabase
      .from("profiles")
      .select("nome, cidade, telefone, nascimento, criado_em")
      .eq("id", uid)
      .maybeSingle(),
    supabase
      .from("cupons_usuario")
      .select("cupom_id, status, codigo, ativado_em, expira_em, validado_em, nps")
      .eq("usuario_id", uid),
    supabase
      .from("pontos_transacoes")
      .select("acao, pontos, criado_em")
      .eq("usuario_id", uid),
    supabase.from("favoritos").select("estabelecimento_id, criado_em").eq("usuario_id", uid),
    supabase
      .from("avaliacoes")
      .select("estabelecimento_id, nota, comentario, criado_em")
      .eq("usuario_id", uid),
    supabase
      .from("aceites_documento")
      .select("documento, versao, aceito_em")
      .eq("usuario_id", uid),
  ]);

  const corpo = {
    gerado_em: new Date().toISOString(),
    perfil: perfil.data ?? null,
    cupons_usuario: cupons.data ?? [],
    pontos_transacoes: pontos.data ?? [],
    favoritos: favoritos.data ?? [],
    avaliacoes: avaliacoes.data ?? [],
    aceites_documento: aceites.data ?? [],
  };

  return new NextResponse(JSON.stringify(corpo, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="promofy-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
