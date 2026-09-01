"use client";

import { BotaoSair } from "@/components/botao-sair";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useCouponState } from "@/components/coupon-state-provider";

export default function DadosPage() {
  const { usuario, logado } = useCouponState();
  const nome = usuario?.nome?.trim();
  const cpf = usuario?.cpfMascarado?.trim();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Dados de conta" back="/m/perfil" />

      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">Nome</span>
            <p className="rounded-xl bg-muted/70 px-3.5 py-3 text-sm">
              {nome || (logado ? "Não informado" : "Entre para ver seus dados")}
            </p>
          </div>
          {cpf ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-foreground">CPF</span>
              <p className="rounded-xl bg-muted/70 px-3.5 py-3 text-sm">{cpf}</p>
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          E-mail, telefone e endereço ainda não têm cadastro neste app. Não
          exibimos valores de exemplo no lugar.
        </p>

        <BotaoSair redirect="/m/login" className="mt-2 w-full" size="lg">
          Sair da conta
        </BotaoSair>
      </div>
    </div>
  );
}
