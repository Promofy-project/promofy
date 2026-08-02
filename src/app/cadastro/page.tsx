import type { Metadata } from "next";
import Link from "next/link";
import { User, Store, ArrowRight, MessageCircle, LogIn } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LandingFooter } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Cadastre-se — Promofy",
  description:
    "Crie sua conta na Promofy: consumidor, para economizar com cupons; ou empresa, para atrair clientes.",
};

/**
 * Tela de escolha do cadastro (backlog 12.2).
 *
 * A rota /cadastro NÃO EXISTIA e era alvo de <Link href="/cadastro"> em 5
 * pontos públicos (a home e as duas landings) — 404 no clique e, pior, um
 * erro de console em toda visita, porque o prefetch RSC do Next buscava
 * `/cadastro?_rsc=…` e levava 404 sem ninguém clicar em nada.
 *
 * Por que uma tela de ESCOLHA e não um formulário: o cadastro de consumidor
 * existe e funciona (/m/cadastro); o de EMPRESA não existe em lugar nenhum —
 * /portal/login e /e/login são só login, e o papel `lojista` só é atribuído
 * por service_role no seed-users. Inventar auto-cadastro de lojista aqui
 * seria abrir uma superfície de auth (quem vira lojista? quem modera o
 * estabelecimento?) num item de higiene. O desenho desse fluxo já existe em
 * docs/modelo/estabelecimento-mobile/Cadastro-1..5.png (razão social, CNPJ,
 * ramo, documento, responsável) e está registrado no backlog.
 *
 * Server component estático: nenhum estado, nenhuma sessão — dois links.
 */
export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Promofy — início">
            <Logo />
          </Link>
          <Button variant="ghost" asChild>
            <Link href="/m/login">Já tenho conta</Link>
          </Button>
        </div>
      </header>

      {/* Escolha — mesma linguagem do AcessoChooser da home */}
      <section className="bg-navy">
        <div className="mx-auto flex max-w-3xl justify-center px-4 py-16 sm:px-6 lg:py-24">
          <div className="w-full max-w-xl rounded-card bg-surface p-6 text-center shadow-2xl sm:p-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Como você quer se cadastrar?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              A plataforma que transforma ofertas exclusivas em experiências
              incríveis e economia de verdade!
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link
                href="/m/cadastro"
                className="flex flex-col items-center gap-3 rounded-card border-2 border-border bg-surface px-4 py-7 text-foreground transition-colors hover:border-primary hover:bg-primary/5"
              >
                <User className="h-9 w-9" strokeWidth={1.75} />
                <span className="text-sm font-bold">Sou consumidor</span>
                <span className="text-xs text-muted-foreground">
                  Quero economizar com os cupons
                </span>
              </Link>

              <Link
                href="#empresa"
                className="flex flex-col items-center gap-3 rounded-card border-2 border-border bg-surface px-4 py-7 text-foreground transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Store className="h-9 w-9" strokeWidth={1.75} />
                <span className="text-sm font-bold">Sou empresa</span>
                <span className="text-xs text-muted-foreground">
                  Quero atrair clientes para o meu negócio
                </span>
              </Link>
            </div>

            <Button size="lg" className="mt-6 w-full" asChild>
              <Link href="/m/cadastro">
                Criar minha conta de consumidor <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Empresa — honesto: o cadastro é feito com a equipe */}
      <section id="empresa" className="scroll-mt-4 bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className="rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold tracking-tight">
              Cadastro de empresa
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              O cadastro de estabelecimentos é feito junto com a nossa equipe:
              conferimos os dados do negócio e liberamos o acesso ao portal,
              onde você cria e acompanha seus cupons. Fale com a gente e
              começamos hoje mesmo.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a
                  href="https://wa.me/5511989324802"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com a Promofy
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/portal/login">
                  <LogIn className="h-4 w-4" />
                  Já sou parceiro — entrar no portal
                </Link>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              Quer conhecer antes?{" "}
              <Link
                href="/para-empresas"
                className="font-bold text-primary hover:underline"
              >
                Veja como a Promofy funciona para o seu negócio
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
