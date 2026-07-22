import { buscarCuponsFavoritos } from "@/lib/data/cupons";
import { createClient } from "@/lib/supabase/server";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { FavoritosClient } from "./favoritos-client";

export const dynamic = "force-dynamic";

/**
 * Favoritos persistidos (Fase 4): o server component busca os cupons
 * visíveis dos estabelecimentos favoritados; o corpo client filtra ao
 * vivo pelo provider (desfavoritar some sem reload). Anônimo vê o
 * convite a logar.
 */
export default async function FavoritosPage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const logado = Boolean(claims?.claims?.sub);
  const cupons = logado ? await buscarCuponsFavoritos() : [];

  return (
    <div className="flex flex-col">
      <MobilePageHeader title="Favoritos" back="/m" />

      <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
        <FavoritosClient cupons={cupons} logado={logado} />
      </div>
    </div>
  );
}
