"use client";

import Link from "next/link";
import {
  User,
  Ticket,
  Trophy,
  Gift,
  HelpCircle,
  CreditCard,
  MessageCircleQuestion,
  Headphones,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMobileFlow } from "@/components/mobile-flow-provider";

interface MenuItem {
  label: string;
  icon: LucideIcon;
  href?: string;
}

const items: MenuItem[] = [
  { label: "Perfil", icon: User, href: "/m/perfil" },
  { label: "Cupons", icon: Ticket },
  { label: "Rankings", icon: Trophy },
  { label: "Indique e ganhe", icon: Gift },
  { label: "Como funciona?", icon: HelpCircle },
  { label: "Planos", icon: CreditCard, href: "/m/planos" },
  { label: "Perguntas frequentes", icon: MessageCircleQuestion },
  { label: "Fale conosco", icon: Headphones },
  { label: "Termos de privacidade", icon: ShieldCheck },
];

export function SideMenu() {
  const { menuOpen, closeMenu } = useMobileFlow();

  return (
    <div
      className={cn(
        "absolute inset-0 z-40",
        menuOpen ? "" : "pointer-events-none",
      )}
      aria-hidden={!menuOpen}
    >
      {/* backdrop */}
      <div
        onClick={closeMenu}
        className={cn(
          "absolute inset-0 bg-foreground/45 transition-opacity duration-300",
          menuOpen ? "opacity-100" : "opacity-0",
        )}
      />

      {/* drawer */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col bg-surface shadow-2xl transition-transform duration-300 ease-out",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* header */}
        <div className="flex items-center gap-3 bg-primary px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
          <Avatar className="h-12 w-12 ring-2 ring-white/40">
            <AvatarFallback className="bg-white/20 text-white">LO</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-bold">Lucas Orladi</p>
            <p className="truncate text-[11px] uppercase tracking-wide text-white/70">
              Lorem ipsum exemplo
            </p>
          </div>
        </div>

        {/* items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </>
            );
            const cls =
              "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted";

            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className={cls}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={closeMenu}
                className={cls}
              >
                {content}
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
