"use server";

import { createClient } from "@/lib/supabase/server";
import { contarAvisosNaoLidos } from "@/lib/data/avisos";

/**
 * Actions do mural (Fase 8/M1).
 *
 * Lembrete da casa: em arquivo `"use server"` TODO export precisa ser `async`
 * — um helper síncrono aqui derruba o `next build`, e o `tsc` não pega.
 */

type Resultado = { ok: true } | { ok: false; erro: string };

/**
 * Admin publica um aviso.
 *
 * A autorização é da RLS (`avisos: admin gerencia`), não desta função: um
 * lojista que chame isto recebe 0 linhas da policy. A checagem aqui é só para
 * dar mensagem melhor.
 */
export async function publicarAvisoAction(input: {
  titulo: string;
  corpo: string;
  paraTodos: boolean;
  estabelecimentos: string[];
}): Promise<Resultado> {
  try {
    const titulo = input.titulo.trim();
    const corpo = input.corpo.trim();
    if (!titulo) return { ok: false, erro: "O título é obrigatório." };
    if (!corpo) return { ok: false, erro: "Escreva o recado." };
    if (!input.paraTodos && input.estabelecimentos.length === 0) {
      return { ok: false, erro: "Escolha ao menos um estabelecimento — ou marque “todos”." };
    }

    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims?.sub;
    if (!uid) return { ok: false, erro: "Sessão expirada. Entre novamente." };

    const { data: aviso, error } = await supabase
      .from("avisos")
      .insert({ titulo, corpo, para_todos: input.paraTodos, criado_por: uid })
      .select("id")
      .single();
    // 0 linhas = a policy filtrou (não é admin). Mesma leitura do resto do
    // projeto: policy que filtra devolve vazio, não erro.
    if (error || !aviso) return { ok: false, erro: "Não foi possível publicar o aviso." };

    if (!input.paraTodos) {
      const { error: eDest } = await supabase
        .from("avisos_destinatarios")
        .insert(input.estabelecimentos.map((id) => ({ aviso_id: aviso.id, estabelecimento_id: id })));
      if (eDest) {
        // Aviso sem destinatário não alcança ninguém e ficaria invisível para
        // sempre — melhor desfazer do que deixar um fantasma na lista do admin.
        await supabase.from("avisos").delete().eq("id", aviso.id);
        return { ok: false, erro: "Não foi possível definir os destinatários." };
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível publicar o aviso." };
  }
}

/** Lojista marca um aviso como lido. Idempotente no servidor. */
export async function marcarAvisoLidoAction(avisoId: string): Promise<Resultado> {
  try {
    const supabase = createClient();
    const { data } = await supabase.rpc("marcar_aviso_lido", { p_aviso_id: avisoId });
    const r = data as unknown as { ok?: boolean } | null;
    return r?.ok ? { ok: true } : { ok: false, erro: "Não foi possível marcar como lido." };
  } catch {
    return { ok: false, erro: "Não foi possível marcar como lido." };
  }
}

/**
 * Contagem para o badge, chamada pelo client a cada navegação.
 *
 * Existe como action porque a bottom nav do `/e` vive no LAYOUT, e layout não
 * re-renderiza ao navegar (lição da Fase 4, registrada em `src/app/m/page.tsx`:
 * o badge ficaria stale a sessão inteira). O client refaz esta chamada quando
 * o pathname muda — é o "atualiza em navegação" sem realtime.
 */
export async function contarAvisosNaoLidosAction(): Promise<number> {
  return contarAvisosNaoLidos();
}
