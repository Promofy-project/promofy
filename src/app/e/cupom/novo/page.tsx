import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { buscarCategoriasEstab, type CategoriaEstab } from "@/lib/data/estab";
import { NovoCupomForm } from "./novo-cupom-form";

export const dynamic = "force-dynamic";

/**
 * Criar cupom (form reduzido ao essencial). Fase 4: o estabelecimento
 * pode ter N categorias (junção) — o form lista todas, com a principal
 * pré-selecionada. Campos avançados (agendamento, horários) ficam só na
 * plataforma web. Reusa criarCupomAction.
 */
export default async function NovoCupomPage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;

  let categorias: CategoriaEstab[] = [];
  let categoriaPrincipal: string | null = null;
  if (uid) {
    const { data: est } = await supabase
      .from("estabelecimentos")
      .select("id, categoria_id")
      .eq("owner_id", uid)
      .maybeSingle();
    if (est) {
      categoriaPrincipal = est.categoria_id;
      categorias = await buscarCategoriasEstab(est.id, est.categoria_id);
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

      <NovoCupomForm categorias={categorias} categoriaPrincipal={categoriaPrincipal} />
    </div>
  );
}
