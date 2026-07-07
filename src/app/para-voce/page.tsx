/* eslint-disable @next/next/no-img-element */
// LP do consumidor — reconstrução do Figma + passe de refino visual ("premium").
import type { Metadata } from "next";
import Link from "next/link";
import {
  PiggyBank,
  LayoutGrid,
  MapPin,
  MousePointerClick,
  CircleCheck,
  Lock,
  Star,
  AtSign,
  Send,
  MessageCircle,
  Globe,
  Share2,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FaqAccordion, type FaqItem } from "@/components/landing/faq-accordion";
import { ComoUsarCarrossel } from "@/components/landing/como-usar-carrossel";
import { SectionHeader } from "@/components/landing/section-header";
import {
  LP_CARD,
  LP_ICON,
  LP_CARD_TITLE,
  LP_CARD_TEXT,
  LP_SECTION,
  LP_CONTAINER,
  LP_BTN_PRIMARY,
  LP_BTN_SECONDARY,
} from "@/components/landing/styles";

export const metadata: Metadata = {
  title: "Promofy — Descubra um mundo de vantagens exclusivas",
  description:
    "Economize mais e aproveite melhor com a Promofy. Cupons e promoções de comércios locais num só app.",
};

const IMG = "/lp/consumidores";

const BENEFICIOS: { icon: LucideIcon; titulo: string; desc: string }[] = [
  {
    icon: PiggyBank,
    titulo: "Economia real",
    desc: "Resgate cupons para aproveitar ofertas exclusivas e economizar",
  },
  {
    icon: LayoutGrid,
    titulo: "Variedade de categorias",
    desc: "Ofertas em gastronomia, beleza, serviços, saúde e entretenimento",
  },
  {
    icon: MapPin,
    titulo: "Flexibilidade",
    desc: "Resgate benefícios na sua cidade ou em qualquer região disponível",
  },
  {
    icon: MousePointerClick,
    titulo: "Facilidade de Uso",
    desc: "Com poucos cliques, encontre ofertas perto de você e resgate seus benefícios",
  },
];

interface PlanoLP {
  nome: string;
  /** rótulo do preço (ex.: "GRATUITO", "R$ 9,90") — exibido em azul */
  preco?: string;
  /** subtítulo azul do VIP (substitui o preço) */
  subtitulo?: string;
  beneficios: string[];
  bloqueado?: boolean;
}

const PLANOS_LINHA1: PlanoLP[] = [
  {
    nome: "PLANO PROMO",
    preco: "GRATUITO",
    beneficios: [
      "Acesso a ofertas selecionadas da cidade",
      "Acesso limitado a 1 cupom gratuito por mês em qualquer categoria disponivel",
      "Participação no ranking de pontuação para premiações",
      "Visualização de todas as ofertas na plataforma (mas com resgate limitado a 1 cupom)",
    ],
  },
  {
    nome: "PLANO BASICO",
    preco: "R$ 9,90",
    beneficios: [
      "Acesso a todas as ofertas disponiveis na cidade",
      "Possibilidade de resgatar até 5 cupons por mês",
      "Participação no ranking de pontuação para premiações",
      "Notificações personalizadas de ofertas na sua região",
    ],
  },
  {
    nome: "PLANO PLUS",
    preco: "R$ 19,90",
    beneficios: [
      "Acesso a todas as ofertas disponiveis na cidade",
      "Cupons ilimitados por mês",
      "Participação no ranking de pontuação para premiações",
      "Notificações personalizadas de ofertas na sua região",
    ],
  },
];

const PLANOS_LINHA2: PlanoLP[] = [
  {
    nome: "PLANO FAMILIA",
    preco: "R$ 29,90",
    beneficios: [
      "Acesso a todas as ofertas para até 4 perfis cadastrados",
      "Cupons ilimitados por mês, compartilhados entre os membros",
      "Participação de todos os membros no ranking de pontuação para premiações",
      "Benefícios exclusivos como cupons bônus a cada 3 meses",
    ],
  },
  {
    nome: "PLANO VIP",
    subtitulo:
      "Plano exclusivo — liberado apenas para membros convidados ou por conquista. Saiba mais.",
    bloqueado: true,
    beneficios: [
      "Acesso a todas as ofertas disponiveis na cidade",
      "Cupons ilimitados e sem restrições geográficas (cidades da mesma rede Promofy).",
      "Participação no ranking de pontuação para premiações (com pontuação dobrada)",
      "Convites para eventos e promoções especiais com parceiros",
    ],
  },
];

