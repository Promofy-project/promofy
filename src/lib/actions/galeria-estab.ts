"use server";

/**
 * Galeria do PERFIL do estabelecimento — mutações (CLIENT-RETURNS-03).
 *
 * TODO EXPORT É `async`. Helper síncrono num arquivo `"use server"` derruba o
 * `next build` e o `tsc` não pega — armadilha já paga pelo projeto. O que é
 * puro mora em `src/lib/galeria-estabelecimento.ts`.
 *
 * A AUTORIDADE É `owner_id`, NUNCA O FORM
 *
 * Nenhuma destas actions aceita `estabelecimento_id` do cliente. O
 * estabelecimento sai da sessão (adicionar) ou das próprias linhas (remover,
 * reordenar). Um hidden input com o id do vizinho não muda nada — e mesmo se
 * a Action errasse, a RLS (`owns_estabelecimento`) e o CHECK de pasta da
 * migration 43 recusariam a linha.
 *
 * ORDEM OPERACIONAL — banco e storage não são uma transação
 *
 * ADICIONAR: sobe o objeto → insere a linha. Se o insert falhar, o objeto
 * recém-subido é apagado (mesmo padrão de `criarCupomAction`). Se ESSA
 * limpeza falhar, sobra um objeto órfão que nenhuma linha referencia:
 * invisível para o consumidor, custa bytes. Escolhido de propósito — o
 * inverso (linha antes do arquivo) mostraria imagem quebrada no perfil.
 *
 * REMOVER: apaga a LINHA → apaga o objeto. A linha é o que o consumidor vê;
 * derrubá-la primeiro garante que a foto some do perfil mesmo que o storage
 * recuse. O storage PODE recusar: a policy da migration 23 barra o DELETE de
 * um objeto referenciado por cupom já moderado, o que só acontece se o
 * próprio lojista tiver apontado `cupons.imagem` para um arquivo da galeria.
 * O resultado diz `arquivoRemovido: false` nesse caso — falha parcial
 * declarada, não engolida.
 */

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_IMAGENS,
  PATH_IMAGEM_RE,
  caminhoImagem,
  validarBytesImagem,
} from "@/lib/imagem-cupom";
import {
  MAX_IMAGENS_GALERIA,
  galeriaCheia,
  proximaOrdemGaleria,
} from "@/lib/galeria-estabelecimento";

type Falha = { ok: false; erro: string };

/** Revalida as três superfícies que mostram a galeria. */
function revalidarGaleria(estabelecimentoId: string) {
  revalidatePath("/portal/estabelecimento");
  revalidatePath("/e/perfil");
  revalidatePath(`/m/estabelecimentos/${estabelecimentoId}`);
  revalidatePath("/m/estabelecimentos");
}

/** Estabelecimento do lojista logado. Único ponto que resolve isso aqui. */
async function estabDaSessao() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { supabase, est: null as { id: string } | null };
  const { data: est } = await supabase
    .from("estabelecimentos")
    .select("id")
    .eq("owner_id", uid)
    .maybeSingle();
  return { supabase, est: est ?? null };
}

/**
 * Sobe uma imagem e a acrescenta ao FIM da galeria.
 *
 * Recebe `FormData` pelo mesmo motivo de `uploadImagemCupomAction`: é o único
 * payload binário, e `FormData` é o que o React serializa nativamente para
 * `File`. O tipo é decidido pelos MAGIC BYTES (`validarBytesImagem`), nunca
 * pela extensão nem pelo `Content-Type` — os dois são texto que o cliente
 * escolhe, e SVG/HTML renomeado é o vetor clássico.
 */
