import { Logo } from "@/components/logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p>© 2026 Promofy. Protótipo — dados meramente ilustrativos.</p>
      </div>
    </footer>
  );
}