const REVIEWS = [
  {
    nome: "Mariana A. · Palmas-TO",
    avatar: `${IMG}/avatar-review-1.png`,
    texto:
      "Economizei mais de R$ 200 no primeiro mês só usando cupom onde eu já ia. Virou hábito abrir a Promofy antes de sair.",
  },
  {
    nome: "Juliana R. · Palmas-TO",
    avatar: `${IMG}/avatar-review-2.png`,
    texto:
      "Achei academia, rodízio e salão com desconto perto de casa. O resgate é na hora, sem burocracia nenhuma.",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "O app é gratuito?",
    a: "Sim. Você baixa e usa a Promofy de graça no plano Promo, com cupons selecionados e 1 resgate por mês. Para ver todas as ofertas da cidade e resgatar mais, há planos a partir de R$ 9,90/mês.",
  },
  {
    q: "Preciso imprimir os cupons?",
    a: "Não. Tudo acontece no app: você ativa o cupom, recebe um código único (PRM-XXXXXX) e mostra na tela do celular no estabelecimento. Sem papel.",
  },
  {
    q: "Posso usar cupons em mais de uma cidade?",
    a: "Depende do plano. O Básico dá acesso à sua cidade; o Plus libera cidade + região. Onde a Promofy tiver parceiros, seus cupons valem.",
  },
  {
    q: "Como funciona o resgate de cupons?",
    a: "Ative o cupom no app, apresente o código (ou QR Code) no estabelecimento e o parceiro confirma a baixa na hora. O código vale 5 horas após a ativação — você recebe um aviso 1h antes de expirar.",
  },
  {
    q: "O que são os PromoPoints?",
    a: "É o programa de pontos da Promofy. Você ganha pontos a cada cupom usado, avaliação e indicação, sobe no ranking mensal e troca por recompensas como cupons especiais e desconto na assinatura.",
  },
  {
    q: "Quais estabelecimentos fazem parte da Promofy?",
    a: "A rede cresce toda semana: bares, restaurantes, beleza, academias, serviços e mais. O catálogo fica sempre atualizado no app — abra e veja quem está perto de você.",
  },
];

const SOCIAIS: LucideIcon[] = [AtSign, Send, MessageCircle, Globe, Share2];

const FOOTER_COLS: { titulo: string; links: string[] }[] = [
  {
    titulo: "Produto",
    links: ["Para você", "Para empresas", "Planos", "Como funciona"],
  },
  {
    titulo: "Empresa",
    links: ["Sobre a Promofy", "Seja parceiro", "Blog", "Trabalhe conosco"],
  },
  {
    titulo: "Legal",
    links: [
      "Termos de Uso",
      "Política de Privacidade",
      "Política de Cookies",
      "PromoPoints",
    ],
  },
  {
    titulo: "Contato",
    links: [
      "contato@promofy.com.br",
      "privacidade@promofy.com.br",
      "Palmas – TO",
    ],
  },
];

/* ───────────────────────── Subcomponentes ───────────────────────── */

function PlanoCard({ plano }: { plano: PlanoLP }) {
  return (
    <div className={cn(LP_CARD, "flex flex-col")}>
      <h3 className="text-center text-lg font-extrabold tracking-tight text-foreground">
        {plano.nome}
      </h3>

      {plano.subtitulo ? (
        <p className="mt-2 text-center text-xs font-semibold leading-relaxed text-primary">
          {plano.subtitulo}
        </p>
      ) : (
        <p className="mt-1 text-center text-lg font-extrabold text-primary">
          {plano.preco}
        </p>
      )}

      <div className="my-4 border-t border-border/70" />

      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
        Benefícios
      </p>

      <ul className="mt-4 flex flex-1 flex-col gap-3">
        {plano.beneficios.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px]">
            <CircleCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" />
            <span className="text-foreground/70">{b}</span>
          </li>
        ))}
      </ul>

      {plano.bloqueado ? (
        <button
          type="button"
          disabled
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-muted-foreground/70 text-[15px] font-semibold text-white"
        >
          <Lock className="h-4 w-4" /> Saiba como conquistar!
        </button>
      ) : (
        <Button className="mt-6 w-full rounded-xl text-[15px]" variant="secondary">
          Assinar plano
        </Button>
      )}
    </div>
  );
}

/* ───────────────────────── Página ───────────────────────── */

