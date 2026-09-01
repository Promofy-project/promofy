"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCouponState } from "@/components/coupon-state-provider";

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function PerfilIdentidade() {
  const { usuario, logado } = useCouponState();
  const nome = usuario?.nome?.trim();

  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card">
      <Avatar className="h-16 w-16">
        <AvatarFallback className="bg-primary/10 text-xl text-primary">
          {nome ? iniciaisDe(nome) : "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">
          {nome || (logado ? "Conta Promofy" : "Visitante")}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {logado ? "Membro Promofy" : "Entre para ver sua conta"}
        </p>
      </div>
      <Link
        href="/m/perfil/dados"
        aria-label="Dados da conta"
        className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-muted"
      >
        <Pencil className="h-4 w-4" />
      </Link>
    </div>
  );
}
