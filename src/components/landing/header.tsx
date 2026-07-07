import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export interface LandingNavLink {
  href: string;
  label: string;
}

// Menu compartilhado das landings — os dois públicos como caminhos dedicados.
const DEFAULT_NAV: LandingNavLink[] = [
  { href: "/para-voce", label: "Para você" },
  { href: "/para-empresas", label: "Para empresas" },
];

export function LandingHeader({
  nav = DEFAULT_NAV,
}: {
  nav?: LandingNavLink[];
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" aria-label="Promofy — página inicial">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {nav.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portal">Entrar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/m">Baixar o app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
