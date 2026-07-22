import Link from "next/link";
import { BellRing } from "lucide-react";

import { buscarCuponsNovidades } from "@/lib/data/cupons";
import { createClient } from "@/lib/supabase/server";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { CouponListItem } from "@/components/coupon-list-item";
import { Button } from "@/components/ui/button";
import { MarcarNovidadesVistas } from "./marcar-vistas";

export const dynamic = "force-dynamic";

/**
 * Novidades dos favoritos (Fase 4): cupons publicados pelos
 * estabelecimentos favoritados DEPOIS de o usuário favoritá-los e do
 * último visto (predicado na RPC novidades_favoritos). Abrir a página
 * marca como visto (zera o badge do sino). Anônimo → convite a logar.
 */
export default async function NovidadesPage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const logado = Boolean(claims?.claims?.sub);
  const cupons = logado ? await buscarCuponsNovidades() : [];

  return (
    <div className="flex flex-col">
      {logado && <MarcarNovidadesVistas />}
      <MobilePageHeader title="Novidades" back="/m" />

      <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
        {cupons.length > 0 ? (
          cupons.map((c) => (
            <CouponListItem key={c.id} cupom={c} href={`/m/cupom/${c.id}`} />
          ))
        ) : (
          <div className="grid place-items-center rounded-card border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <div className="max-w-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <BellRing className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-bold">
                {logado ? "Nenhuma novidade por aqui" : "Entre para receber novidades"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {logado
                  ? "Quando um estabelecimento favorito publicar um cupom novo, ele aparece aqui."
                  : "Faça login e favorite estabelecimentos para ser avisado quando publicarem cupons novos."}
              </p>
              <Button asChild className="mt-6">
                <Link href={logado ? "/m/favoritos" : "/m/login"}>
                  {logado ? "Ver favoritos" : "Entrar"}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
