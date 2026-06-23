"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/m", label: "Início", icon: Home },
  { href: "/m/buscar", label: "Buscar", icon: Search },
  { href: "/m/favoritos", label: "Favoritos", icon: Heart },
  { href: "/m/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-t border-border bg-surface shadow-nav">
      <ul className="flex items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map((item) => {
          const active =
            item.href === "/m"
              ? pathname === "/m"
              : pathname.startsWith(item.href);
          const ItemIcon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ItemIcon
                  className={cn("h-5 w-5", active && "fill-primary/10")}
                  strokeWidth={active ? 2.4 : 2}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
