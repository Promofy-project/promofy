"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Store,
  Star,
  // CreditCard, // usado apenas pelo item "Planos", ocultado temporariamente
  Settings,
  Users,
  DollarSign,
  Megaphone,
  Bell,
  Search,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type SidebarVariant = "portal" | "admin";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navConfig: Record<
  SidebarVariant,
  { items: NavItem[]; user: { nome: string; papel: string }; tag: string }
> = {
  portal: {
    tag: "Portal do estabelecimento",
    user: { nome: "Sabor & Cia", papel: "Estabelecimento" },
    items: [
      { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
      { href: "/portal/cupons", label: "Cupons", icon: Ticket },
      { href: "/portal/estabelecimento", label: "Estabelecimento", icon: Store },
      { href: "/portal/avaliacoes", label: "Avaliações", icon: Star },
      // Ocultado temporariamente: estabelecimento é gratuito por ora. A página /portal/planos permanece intacta.
      // { href: "/portal/planos", label: "Planos", icon: CreditCard },
      { href: "/portal/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
  admin: {
    tag: "Painel administrativo",
    user: { nome: "Equipe Promofy", papel: "Administrador" },
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/estabelecimentos", label: "Estabelecimentos", icon: Store },
      { href: "/admin/usuarios", label: "Usuários", icon: Users },
      { href: "/admin/cupons", label: "Cupons", icon: Ticket },
      { href: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
      { href: "/admin/avisos", label: "Avisos", icon: Megaphone },
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
};

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname.startsWith(href);
}

function NavList({
  variant,
  onNavigate,
}: {
  variant: SidebarVariant;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { items, tag } = navConfig[variant];
  const root = items[0].href;

  return (
    <nav className="flex flex-col gap-1">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {tag}
      </p>
      {items.map((item) => {
        const active = isActive(pathname, item.href, root);
        const ItemIcon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <ItemIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter({ variant }: { variant: SidebarVariant }) {
  const { user } = navConfig[variant];
  const initials = user.nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <div className="flex items-center gap-3 rounded-btn border border-border p-2.5">
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.nome}</p>
        <p className="truncate text-xs text-muted-foreground">{user.papel}</p>
      </div>
    </div>
  );
}

/** Sidebar reutilizável (portal/admin) — fixa no desktop + drawer no mobile. */
export function Sidebar({ variant }: { variant: SidebarVariant }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface p-4 lg:flex">
      <div className="px-2 py-2">
        <Logo />
      </div>
      <div className="mt-4 flex-1 overflow-y-auto">
        <NavList variant={variant} />
      </div>
      <UserFooter variant={variant} />
    </aside>
  );
}

/** Casca completa do dashboard: sidebar + top bar + área de conteúdo. */
export function DashboardShell({
  variant,
  children,
}: {
  variant: SidebarVariant;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar variant={variant} />

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-surface p-4">
            <div className="flex items-center justify-between px-2 py-2">
              <Logo />
              <button
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-btn hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">
              <NavList variant={variant} onNavigate={() => setOpen(false)} />
            </div>
            <UserFooter variant={variant} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-8">
          <button
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-btn hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar…" className="h-10 pl-9" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="relative grid h-10 w-10 place-items-center rounded-btn hover:bg-muted">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
            </button>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary">
                {variant === "portal" ? "SC" : "PR"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
