import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Smartphone,
  Store,
  ShieldCheck,
  Search,
  BadgePercent,
  Sparkles,
} from "lucide-react";

import {
  cupons,
  cuponsEmDestaque,
  planos,
  avaliacoes,
  landingStats,
} from "@/lib/mock-data";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CouponCard } from "@/components/coupon-card";
import { PlanCard } from "@/components/plan-card";
import { ReviewCard } from "@/components/review-card";

const passos = [
  {
    icon: Search,
    titulo: "Encontre",
    texto: "Descubra ofertas de estabelecimentos perto de você, por categoria.",
  },
  {
    icon: BadgePercent,
    titulo: "Resgate",
    texto: "Toque em “Usar agora” e mostre o cupom direto no caixa.",
  },
  {
    icon: Sparkles,
    titulo: "Economize",
    texto: "Acompanhe quanto você já economizou e suba no ranking.",
  },
];

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
      {/* ───────── Top nav ───────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#ofertas" className="hover:text-foreground">Ofertas</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
            <a href="#empresas" className="hover:text-foreground">Para empresas</a>
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

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-surface">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-60" />
        <div className="container relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="yellow-soft" className="mb-5">
              <Sparkles className="h-3.5 w-3.5" /> +186 estabelecimentos parceiros
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Economize de verdade nos lugares que você{" "}
              <span className="text-primary">já ama</span>.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              A Promofy reúne cupons e promoções de comércios locais num só app.
              Encontre, resgate e veja quanto economizou.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/m">
                  Explorar ofertas <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/portal">Sou estabelecimento</Link>
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> Ofertas perto de você, em tempo real.
            </p>
          </div>

          {/* Floating coupon preview */}
          <div className="relative mx-auto hidden w-full max-w-md lg:block">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl"
            />
            <div className="relative space-y-4">
              <div className="rotate-[-3deg]">
                {cuponsEmDestaque[0] && (
                  <CouponCard cupom={cuponsEmDestaque[0]} />
                )}
              </div>
              <div className="ml-12 rotate-[3deg]">
                {cuponsEmDestaque[2] && (
                  <CouponCard cupom={cuponsEmDestaque[2]} />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Stats ───────── */}
      <section className="border-y border-border bg-surface">
        <div className="container grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
          {landingStats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-extrabold text-primary lg:text-3xl">
                {s.valor}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Featured coupons ───────── */}
      <section id="ofertas" className="container py-16 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Ofertas em destaque
            </h2>
            <p className="mt-1 text-muted-foreground">
              Selecionadas para você economizar hoje.
            </p>
          </div>
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href="/m">
              Ver tudo <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cupons.slice(0, 8).map((c) => (
            <CouponCard key={c.id} cupom={c} />
          ))}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="bg-surface">
        <div className="container py-16 lg:py-20">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">
            Como funciona
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {passos.map((p, i) => {
              const StepIcon = p.icon;
              return (
                <div key={p.titulo} className="relative">
                  <span className="text-sm font-extrabold text-yellow">
                    0{i + 1}
                  </span>
                  <div className="mt-2 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <StepIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{p.titulo}</h3>
                  <p className="mt-1 text-muted-foreground">{p.texto}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────── Plans ───────── */}
      <section id="planos" className="container py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Escolha seu plano
          </h2>
          <p className="mt-2 text-muted-foreground">
            Comece simples e faça upgrade quando quiser. Cancele a qualquer momento.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planos.map((p) => (
            <PlanCard key={p.id} plano={p} />
          ))}
        </div>
      </section>

      {/* ───────── Prototype fronts ───────── */}
      <section id="empresas" className="bg-surface">
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

      {/* ───────── Reviews ───────── */}
      <section className="container py-16 lg:py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Quem usa, recomenda
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {avaliacoes.slice(0, 3).map((a) => (
            <ReviewCard key={a.id} avaliacao={a} />
          ))}
        </div>
      </section>

      {/* ───────── CTA band ───────── */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-card bg-primary px-8 py-14 text-center text-white">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Pronto para economizar?
            </h2>
            <p className="mt-2 text-white/80">
              Baixe o Promofy e comece a resgatar ofertas perto de você hoje mesmo.
            </p>
            <Button size="lg" variant="secondary" className="mt-6" asChild>
              <Link href="/m">
                Começar agora <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-border bg-surface">
        <div className="container flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p>© 2026 Promofy. Protótipo — dados meramente ilustrativos.</p>
        </div>
      </footer>
    </div>
  );
}
