import { Plus } from "lucide-react";

import { MobilePageHeader } from "@/components/mobile-page-header";

export default function PagamentoPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Pagamento" back="/m/perfil" />

      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        {/* Cartão cadastrado */}
        <div
          className="relative flex h-44 flex-col justify-between overflow-hidden rounded-card p-5 text-white shadow-card"
          style={{ background: "linear-gradient(135deg, #1414DC 0%, #0F0FA8 100%)" }}
        >
          <div className="bg-dots absolute inset-0 opacity-20" />
          <div className="relative flex items-start justify-between">
            <span className="text-xs font-medium text-white/80">
              Cartão cadastrado
            </span>
            <span className="text-lg font-extrabold italic tracking-wide">
              VISA
            </span>
          </div>
          <p className="relative text-lg font-semibold tracking-[0.2em]">
            •••• •••• •••• 4821
          </p>
          <div className="relative flex items-center gap-6 text-xs">
            <div>
              <p className="text-white/70">DATA</p>
              <p className="font-semibold">12/29</p>
            </div>
            <div>
              <p className="text-white/70">CVV</p>
              <p className="font-semibold">•••</p>
            </div>
          </div>
        </div>

        {/* Adicionar cartão */}
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-card border-2 border-dashed border-border py-4 text-sm font-bold text-primary hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          ADICIONAR CARTÃO
        </button>
      </div>
    </div>
  );
}
