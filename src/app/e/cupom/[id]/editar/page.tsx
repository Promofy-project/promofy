import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { buscarCupomParaEdicao } from "@/lib/data/cupons";
import { buscarCategoriasEstab } from "@/lib/data/estab";
import { createClient } from "@/lib/supabase/server";
import { NovoCupomForm } from "../../novo/novo-cupom-form";

export const dynamic = "force-dynamic";

/**
 * Edição RÁPIDA de cupom no /e (Fase 6.5/C2).
 *
 * O form do totem é um subconjunto declarado desde a Fase 4 ("campos
 * avançados ficam só na plataforma web"), e continua sendo: janela,
 * agendamento e prazo de ativação NÃO entram no payload — são exibidos
 * como leitura, com a nota de que se ajustam pelo portal. É por isso que
 * `editarCupomAction` recebe um input PARCIAL: campo que este form não
 * controla não pode ser sobrescrito por um default.
 *
 * A posse é garantida pela RLS (`cupons: lojista le os proprios`): cupom de
 * outro estabelecimento simplesmente não volta da consulta → 404.
 */
export default async function EditarCupomPage({
  params,
}: {
  params: { id: string };
}) {
  const cupom = await buscarCupomParaEdicao(params.id);
  if (!cupom) notFound();

  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: est } = await supabase
    .from("estabelecimentos")
    .select("id, nome, categoria_id")
    .eq("owner_id", claims?.claims?.sub ?? "")
    .maybeSingle();
  if (!est) notFound();

  const categorias = await buscarCategoriasEstab(est.id, est.categoria_id);

  return (
    <div className="flex flex-1 flex-col gap-4 p-5">
      <header className="flex items-center gap-2">
        <Link
          href="/e/cupons"
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Editar cupom</h1>
      </header>

      <NovoCupomForm
        categorias={categorias}
        categoriaPrincipal={est.categoria_id}
        cupomInicial={cupom}
        estabelecimentoId={est.id}
      />
    </div>
  );
}
