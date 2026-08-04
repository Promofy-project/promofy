import { Megaphone } from "lucide-react";

import { buscarAvisosDoLojista } from "@/lib/data/avisos";
import { MuralLista } from "./mural-lista";

export const dynamic = "force-dynamic";

/**
 * Mural de recados do estabelecimento (Fase 8/M1).
 *
 * Modo totem: cartão grande, pouca coisa por tela, alvo de toque generoso. A
 * gestão (publicar, ver quem leu) é do admin; aqui o lojista só recebe.
 *
 * Referência de identidade: docs/modelo/estabelecimento-mobile/
 * "Mural de informações.png" — referência de IDENTIDADE, não de arquitetura.
 */
export default async function MuralPage() {
  const avisos = await buscarAvisosDoLojista();

  return (
    <div className="flex flex-1 flex-col gap-4 p-5">
      <header>
        <h1 className="text-xl font-extrabold">Mural</h1>
        <p className="text-sm text-muted-foreground">Recados da equipe Promofy.</p>
      </header>

      {avisos.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
            <Megaphone className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-semibold">Nenhum recado por aqui</p>
          <p className="max-w-[240px] text-xs text-muted-foreground">
            Quando a equipe Promofy publicar um aviso, ele aparece nesta tela.
          </p>
        </div>
      ) : (
        <MuralLista avisos={avisos} />
      )}
    </div>
  );
}
