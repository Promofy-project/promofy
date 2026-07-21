"use client";

import * as React from "react";
import {
  Search,
  ChevronDown,
  Calendar,
  Wallet,
  Ticket,
  Store,
  type LucideIcon,
} from "lucide-react";

import type { AdminUsuario } from "@/lib/data/admin";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** DD/MM/AAAA determinístico (sem Date — evita divergência de fuso no SSR). */
function dataCompleta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso.slice(0, 10);
}

export function UsuariosAdminClient({ usuarios }: { usuarios: AdminUsuario[] }) {
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState<string | null>(null);

  const termo = busca.trim().toLowerCase();
  const filtrados = usuarios.filter(
    (u) => !termo || u.nome.toLowerCase().includes(termo),
  );

  return (
    <>
      <div className="relative sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome…"
          className="pl-9"
        />
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {filtrados.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </p>
        )}
        {filtrados.map((u) => {
          const open = aberto === u.id;
          return (
            <li key={u.id} className="rounded-card border border-border bg-card">
              <button
                type="button"
                onClick={() => setAberto(open ? null : u.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials(u.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.cidade ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-primary">
                    {formatNumber(u.pontos)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">pontos</p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
                  <Info
                    icon={Calendar}
                    label="Cadastro"
                    valor={dataCompleta(u.criadoEm)}
                  />
                  <Info
                    icon={Wallet}
                    label="Economia total"
                    valor={formatBRL(u.economiaTotal)}
                  />
                  <Info
                    icon={Ticket}
                    label={`Cupons usados (${u.cuponsUsados.length})`}
                    valor={
                      u.cuponsUsados.length
                        ? u.cuponsUsados.join(", ")
                        : "Nenhum ainda"
                    }
                    full
                  />
                  <Info
                    icon={Store}
                    label="Estabelecimentos frequentados"
                    valor={
                      u.estabelecimentos.length
                        ? u.estabelecimentos.join(", ")
                        : "Nenhum ainda"
                    }
                    full
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Info({
  icon: Icon,
  label,
  valor,
  full,
}: {
  icon: LucideIcon;
  label: string;
  valor: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 font-medium">{valor}</p>
    </div>
  );
}
