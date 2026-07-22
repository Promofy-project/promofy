import Link from "next/link";
import { QrCode, Ticket, Plus, TrendingUp, AlertTriangle } from "lucide-react";

import { buscarResumoEstab } from "@/lib/data/estab";
import { TotemActionCard } from "@/components/estab/totem-action-card";

export const dynamic = "force-dynamic";

/** Home operacional do estabelecimento — "modo totem": a ação dominante é
 *  "Validar cupom"; abaixo, o resumo do dia e atalhos. Sem dashboard pesado. */
export default async function EstabHomePage() {
  const { estabelecimento, cuponsAtivos, resgatesHoje } = await buscarResumoEstab();
  const status = estabelecimento?.status;

  return (
    <div className="flex flex-1 flex-col gap-6 p-5">
      <header className="pt-2">
        <p className="text-sm text-muted-foreground">Bem-vindo</p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {estabelecimento?.nome ?? "Estabelecimento"}
        </h1>
      </header>

      {status && status !== "ativo" && (
        <div className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <span>
            {status === "pendente"
              ? "Seu estabelecimento está em análise. Os cupons aparecem no app após a aprovação."
              : "Seu estabelecimento está suspenso. Os cupons não aparecem no app até a reativação."}
          </span>
        </div>
      )}

      {/* Ação dominante */}
      <Link href="/e/validar" className="block active:scale-[0.99]">
        <div className="flex min-h-[116px] flex-col justify-center gap-2 rounded-card bg-primary px-6 py-5 text-primary-foreground shadow-card">
          <div className="flex items-center gap-3">
            <QrCode className="h-8 w-8" />
            <span className="text-2xl font-extrabold">Validar cupom</span>
          </div>
          <span className="text-sm text-primary-foreground/80">
            Toque para validar o código apresentado pelo cliente.
          </span>
        </div>
      </Link>

      {/* Resumo do dia */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border bg-card p-4">
          <Ticket className="h-5 w-5 text-primary" />
          <p className="mt-2 text-3xl font-extrabold leading-none">{cuponsAtivos}</p>
          <p className="mt-1 text-xs text-muted-foreground">Cupons ativos</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <p className="mt-2 text-3xl font-extrabold leading-none">{resgatesHoje}</p>
          <p className="mt-1 text-xs text-muted-foreground">Resgates hoje</p>
        </div>
      </div>

      {/* Atalhos */}
      <div className="flex flex-col gap-3">
        <TotemActionCard
          href="/e/cupons"
          icon={<Ticket className="h-6 w-6" />}
          label="Meus cupons"
          description="Ativos, resgatados e em análise"
        />
        <TotemActionCard
          href="/e/cupom/novo"
          icon={<Plus className="h-6 w-6" />}
          label="Novo cupom"
          description="Criar uma oferta rápida"
        />
      </div>
    </div>
  );
}
