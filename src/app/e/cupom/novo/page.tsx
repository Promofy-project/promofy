import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { NovoCupomForm } from "./novo-cupom-form";

export const dynamic = "force-dynamic";

/**
 * Criar cupom (form reduzido ao essencial). A categoria vem pré-setada do
 * estabelecimento (D2-mínimo) — campos avançados (agendamento, horários)
 * ficam só na plataforma web. Reusa criarCupomAction.
 */
export default async function NovoCupomPage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;

  let categoriaId: string | null = null;
  let categoriaLabel: string | null = null;
  if (uid) {
    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("categoria_id")
      .eq("owner_id", uid)
      .maybeSingle();
    categoriaId = est?.categoria_id ?? null;
    if (categoriaId) {
      const { data: cat } = await supabase
        .from("categorias")
        .select("label")
        .eq("id", categoriaId)
        .maybeSingle();
      categoriaLabel = cat?.label ?? null;
    }
  }

  return (
    <div className="flex flex-1 flex-col p-5">
      <header className="flex items-center gap-2 pb-5">
        <Link
          href="/e/cupons"
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Novo cupom</h1>
      </header>

      <NovoCupomForm categoriaId={categoriaId} categoriaLabel={categoriaLabel} />
    </div>
  );
}
