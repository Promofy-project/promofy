/* eslint-disable @next/next/no-img-element */
// LP do estabelecimento — reconstrução do Figma/deck + passe de refino visual ("premium").
import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  Megaphone,
  SlidersHorizontal,
  BarChart3,
  Star,
  Play,
  ArrowRight,
  AtSign,
  Send,
  MessageCircle,
  Globe,
  Share2,
  DollarSign,
  CircleAlert,
  CircleCheck,
  RefreshCw,
  User,
  Gift,
  ShoppingBag,
  LayoutDashboard,
  CalendarClock,
  Store,
  Users,
  Receipt,
  Zap,
  Rocket,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaqAccordion, type FaqItem } from "@/components/landing/faq-accordion";
import { FluxoSolucao } from "@/components/landing/estabelecimento/fluxo-solucao";
import { SectionHeader } from "@/components/landing/section-header";
import {
  LP_CARD,
  LP_ICON,
  LP_STEP,
  LP_CARD_TITLE,
  LP_CARD_TEXT,
  LP_SECTION,
  LP_CONTAINER,
  LP_BTN_PRIMARY,
  LP_BTN_SECONDARY,
} from "@/components/landing/styles";

export const metadata: Metadata = {
  title: "Promofy para empresas — Atraia novos clientes e aumente suas vendas",
  description:
    "Seja parceiro Promofy: capte novos clientes, divulgue seu negócio e acompanhe resultados em tempo real.",
};

const IMG = "/lp/estabelecimentos";
const MARCA = "/lp/marca";

const BENEFICIOS: { icon: LucideIcon; titulo: string; desc: string }[] = [
  {
    icon: TrendingUp,
    titulo: "Alta captação",
    desc: "Aumente seu fluxo de novos clientes com ofertas atrativas",
  },
  {
    icon: Megaphone,
    titulo: "Divulgação gratuita",
    desc: "Exponha seu negócio para uma base de usuários em constante crescimento",
  },
  {
    icon: SlidersHorizontal,
    titulo: "Gestão simplificada",
    desc: "Controle e analise os resultados das suas promoções diretamente na plataforma",
  },
  {
    icon: BarChart3,
    titulo: "Relatórios detalhados",
    desc: "Acompanhe o desempenho dos cupons resgatados e a satisfação dos clientes por meio do NPS",
  },
];

const DEPOIMENTOS = [
  {
    nome: "Lanchonete Graciosa · Palmas-TO",
    avatar: `${IMG}/avatar-parceiro-1.png`,
    texto:
      "Depois de entrar na Promofy, meu movimento cresceu 40% durante os dias da semana.",
  },
  {
    nome: "Restaurante do Chef · Palmas-TO",
    avatar: `${IMG}/avatar-parceiro-2.png`,
    texto:
      "Com a Promofy consegui melhorar as vendas nos dias de baixa procura.",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Quanto custa para ser parceiro?",
    a: "Nada. Cadastrar seu negócio e publicar cupons na Promofy é 100% gratuito. Você só atrai quem realmente quer consumir — sem pagar por clique ou por impressão.",
  },
  {
    q: "Posso criar promoções diferentes?",
    a: "Sim, quantas quiser. Não há limite de cupons ativos: crie ofertas por categoria, sazonais, de boas-vindas ou para encher a casa em horários parados.",
  },
  {
    q: "Posso definir as condições das minhas promoções?",
    a: "Totalmente. Você define dias e horários de validade, formato (no local, retirada ou delivery), limite de usos por cliente e valor mínimo de consumo. A promoção trabalha a favor da sua margem.",
  },
];

const OQUEE_PASSOS = [
  {
    n: 1,
    titulo: "Consumidores baixam o app",
    texto:
      "As pessoas descobrem promoções da cidade e vão até você para aproveitá-las.",
  },
  {
    n: 2,
    titulo: "Você ganha um novo canal",
    texto: "Um canal de atração de clientes completamente gratuito.",
  },
  {
    n: 3,
    titulo: "Sem pagar nada",
    texto:
      "Você não paga nada para participar e já começa a atrair clientes reais.",
  },
];

