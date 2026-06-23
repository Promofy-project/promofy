import { User } from "lucide-react";

import { formatBRL } from "@/lib/utils";
import { usuarios } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function PerfilPage() {
  const eu = usuarios[0];
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-extrabold">Perfil</h1>

      <div className="flex items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary/10 text-lg text-primary">
            MA
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-base font-bold">{eu.nome}</p>
          <p className="text-xs text-muted-foreground">{eu.cidade}</p>
          <Badge variant="yellow-soft" className="mt-1.5">
            Nível {eu.nivel}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <p className="text-2xl font-extrabold text-primary">
            {formatBRL(eu.economiaTotal)}
          </p>
          <p className="text-xs text-muted-foreground">economizados</p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-card">
          <p className="text-2xl font-extrabold text-primary">
            {eu.cuponsUsados}
          </p>
          <p className="text-xs text-muted-foreground">cupons usados</p>
        </div>
      </div>

      <PagePlaceholder
        icon={<User className="h-6 w-6" />}
        title="Conta e preferências"
        description="Configurações, histórico e assinatura serão detalhados em breve."
      />
    </div>
  );
}
