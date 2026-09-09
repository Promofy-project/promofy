import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ordenarGaleria,
  type ItemGaleria,
} from "@/lib/galeria-estabelecimento";
import { urlPublicaImagem } from "@/lib/imagem-cupom";

/**
 * Leitura da galeria do perfil do estabelecimento (CLIENT-RETURNS-03).
 *
 * Duas funções e não uma: a do lojista parte da SESSÃO (`owner_id`, nunca um
 * id vindo da URL) e a pública parte de um id de URL — mas essa segunda só
 * devolve o que a RLS já deixaria passar ("publico le de estabelecimento
 * ativo"). O id na URL não é credencial de nada; é só o filtro.
 */

export interface ImagemGaleria extends ItemGaleria {
  /** `null` quando o caminho gravado não casa com o formato/pasta — a UI omite. */
  url: string | null;
}

function paraImagens(
  linhas: { id: string; imagem: string; ordem: number; criado_em: string }[],
  estabelecimentoId: string,
): ImagemGaleria[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return ordenarGaleria(
    linhas.map((l) => ({
      id: l.id,
      imagem: l.imagem,
      ordem: l.ordem,
      criadoEm: l.criado_em,
    })),
  ).map((i) => ({
    ...i,
    // A MESMA barreira de `cupons.imagem`: caminho fora de formato ou de outra
    // pasta vira `null`, nunca URL. O CHECK da migration já impede gravar
    // assim, mas a renderização não confia no banco para isso — é a lição da
    // Fase 7, e ela vale igual aqui.
    url: urlPublicaImagem(i.imagem, estabelecimentoId, supabaseUrl),
  }));
}

/** Galeria do estabelecimento do lojista logado. Sem sessão/sem estab → []. */
export async function buscarGaleriaDaSessao(): Promise<{
  estabelecimentoId: string | null;
  imagens: ImagemGaleria[];
}> {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { estabelecimentoId: null, imagens: [] };

  const { data: est } = await supabase
    .from("estabelecimentos")
    .select("id")
    .eq("owner_id", uid)
    .maybeSingle();
  if (!est) return { estabelecimentoId: null, imagens: [] };

  const { data } = await supabase
    .from("estabelecimento_galeria")
    .select("id, imagem, ordem, criado_em")
    .eq("estabelecimento_id", est.id);

  return { estabelecimentoId: est.id, imagens: paraImagens(data ?? [], est.id) };
}

/**
 * Galeria pública de um estabelecimento. Vazia quando não há imagem OU quando
 * a RLS esconde (estabelecimento não-ativo) — a página trata os dois casos do
 * mesmo jeito: não renderiza a seção.
 */
export async function buscarGaleriaPublica(
  estabelecimentoId: string,
): Promise<ImagemGaleria[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("estabelecimento_galeria")
    .select("id, imagem, ordem, criado_em")
    .eq("estabelecimento_id", estabelecimentoId);
  return paraImagens(data ?? [], estabelecimentoId);
}
