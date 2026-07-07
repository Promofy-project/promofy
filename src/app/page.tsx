import Link from "next/link";
import { ArrowRight, Smartphone, Store, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingFooter } from "@/components/landing/footer";
import { AcessoChooser } from "@/components/landing/acesso-chooser";
import {
  LandingStats,
  LandingAppSection,
  LandingOffers,
  LandingHowItWorks,
  LandingMerchantBlock,
  LandingPlans,
  LandingReviews,
  LandingCta,
} from "@/components/landing/sections";

const fronts = [
  {
    href: "/m",
    icon: Smartphone,
    titulo: "App do consumidor",
    texto: "Experiência mobile para descobrir e resgatar cupons.",
  },
  {
    href: "/portal",
    icon: Store,
    titulo: "Portal do estabelecimento",
    texto: "Gestão de cupons, resgates e desempenho do negócio.",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    titulo: "Painel administrativo",
    texto: "Visão geral da plataforma, parceiros e usuários.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Promofy — início">
            <Logo />
          </Link>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary/5"
            asChild
          >
            <Link href="/cadastro">Cadastrar-se</Link>
          </Button>
        </div>
      </header>

      <AcessoChooser />

      <LandingStats />
      <LandingAppSection />
      <LandingOffers id="ofertas" />
      <LandingHowItWorks />
      <LandingMerchantBlock id="empresas" />
      <LandingPlans id="planos" />

      {/* ───────── Prototype fronts (exclusivo da home) ───────── */}
      <section id="frentes" className="bg-background">
        <div className="container py-16 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="muted" className="mb-3">
              Protótipo de demonstração
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Explore as quatro frentes
            </h2>
            <p className="mt-2 text-muted-foreground">
              Navegue por cada experiência da plataforma.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {fronts.map((f) => {
              const FrontIcon = f.icon;
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  className="group flex flex-col rounded-card border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <FrontIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{f.titulo}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {f.texto}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Acessar{" "}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <LandingReviews />

      <LandingCta
        title="Pronto para economizar?"
        description="Baixe o Promofy e comece a resgatar ofertas perto de você hoje mesmo."
        actionLabel="Começar agora"
        actionHref="/m"
      />

      <LandingFooter />
    </div>
  );
}