const PROBLEMA_CARDS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: DollarSign,
    titulo: "Anúncio pago",
    texto:
      "Você paga por clique, por impressão — mesmo que ninguém apareça na sua loja.",
  },
  {
    icon: CircleAlert,
    titulo: "Sem garantia de retorno",
    texto: "O dinheiro sai do bolso antes de saber se vai ter resultado real.",
  },
  {
    icon: RefreshCw,
    titulo: "A Promofy inverte essa lógica",
    texto:
      "Você só atrai quem realmente quer consumir — sem pagar nada para isso.",
  },
];

const CRM_ITENS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: User,
    titulo: "Nome e Contato",
    texto: "Nome, telefone e e-mail de cada cliente que usa seu cupom.",
  },
  {
    icon: Gift,
    titulo: "Aniversário",
    texto:
      "Saiba quando seu cliente faz aniversário e crie promoções especiais.",
  },
  {
    icon: ShoppingBag,
    titulo: "Histórico de Compras",
    texto: "Veja quantas vezes cada cliente voltou e o que consumiu.",
  },
  {
    icon: LayoutDashboard,
    titulo: "CRM Completo",
    texto: "Tudo organizado automaticamente, sem trabalho extra.",
  },
];

const CONTROLE_CARDS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: CalendarClock,
    titulo: "Dias e Horários de Validade",
    texto: "Ex.: 20% só de terça a quinta, das 14h às 17h.",
  },
  {
    icon: Store,
    titulo: "Formato de Consumo",
    texto: "No local, retirada ou delivery.",
  },
  {
    icon: Users,
    titulo: "Limite de Usos por Cliente",
    texto: "Ex.: boas-vindas 1x por cliente.",
  },
  {
    icon: Receipt,
    titulo: "Valor ou Condição Mínima",
    texto: "Ex.: 15% em pedidos acima de R$ 50.",
  },
];

const EXCLUSIVIDADE_PASSOS = [
  {
    n: 1,
    titulo: "Promoção em todo lugar",
    texto: "Não gera dados, não cria vínculo.",
  },
  {
    n: 2,
    titulo: "Promoção exclusiva Promofy",
    texto: "Cada resgate gera dados reais e fortalece sua base.",
  },
  {
    n: 3,
    titulo: "Relacionamento que cresce",
    texto:
      "Com o tempo, você conhece seu cliente melhor que qualquer concorrente.",
  },
];

const RESULTADO_ETAPAS = [
  { titulo: "Primeiros dias", texto: "Poucos dados, mas já começa a plantar." },
  {
    titulo: "Primeiras semanas",
    texto: "Base crescendo, padrões começam a aparecer.",
  },
  {
    titulo: "Primeiros meses",
    texto: "Retrato real de quem é seu cliente.",
  },
  {
    titulo: "Com engajamento",
    texto: "Uma base rica, fiel e pronta para ser trabalhada.",
  },
];

const AGORA_CARDS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Star,
    titulo: "Destaque garantido",
    texto:
      "Os primeiros parceiros aparecem em evidência para os primeiros usuários.",
  },
  {
    icon: Zap,
    titulo: "Sem custo, sem trabalho",
    texto: "Cadastro rápido, gratuito e sem mensalidade para participar.",
  },
  {
    icon: Rocket,
    titulo: "Larga na frente",
    texto: "Comece antes da concorrência e construa sua base desde já.",
  },
];

