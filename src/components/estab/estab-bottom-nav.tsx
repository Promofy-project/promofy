"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Home, Ticket, User, Megaphone, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { contarAvisosNaoLidosAction } from "@/lib/actions/avisos";

// Bottom nav enxuta do app do estabelecimento. "Validar" é a ação dominante
// da home (não uma aba). /e/validar e /e/cupom/novo são telas cheias.
const items: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/e", label: "Início", icon: Home },
  { href: "/e/cupons", label: "Cupons", icon: Ticket },
  { href: "/e/mural", label: "Mural", icon: Megaphone },
  { href: "/e/perfil", label: "Perfil", icon: User },
];

export function EstabBottomNav() {
  const pathname = usePathname();
  const [naoLidos, setNaoLidos] = React.useState(0);

  /**
   * O badge é recontado a cada navegação (Fase 8/M1).
   *
   * Não dá para calcular no server component do layout: layout NÃO
   * re-renderiza ao navegar, e o número ficaria congelado a sessão inteira —
   * é a lição que a Fase 4 já pagou (ver o comentário em src/app/m/page.tsx,
   * onde o badge de novidades vive na PAGE por esse motivo). No /e a nav mora
   * no layout, então a recontagem tem de ser client, disparada pelo pathname.
   *
   * Sem realtime nesta fase: atualiza em navegação e refresh, e é só.
   */
  React.useEffect(() => {
    let vivo = true;
    contarAvisosNaoLidosAction()
      .then((n) => { if (vivo) setNaoLidos(n); })
      .catch(() => { /* badge é apoio; falha não derruba a nav */ });
    return () => { vivo = false; };
  }, [pathname]);

  return (
    <nav className="shrink-0 border-t border-border bg-surface shadow-nav">
      <ul className="flex items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map((item) => {
          const active =
            item.href === "/e"
              ? pathname === "/e"
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
                <span className="relative">
                  <ItemIcon
                    className={cn("h-5 w-5", active && "fill-primary/10")}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {/* Mesmo desenho do sino de novidades do /m (home-header). */}
                  {item.href === "/e/mural" && naoLidos > 0 && (
                    <span
                      aria-label={`${naoLidos} recado(s) não lido(s)`}
                      className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
                    >
                      {naoLidos > 9 ? "9+" : naoLidos}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