export async function adicionarImagemGaleriaAction(
  formData: FormData,
): Promise<{ ok: true; id: string; caminho: string } | Falha> {
  try {
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) return { ok: false, erro: "Nenhum arquivo enviado." };

    const { supabase, est } = await estabDaSessao();
    if (!est) {
      return {
        ok: false,
        erro: "Sessão expirada ou nenhum estabelecimento vinculado à sua conta.",
      };
    }

    // Teto ANTES de ler os bytes: recusar a 13ª foto não deve custar upload.
    // O trigger da migration 43 é a fronteira real; isto é a mensagem boa.
    const { data: atuais } = await supabase
      .from("estabelecimento_galeria")
      .select("id, imagem, ordem, criado_em")
      .eq("estabelecimento_id", est.id);
    const lista = (atuais ?? []).map((l) => ({
      id: l.id,
      imagem: l.imagem,
      ordem: l.ordem,
      criadoEm: l.criado_em,
    }));
    if (galeriaCheia(lista.length)) {
      return {
        ok: false,
        erro: `A galeria já tem ${MAX_IMAGENS_GALERIA} imagens. Remova uma para adicionar outra.`,
      };
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const v = validarBytesImagem(bytes);
    if (!v.ok) {
      const msg = {
        vazio: "Arquivo vazio.",
        muito_grande: "A imagem passa de 2 MB. Reduza e tente de novo.",
        tipo_invalido: "Formato não aceito. Use JPG, PNG ou WebP.",
      }[v.motivo];
      return { ok: false, erro: msg };
    }

    // O caminho é montado INTEIRO no servidor: o cliente não fornece pasta,
    // nem nome, nem extensão. Path traversal deixa de ser validação a acertar
    // e passa a ser impossível por construção.
    const { randomBytes } = await import("node:crypto");
    const caminho = caminhoImagem(est.id, randomBytes(16).toString("hex"), v.tipo.ext);

    const { error: errUp } = await supabase.storage
      .from(BUCKET_IMAGENS)
      .upload(caminho, bytes, { contentType: v.tipo.mime, upsert: false });
    if (errUp) return { ok: false, erro: "Não foi possível enviar a imagem." };

    const { data, error } = await supabase
      .from("estabelecimento_galeria")
      .insert({
        estabelecimento_id: est.id,
        imagem: caminho,
        ordem: proximaOrdemGaleria(lista),
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      // Objeto já no bucket e sem linha que o referencie: limpa.
      await supabase.storage.from(BUCKET_IMAGENS).remove([caminho]);
      return {
        ok: false,
        erro: error?.message?.includes("galeria_cheia")
          ? `A galeria já tem ${MAX_IMAGENS_GALERIA} imagens. Remova uma para adicionar outra.`
          : "Não foi possível salvar a imagem na galeria.",
      };
    }

    revalidarGaleria(est.id);
    return { ok: true, id: data.id, caminho };
  } catch {
    return { ok: false, erro: "Não foi possível enviar a imagem." };
  }
}

/**
 * Remove uma imagem da galeria.
 *
 * O `.eq("estabelecimento_id", est.id)` é cinto e suspensório: a policy de
 * DELETE já recusa linha alheia, e sem ela o `delete` sem filtro de posse
 * seria um bug esperando um dia em que a policy mude.
 */
export async function removerImagemGaleriaAction(
  id: string,
): Promise<{ ok: true; arquivoRemovido: boolean } | Falha> {
  try {
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, erro: "Imagem inválida." };
    }

    const { supabase, est } = await estabDaSessao();
    if (!est) {
      return {
        ok: false,
        erro: "Sessão expirada ou nenhum estabelecimento vinculado à sua conta.",
      };
    }

    const { data, error } = await supabase
      .from("estabelecimento_galeria")
      .delete()
      .eq("id", id)
      .eq("estabelecimento_id", est.id)
      .select("imagem")
      .maybeSingle();

    if (error) return { ok: false, erro: "Não foi possível remover a imagem." };
    // Nada apagado = a linha não é sua ou já não existe. A mensagem é a mesma
    // nos dois casos, de propósito: "não é sua" não precisa virar oráculo de
    // quais ids existem.
    if (!data) return { ok: false, erro: "Imagem não encontrada na sua galeria." };

    let arquivoRemovido = false;
    if (PATH_IMAGEM_RE.test(data.imagem) && data.imagem.startsWith(`${est.id}/`)) {
      const { error: errObj } = await supabase.storage
        .from(BUCKET_IMAGENS)
        .remove([data.imagem]);
      arquivoRemovido = !errObj;
    }

    revalidarGaleria(est.id);
    return { ok: true, arquivoRemovido };
  } catch {
    return { ok: false, erro: "Não foi possível remover a imagem." };
  }
}

/**
 * Grava a ordem inteira da galeria.
 *
 * Delega para a RPC `reordenar_galeria_estabelecimento`: a checagem de posse,
 * a exigência de lista completa e o UPDATE em massa acontecem numa transação
 * só. Fazer isso aqui com N chamadas PostgREST deixaria a galeria com ordem
 * parcial se uma delas falhasse.
 */
export async function reordenarGaleriaAction(
  ids: string[],
): Promise<{ ok: true } | Falha> {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, erro: "Nada para reordenar." };
    }
    if (ids.some((i) => typeof i !== "string" || !i.trim())) {
      return { ok: false, erro: "Lista de imagens inválida." };
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("reordenar_galeria_estabelecimento", {
      p_ids: ids,
    });
    if (error) return { ok: false, erro: "Não foi possível salvar a nova ordem." };

    const r = (data ?? {}) as { ok?: boolean; motivo?: string; estabelecimento_id?: string };
    if (!r.ok) {
      const msg: Record<string, string> = {
        sem_sessao: "Sessão expirada. Entre novamente.",
        lista_vazia: "Nada para reordenar.",
        nao_encontrado: "Alguma imagem da lista não existe mais. Atualize a página.",
        mistura_estabelecimentos: "Lista de imagens inválida.",
        nao_autorizado: "Esta galeria não é do seu estabelecimento.",
        lista_incompleta: "A galeria mudou. Atualize a página e tente de novo.",
      };
      return { ok: false, erro: msg[r.motivo ?? ""] ?? "Não foi possível salvar a nova ordem." };
    }

    if (r.estabelecimento_id) revalidarGaleria(r.estabelecimento_id);
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível salvar a nova ordem." };
  }
}
