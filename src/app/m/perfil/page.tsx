import Link from "next/link";
import {
  Pencil,
  Bell,
  Wallet,
  CreditCard,
  User,
  Gift,
  SlidersHorizontal,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PointsCard } from "@/components/points-card";

const atalhos: {
  href: string;
  icon: LucideIcon;
  titulo: string;
  sub: string;
}[] = [
  { href: "/m/perfil/notificacoes", icon: Bell, titulo: "Notificações", sub: "2 não lidas" },
  { href: "/m/perfil/pagamento", icon: Wallet, titulo: "Pagamentos", sub: "Saldo, cartões e mais" },
];

const opcoes: {
  href: string;
  icon: LucideIcon;
  titulo: string;
  sub: string;
}[] = [
  { href: "/m/planos", icon: CreditCard, titulo: "Planos", sub: "Meus planos" },
  { href: "/m/perfil/dados", icon: User, titulo: "Meus dados", sub: "Minhas informações da conta" },
  { href: "/m/perfil/convide", icon: Gift, titulo: "Convide seus amigos", sub: "Ganhe com indicações" },
  { href: "/m/perfil/preferencias", icon: SlidersHorizontal, titulo: "Preferências de cupons", sub: "Configure suas preferências" },
];

export default function PerfilPage() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-5">
      <h1 className="text-xl font-extrabold">Perfil</h1>

      {/* Cabeçalho do usuário */}
      <div className="flex items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-xl text-primary">
            LO
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">Lucas S. Orlandi</p>
          <p className="truncate text-xs text-muted-foreground">
            Membro Promofy
          </p>
        </div>
        <Link
          href="/m/perfil/dados"
          aria-label="Editar perfil"
          className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-muted"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      </div>

      {/* Pontos / gamificação */}
      <PointsCard />

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        {atalhos.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-sm font-bold leading-tight">{a.titulo}</span>
              <span className="text-xs text-muted-foreground">{a.sub}</span>
            </Link>
          );
        })}
      </div>

      {/* Lista de opções */}
      <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        {opcoes.map((o, i) => {
          const Icon = o.icon;
          return (
            <Link
              key={o.href}
              href={o.href}
              className={cnRow(i, opcoes.length)}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">
                  {o.titulo}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {o.sub}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function cnRow(i: number, total: number) {
  return [
    "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted",
    i !== total - 1 ? "border-b border-border" : "",
  ].join(" ");
}
