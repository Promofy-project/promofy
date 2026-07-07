import Link from "next/link";
import {
  ArrowRight,
  Smartphone,
  Store,
  Search,
  BadgePercent,
  Sparkles,
  Check,
  Ticket,
  LineChart,
  type LucideIcon,
} from "lucide-react";

import {
  cupons,
  planos,
  avaliacoes,
  landingStats,
  resgatesMensais,
} from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CouponCard } from "@/components/coupon-card";
import { PlanCard } from "@/components/plan-card";
import { ReviewCard } from "@/components/review-card";
import { AppMockup } from "@/components/app-mockup";
import { BarChart } from "@/components/bar-chart";

// ───────────────────────── Copy compartilhada (provisória) ─────────────────────────

const APP_BENEFICIOS = [
  "Ofertas perto de você, atualizadas em tempo real",
  "Resgate em 1 toque, direto no caixa",
  "Acompanhe sua economia e suba no ranking",
];

const MERCHANT_BENEFICIOS = [
  "Crie e gerencie seus cupons em minutos",
  "Acompanhe resgates, conversão e avaliações",
  "Apareça para clientes perto do seu negócio",
];

export interface HowStep {
  icon: LucideIcon;
  titulo: string;
  texto: string;
}

export const PASSOS_CONSUMIDOR: HowStep[] = [
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

export const PASSOS_LOJISTA: HowStep[] = [
  {
    icon: Store,
    titulo: "Cadastre seu negócio",
    texto:
      "Crie a conta do estabelecimento e configure o perfil em poucos minutos.",
  },
  {
    icon: Ticket,
    titulo: "Crie seus cupons",
    texto:
      "Monte ofertas com regras, limites e validade — e publique quando quiser.",
  },
  {
    icon: LineChart,
    titulo: "Acompanhe resultados",
    texto: "Veja resgates, conversão e avaliações em tempo real no portal.",
  },
];

// ───────────────────────── Stats ─────────────────────────

export function LandingStats() {
  return (
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
  );
}

// ───────────────────────── App no bolso ─────────────────────────

export function LandingAppSection() {
  return (
    <section className="bg-background">
      <div className="container grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-20">
        <div>
          <Badge variant="yellow-soft" className="mb-4">
            <Smartphone className="h-3.5 w-3.5" /> App mobile
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Leve a Promofy no bolso
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Descubra ofertas perto de você, resgate cupons em segundos e
            acompanhe quanto já economizou — tudo no seu celular.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {APP_BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow-soft">
                  <Check className="h-3.5 w-3.5 text-[#8a6d0b]" strokeWidth={3} />
                </span>
                <span className="text-foreground">{b}</span>
              </li>
            ))}
          </ul>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/m">
              <Smartphone className="h-4 w-4" /> Abrir o app
            </Link>
          </Button>
        </div>

        <div className="order-first lg:order-last">
          <AppMockup />
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Ofertas em destaque (vitrine) ─────────────────────────

export function LandingOffers({
  id,
  title = "Ofertas em destaque",
  subtitle = "Selecionadas para você economizar hoje.",
  count = 8,
  seeAllHref = "/m",
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  count?: number;
  seeAllHref?: string;
}) {
  return (
    <section id={id} className="bg-surface">
      <div className="container py-16 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>
            <p className="mt-1 text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href={seeAllHref}>
              Ver tudo <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cupons.slice(0, count).map((c) => (
            <CouponCard key={c.id} cupom={c} showcase />
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Como funciona ─────────────────────────

export function LandingHowItWorks({
  id,
  title = "Como funciona",
  steps = PASSOS_CONSUMIDOR,
}: {
  id?: string;
  title?: string;
  steps?: HowStep[];
}) {
  return (
    <section id={id} className="bg-background">
      <div className="container py-16 lg:py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          {title}
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((p, i) => {
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
  );
}

// ───────────────────────── Para estabelecimentos (bloco azul + dashboard) ─────────────────────────

export function LandingMerchantBlock({
  id,
  titleAs = "h2",
}: {
  id?: string;
  /** "h1" quando o bloco é o hero da página (ex.: /para-empresas); default "h2" na home */
  titleAs?: "h1" | "h2";
}) {
  const Heading = titleAs;
  return (
    <section id={id} className="bg-primary text-white">
      <div className="container grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-20">
        <div>
          <Badge className="mb-4 border-transparent bg-white/15 text-white">
            <Store className="h-3.5 w-3.5" /> Para estabelecimentos
          </Badge>
          <Heading className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Transforme promoções em clientes
          </Heading>
          <p className="mt-3 max-w-md text-white/80">
            Cadastre seu estabelecimento, crie promoções e acompanhe resultados
            em tempo real.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {MERCHANT_BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow text-yellow-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="text-white/90">{b}</span>
              </li>
            ))}
          </ul>
          <Button size="lg" variant="secondary" className="mt-8" asChild>
            <Link href="/portal">
              Acessar o portal <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* mini dashboard preview */}
        <div className="rounded-card border border-white/15 bg-white p-5 text-foreground shadow-2xl">
          <p className="text-sm font-bold">Desempenho do mês</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-2xl font-extrabold">482</p>
              <p className="text-xs text-muted-foreground">resgates</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-2xl font-extrabold">24,6%</p>
              <p className="text-xs text-muted-foreground">conversão</p>
            </div>
          </div>
          <div className="mt-4">
            <BarChart data={resgatesMensais} format={formatNumber} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Planos ─────────────────────────

export function LandingPlans({ id }: { id?: string }) {
  return (
    <section id={id} className="bg-surface">
      <div className="container py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            Escolha seu plano
          </h2>
          <p className="mt-2 text-muted-foreground">
            Comece simples e faça upgrade quando quiser. Cancele a qualquer
            momento.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planos.map((p) => (
            <PlanCard key={p.id} plano={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Avaliações ─────────────────────────

export function LandingReviews() {
  return (
    <section className="bg-surface">
      <div className="container py-16 lg:py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Quem usa, recomenda
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {avaliacoes.slice(0, 3).map((a) => (
            <ReviewCard key={a.id} avaliacao={a} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Faixa de CTA ─────────────────────────

export function LandingCta({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <section className="bg-background">
      <div className="container pb-20 pt-16">
        <div className="relative overflow-hidden rounded-card bg-primary px-8 py-14 text-center text-white">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight">{title}</h2>
            <p className="mt-2 text-white/80">{description}</p>
            <Button size="lg" variant="secondary" className="mt-6" asChild>
              <Link href={actionHref}>
                {actionLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