export default function ParaVocePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* ───────── 1. HEADER ───────── */}
      <header className="border-b border-border/60 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Promofy — início">
            <img
              src="/lp/marca/logo-promofy-azul.png"
              alt="Promofy"
              className="h-7 w-auto"
            />
          </Link>
          <Button size="lg" variant="outline" className={LP_BTN_SECONDARY} asChild>
            <Link href="/cadastro">Cadastrar-se</Link>
          </Button>
        </div>
      </header>

      {/* ───────── 2. HERO ───────── */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 sm:py-20 lg:grid-cols-2">
          <div className="max-w-xl">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="text-primary">Descubra</span> um mundo de
              vantagens exclusivas. Economize mais e aproveite melhor com a{" "}
              <span className="text-primary">Promofy</span>
            </h1>
            <Button size="lg" className={cn("mt-8", LP_BTN_PRIMARY)} asChild>
              <Link href="/m">Baixar agora!</Link>
            </Button>
          </div>

          <div className="relative h-64 overflow-hidden sm:h-80 lg:h-[420px]">
            <img
              src={`${IMG}/hero-araras.png`}
              alt="Casal de araras usando o celular com o app Promofy"
              className="absolute inset-0 h-full w-full rounded-2xl object-cover [mask-image:linear-gradient(100deg,transparent_0%,#000_34%)]"
            />
          </div>
        </div>
      </section>

      {/* ───────── 3. BENEFÍCIOS ───────── */}
      <section className="relative overflow-hidden bg-primary">
        <img
          src={`${IMG}/wave-azul.png`}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className={cn("relative", LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            tone="onPrimary"
            title="Benefícios"
            subtitle="Tudo o que você precisa para gastar menos no dia a dia, pertinho de você."
          />
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {BENEFICIOS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.titulo}
                  className={cn(LP_CARD, "flex flex-col items-center text-center")}
                >
                  <span className={LP_ICON}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className={cn(LP_CARD_TITLE, "mt-4")}>{b.titulo}</h3>
                  <p className={cn(LP_CARD_TEXT, "mt-2")}>{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────── 4. COMO USAR O APLICATIVO (carrossel de 4 passos) ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <ComoUsarCarrossel />
        </div>
      </section>

      {/* ───────── 5. PLANOS ───────── */}
      <section id="planos" className="bg-surface">
        <div className={cn(LP_CONTAINER, "pb-16 sm:pb-24")}>
          <SectionHeader
            title="Planos"
            subtitle="Comece de graça e faça upgrade quando quiser. Sem fidelidade escondida — planos anuais a partir de R$ 9,90/mês."
          />
          <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6 md:grid-cols-3">
            {PLANOS_LINHA1.map((p) => (
              <PlanoCard key={p.nome} plano={p} />
            ))}
          </div>
          <div className="mx-auto mt-5 grid max-w-3xl gap-5 sm:mt-6 sm:gap-6 sm:grid-cols-2">
            {PLANOS_LINHA2.map((p) => (
              <PlanoCard key={p.nome} plano={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── 6. FEEDBACKS (destaque em amarelo cheio) ───────── */}
      <section className="relative overflow-hidden bg-yellow">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-6 select-none whitespace-nowrap text-center text-6xl font-extrabold uppercase tracking-tight text-white/25 sm:text-7xl lg:text-8xl"
        >
          FEEDBACKS FEEDBACKS FEEDBACKS FEEDBACKS
        </div>
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-28 sm:pb-24 sm:pt-32">
          <div className="grid gap-6 md:grid-cols-2">
            {REVIEWS.map((r, i) => (
              <figure
                key={i}
                className="relative mt-8 rounded-2xl border border-border/60 bg-surface px-6 pb-6 pt-12 text-center shadow-[0_1px_2px_rgba(20,20,60,0.04),0_10px_30px_-12px_rgba(20,20,60,0.15)]"
              >
                <span className="absolute -top-8 left-1/2 h-16 w-16 -translate-x-1/2 overflow-hidden rounded-full border-4 border-surface bg-muted shadow-sm">
                  <img
                    src={r.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
                <figcaption className="text-lg font-bold text-foreground">
                  {r.nome}
                </figcaption>
                <div className="mt-2 flex justify-center gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className="h-4 w-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <blockquote className={cn("mt-4", LP_CARD_TEXT)}>
                  {r.texto}
                </blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── 7. FAQ ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            title="Perguntas Frequentes (FAQ)"
            subtitle="Tire suas dúvidas sobre como a Promofy funciona."
          />
          <FaqAccordion items={FAQ} />
        </div>
      </section>

      {/* ───────── 8. FOOTER ───────── */}
      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <img
                src="/lp/marca/logo-promofy-amarelo.png"
                alt="Promofy"
                className="h-8 w-auto"
              />
              <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">
                Promofy — Promoção na palma da mão! A plataforma que conecta
                você às melhores promoções dos comércios locais.
              </p>
              <div className="mt-5 flex gap-3">
                {SOCIAIS.map((Icon, i) => (
                  <span
                    key={i}
                    className="grid h-9 w-9 place-items-center rounded-full bg-yellow text-yellow-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {FOOTER_COLS.map((col) => (
                <div key={col.titulo}>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    {col.titulo}
                  </p>
                  <ul className="mt-3 flex flex-col gap-2 text-[15px] text-white/70">
                    {col.links.map((link) => (
                      <li key={link}>
                        <Link href="#" className="hover:text-white">
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/50">
            © 2026 Promofy · CANINDÉ VENTURES TECNOLOGIA LTDA · Palmas – TO
          </div>
        </div>
        <div className="h-1.5 w-full bg-yellow" />
      </footer>
    </div>
  );
}
