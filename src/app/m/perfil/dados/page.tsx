import { Pencil } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BotaoSair } from "@/components/botao-sair";
import { Field } from "@/components/field";
import { MobilePageHeader } from "@/components/mobile-page-header";

const campos = ["Nome completo", "E-mail", "CPF", "Telefone", "Endereço"];

export default function DadosPage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Dados de conta" back="/m/perfil" />

      <div className="flex flex-col gap-5 px-4 pb-8 pt-5">
        {/* Avatar + nome editável */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary/10 text-2xl text-primary">
                LO
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-primary text-white shadow-sm">
              <Pencil className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-base font-bold">Lucas S. Orlandi</p>
        </div>

        {/* Campos */}
        <div className="flex flex-col gap-4">
          {campos.map((label) => (
            <Field key={label} label={label} placeholder="Lorem Ipsum" />
          ))}
        </div>

        <BotaoSair redirect="/m/login" className="mt-2 w-full" size="lg">
          Sair da conta
        </BotaoSair>
      </div>
    </div>
  );
}