const CTA_NUMEROS = [
  { valor: "5min", label: "Para cadastrar" },
  { valor: "R$0", label: "Custo para participar" },
  { valor: "1º", label: "Cupom hoje" },
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

export default function ParaEmpresasPage() {
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
              <span className="text-primary">Atraia novos clientes</span> e
              aumente suas vendas com a Promofy. Seja parceiro hoje mesmo!
            </h1>
            <Button size="lg" className={cn("mt-8", LP_BTN_PRIMARY)} asChild>
              <Link href="/cadastro">Cadastrar-se agora!</Link>
            </Button>
          </div>

          <div className="relative h-64 overflow-hidden sm:h-80 lg:h-[420px]">
            <img
              src={`${IMG}/hero-parceiro.png`}
              alt="Parceira usando o app Promofy no celular"
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
            subtitle="Mais clientes, mais dados e controle total das suas promoções — sem custo para participar."
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

      {/* ───────── 4. COMO USAR O APLICATIVO (enxuta) ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <div className={cn(LP_CARD, "sm:p-8")}>
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                <img
                  src={`${IMG}/como-usar-mulher.png`}
                  alt="Parceira usando o app Promofy no celular"
                  className="h-full w-full object-cover grayscale"
                />
              </div>

              <div className="pr-0 lg:pr-8">
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  Como usar o aplicativo?
                </h2>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  1° Passo
                </p>
                <p className="mt-2 text-xl font-bold text-cta">
                  Cadastro fácil e gratuito
                </p>
                <p className={cn("mt-3 max-w-xl", LP_CARD_TEXT)}>
                  Crie a conta do seu negócio em minutos, 100% grátis. Sem custo
                  de entrada e sem mensalidade para participar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── 5. VENHA CONHECER MAIS ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, "pb-16 sm:pb-24")}>
          <SectionHeader
            title="Venha conhecer mais!"
            subtitle="Veja como a Promofy vira um canal de clientes e um CRM completo para o seu negócio — sem pagar nada por isso."
          />

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[2fr_1fr]">
            {/* Player */}
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted shadow-[0_10px_30px_-12px_rgba(20,20,60,0.25)]">
              <img
                src={`${IMG}/restaurante-interior.png`}
                alt="Interior de restaurante parceiro"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-primary shadow-lg">
                <Play className="h-6 w-6 translate-x-0.5 fill-primary" />
              </span>
              <div className="absolute inset-x-5 bottom-5">
                <div className="relative h-1.5 w-full rounded-full bg-white/40">
                  <div className="h-full w-2/5 rounded-full bg-primary" />
                  <span className="absolute left-[40%] top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow" />
                </div>
              </div>
            </div>

            {/* Thumbs */}
            <div className="flex flex-col gap-5 sm:gap-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-[16/9] overflow-hidden rounded-2xl bg-muted"
                >
                  <img
                    src={`${IMG}/restaurante-interior.png`}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="#"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-cta hover:underline"
            >
              Veja mais <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── O QUE É ───────── */}
      <section className="bg-yellow-soft">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge className="text-xs font-semibold uppercase tracking-[0.12em]">
              O que é
            </Badge>
            <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-4xl">
              O que é a Promofy?
            </h2>
            <p className="mx-auto mt-5 max-w-xl rounded-2xl bg-primary px-6 py-3 text-[15px] font-bold text-primary-foreground shadow-[0_10px_30px_-12px_rgba(20,20,60,0.4)]">
              Uma plataforma que conecta pessoas a promoções locais
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
              A Promofy é uma plataforma digital que conecta consumidores a
              cupons de desconto de estabelecimentos locais como o seu.
            </p>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <ol className="flex flex-col gap-6">
              {OQUEE_PASSOS.map((p) => (
                <li key={p.n} className="flex gap-4">
                  <span className={LP_STEP}>{p.n}</span>
                  <div>
                    <h3 className={LP_CARD_TITLE}>{p.titulo}</h3>
                    <p className={cn("mt-1", LP_CARD_TEXT)}>{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <img
              src={`${MARCA}/mascote-orla-celular.png`}
              alt="Mascote arara da Promofy usando o celular na orla"
              className="mx-auto w-full max-w-sm rounded-2xl object-cover shadow-[0_20px_40px_-16px_rgba(20,20,60,0.35)]"
            />
          </div>
        </div>
      </section>

      {/* ───────── O PROBLEMA ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            eyebrow="O problema"
            title="Atrair cliente novo custa caro"
            subtitle="Hoje, para atrair clientes, o comerciante paga anúncio — e paga mesmo quando ninguém aparece. Você gasta antes de saber se vai ter retorno."
          />

          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,280px)_1fr]">
            <img
              src={`${MARCA}/mascote-pensativo.png`}
              alt="Mascote arara pensativo"
              className="mx-auto w-full max-w-[240px]"
            />
            <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
              {PROBLEMA_CARDS.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.titulo} className={cn(LP_CARD, "flex flex-col")}>
                    <span className={LP_ICON}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className={cn(LP_CARD_TITLE, "mt-4")}>{c.titulo}</h3>
                    <p className={cn(LP_CARD_TEXT, "mt-1")}>{c.texto}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mx-auto mt-10 flex max-w-3xl items-start gap-3 rounded-2xl border border-yellow/60 bg-yellow-soft px-5 py-4">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-cta" />
            <p className="text-[15px] font-medium text-foreground">
              Você investe dinheiro em publicidade sem garantia de resultado. O
              risco é todo seu.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── A SOLUÇÃO ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION, "text-center")}>
          <SectionHeader eyebrow="A solução" title="Como a Promofy resolve isso" />
          <FluxoSolucao />
          <p className="mx-auto mt-10 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
            Participar da Promofy não tem custo para você. Seu cupom fica
            disponível para todos os usuários do app na sua cidade — e cada
            cliente que aparece já chegou com a intenção de consumir.
          </p>
          <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-success-soft px-5 py-2.5 text-[15px] font-bold text-success">
            <CircleCheck className="h-4 w-4" /> Participar da Promofy não tem
            custo para você. Zero. Nenhum.
          </p>
        </div>
      </section>

      {/* ───────── CRM GRATUITO ───────── */}
      <section className="bg-yellow-soft">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            eyebrow="CRM gratuito"
            title="Você passa a conhecer quem é seu cliente"
            subtitle="A cada cupom resgatado, você recebe automaticamente os dados do cliente. É um CRM completo, sem custo, que a maioria dos pequenos negócios nunca teve."
            tone="onYellow"
          />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="grid gap-6 sm:grid-cols-2">
              {CRM_ITENS.map((it) => {
                const Icon = it.icon;
                return (
                  <div key={it.titulo} className="flex gap-4">
                    <span className={LP_ICON}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {it.titulo}
                      </h3>
                      <p className={cn("mt-1", LP_CARD_TEXT)}>{it.texto}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <img
              src={`${MARCA}/mascote-lanchonete.png`}
              alt="Cena da Lanchonete Graciosa com o mascote da Promofy"
              className="mx-auto w-full max-w-sm rounded-2xl object-cover shadow-[0_20px_40px_-16px_rgba(20,20,60,0.35)]"
            />
          </div>
        </div>
      </section>

      {/* ───────── VOCÊ NO CONTROLE ───────── */}
      <section className="bg-yellow-soft">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            title="Você no controle das suas promoções"
            subtitle="Cada cupom é configurado do seu jeito, para proteger sua margem e atrair clientes nos momentos certos."
            tone="onYellow"
          />
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {CONTROLE_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.titulo} className={cn(LP_CARD, "flex flex-col")}>
                  <span className={LP_ICON}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className={cn(LP_CARD_TITLE, "mt-4")}>{c.titulo}</h3>
                  <p className={cn(LP_CARD_TEXT, "mt-1")}>{c.texto}</p>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-base font-medium text-foreground sm:text-lg">
            Com a Promofy, a promoção é sua aliada: você atrai clientes sem abrir
            mão do controle do seu negócio.
          </p>
        </div>
      </section>

      {/* ───────── EXCLUSIVIDADE ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            eyebrow="Exclusividade"
            title="Promoções exclusivas constroem sua base"
            subtitle="Quando sua promoção é exclusiva da Promofy, o cliente precisa usar o app para aproveitá-la — e cada uso enriquece a sua base de dados."
          />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <img
              src={`${MARCA}/mascote-sacolas.png`}
              alt="Mascote arara com sacolas de compras"
              className="mx-auto w-full max-w-sm rounded-2xl object-cover shadow-[0_20px_40px_-16px_rgba(20,20,60,0.35)]"
            />
            <ol className="flex flex-col gap-6">
              {EXCLUSIVIDADE_PASSOS.map((p) => (
                <li key={p.n} className="flex gap-4">
                  <span className={LP_STEP}>{p.n}</span>
                  <div>
                    <h3 className={LP_CARD_TITLE}>{p.titulo}</h3>
                    <p className={cn("mt-1", LP_CARD_TEXT)}>{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───────── RESULTADO NO TEMPO ───────── */}
      <section className="bg-yellow-soft">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            eyebrow="Resultado no tempo"
            title="Seu CRM cresce a cada dia"
            subtitle="Os dados são cumulativos. No começo são poucos, mas a cada cliente que usa um cupom, sua base cresce e fica mais rica."
            tone="onYellow"
          />
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,340px)]">
            <ol className="flex flex-col gap-6">
              {RESULTADO_ETAPAS.map((e, i) => (
                <li key={e.titulo} className="flex gap-4">
                  <span className={LP_STEP}>{i + 1}</span>
                  <div>
                    <h3 className={LP_CARD_TITLE}>{e.titulo}</h3>
                    <p className={cn("mt-1", LP_CARD_TEXT)}>{e.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={LP_CARD}>
              <img
                src={`${MARCA}/mascote-crescimento.png`}
                alt="Métricas do CRM: visualizações, resgates, conversão e NPS"
                className="mx-auto w-full max-w-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── POR QUE ENTRAR AGORA ───────── */}
      <section className="bg-surface">
        <div className={cn(LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            eyebrow="Por que entrar agora"
            title="Entre como um dos primeiros"
            subtitle="A Promofy está começando em Palmas, e os primeiros parceiros aparecem com destaque para os primeiros usuários, sem concorrência."
          />
          <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
            {AGORA_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.titulo}
                  className={cn(LP_CARD, "flex flex-col items-center text-center")}
                >
                  <span className={LP_ICON}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className={cn(LP_CARD_TITLE, "mt-4")}>{c.titulo}</h3>
                  <p className={cn(LP_CARD_TEXT, "mt-2")}>{c.texto}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────── CTA FINAL (destaque em amarelo cheio) ───────── */}
      <section className="bg-yellow">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:py-24 lg:grid-cols-2">
          <img
            src={`${MARCA}/mascote-megafone.png`}
            alt="Mascote arara com megafone anunciando a Promofy"
            className="mx-auto w-full max-w-sm rounded-2xl object-cover shadow-[0_20px_40px_-16px_rgba(20,20,60,0.4)]"
          />
          <div>
            <h2 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-4xl">
              Vamos colocar seu primeiro cupom no ar?
            </h2>
            <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
              {CTA_NUMEROS.map((num) => (
                <div
                  key={num.label}
                  className="rounded-2xl border border-border/60 bg-surface px-3 py-5 text-center shadow-[0_1px_2px_rgba(20,20,60,0.04),0_10px_30px_-12px_rgba(20,20,60,0.15)]"
                >
                  <p className="text-2xl font-extrabold text-primary">
                    {num.valor}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {num.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-lg font-extrabold text-primary">
              Promofy — Promoção na palma da mão!
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" className={LP_BTN_PRIMARY} asChild>
                <Link href="/cadastro">
                  Cadastre seu negócio agora <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={cn(LP_BTN_SECONDARY, "bg-surface")}
                asChild
              >
                <Link href="#">Fale com a Promofy</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── DEPOIMENTOS DE PARCEIROS (destaque em amarelo cheio) ───────── */}
      <section className="relative overflow-hidden bg-yellow">
        <img
          src={`${IMG}/wave-amarela.png`}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-6 select-none whitespace-nowrap text-center text-4xl font-extrabold uppercase tracking-tight text-white/30 sm:text-5xl lg:text-6xl"
        >
          Depoimentos de Parceiros Depoimentos de Parceiros
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-28 sm:pb-24 sm:pt-32">
          <div className="grid gap-6 md:grid-cols-2">
            {DEPOIMENTOS.map((d, i) => (
              <figure
                key={i}
                className="relative mt-8 rounded-2xl border border-border/60 bg-surface px-6 pb-6 pt-12 text-center shadow-[0_1px_2px_rgba(20,20,60,0.04),0_10px_30px_-12px_rgba(20,20,60,0.15)]"
              >
                <span className="absolute -top-8 left-1/2 h-16 w-16 -translate-x-1/2 overflow-hidden rounded-full border-4 border-surface bg-muted shadow-sm">
                  <img
                    src={d.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
                <figcaption className="text-lg font-bold text-foreground">
                  {d.nome}
                </figcaption>
                <div className="mt-2 flex justify-center gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <blockquote className={cn("mt-4", LP_CARD_TEXT)}>
                  {d.texto}
                </blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="relative overflow-hidden bg-surface">
        <img
          src={`${IMG}/marca-dagua-passaro.png`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-10 top-10 hidden w-72 opacity-[0.06] lg:block"
        />
        <div className={cn("relative", LP_CONTAINER, LP_SECTION)}>
          <SectionHeader
            title="Perguntas Frequentes (FAQ)"
            subtitle="Tire suas dúvidas sobre como ser parceiro da Promofy."
          />
          <FaqAccordion items={FAQ} />
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
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
