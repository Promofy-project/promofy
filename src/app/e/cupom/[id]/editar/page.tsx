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
 * O form do totem cobre o mesmo conjunto persistido do portal (janela,
 * agendamento, prazo, regras). O layout é do totem; a regra gravada é a
 * mesma. Campo que este form não controla não entra no payload.
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
    .select("id, nome, categoria_principal_id")
    .eq("owner_id", claims?.claims?.sub ?? "")
    .maybeSingle();
  if (!est) notFound();

  // EDIÇÃO: as folhas ainda em catálogo, MAIS a categoria ATUAL do cupom
  // mesmo que ela tenha sido desativada depois. Sem essa exceção o campo
  // abriria sem seleção e sem rótulo, e salvar qualquer outra coisa
  // (um typo no título) forçaria uma recategorização que ninguém pediu.
  const categorias = (
    await buscarCategoriasEstab(est.id, est.categoria_principal_id)
  ).filter((c) => c.ativo || c.id === cupom.categoriaId);

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
        categoriaPrincipal={est.categoria_principal_id}
        cupomInicial={cupom}
        estabelecimentoId={est.id}
      />
    </div>
  );
}
