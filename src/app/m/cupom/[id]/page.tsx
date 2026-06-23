import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Phone,
  MessageCircle,
} from "lucide-react";

import { cupons, getCupom, getCategoria, avaliacoes } from "@/lib/mock-data";
import { cn, formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CouponGallery } from "@/components/coupon-gallery";
import { FeedbackCarousel } from "@/components/feedback-carousel";

export function generateStaticParams() {
  return cupons.map((c) => ({ id: c.id }));
}

const horariosTabela = [
  { dia: "Hoje, Quinta", manha: "09:00 - 16:00", noite: "09:00 - 16:00", hoje: true },
  { dia: "Sexta", manha: "09:00 - 16:00", noite: "09:00 - 16:00" },
  { dia: "Sábado", manha: "09:00 - 16:00", noite: "09:00 - 16:00" },
  { dia: "Domingo", manha: "09:00 - 16:00", noite: "09:00 - 16:00" },
  { dia: "Segunda", manha: "09:00 - 16:00", noite: "09:00 - 16:00" },
];

export default function CupomDetalhe({ params }: { params: { id: string } }) {
  const cupom = getCupom(params.id);
  if (!cupom) notFound();

  const categoria = getCategoria(cupom.categoria);

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Header azul */}
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-primary px-3 py-3 text-white">
        <Link
          href="/m"
          aria-label="Voltar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 truncate text-base font-bold">
          {cupom.estabelecimento}
        </h1>
        <button
          aria-label="Favoritar"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"
        >
          <Heart className="h-5 w-5" />
        </button>
        <button
          aria-label="Compartilhar"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </header>

      {/* Galeria */}
      <CouponGallery gradiente={categoria.gradiente} iconName={categoria.icon} />

      <div className="flex flex-col gap-6 px-4 pb-28">
        {/* Título + utilizar */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-extrabold leading-snug">
              {cupom.titulo}
            </h2>
            <Button size="sm" className="shrink-0">
              Utilizar
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Estou economizando {formatBRL(cupom.economia)}
          </p>
        </div>

        {/* Benefícios Exclusivos */}
        <section>
          <h3 className="mb-2 text-base font-bold">Benefícios Exclusivos</h3>
          <div className="rounded-card bg-yellow-soft p-4 text-sm leading-relaxed text-[#7a5e0a]">
            {cupom.beneficio}. {cupom.regras[0]}
          </div>
        </section>

        {/* Regras de Uso */}
        <section>
          <h3 className="mb-2 text-base font-bold">Regras de Uso</h3>
          <div className="overflow-hidden rounded-card border-2 border-primary">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] text-sm">
              <thead>
                <tr className="bg-primary text-left text-xs font-semibold text-white">
                  <th className="whitespace-nowrap px-3 py-2">Dia</th>
                  <th className="whitespace-nowrap px-3 py-2">Manhã/Tarde</th>
                  <th className="whitespace-nowrap px-3 py-2">Noite</th>
                </tr>
              </thead>
              <tbody>
                {horariosTabela.map((row, i) => (
                  <tr
                    key={row.dia}
                    className={cn(
                      "border-t border-border",
                      row.hoje
                        ? "bg-primary/5 font-bold text-foreground"
                        : "text-muted-foreground",
                      i % 2 === 1 && !row.hoje && "bg-muted/40",
                    )}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">{row.dia}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{row.manha}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{row.noite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        {/* Feedbacks */}
        <section>
          <h3 className="mb-3 text-base font-bold">Feedbacks</h3>
          <FeedbackCarousel items={avaliacoes.slice(0, 4)} />
        </section>

        {/* Localização e Contato */}
        <section>
          <h3 className="mb-2 text-base font-bold">Localização e Contato</h3>
          <div className="relative grid h-36 place-items-center overflow-hidden rounded-card border border-border bg-muted">
            <div className="bg-dots absolute inset-0 opacity-50" />
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-primary text-white shadow-md">
              <MapPin className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            Endereço lorem — {cupom.estabelecimento}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-foreground">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            11 989324802
          </p>
          <a
            href="https://wa.me/5511989324802"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-success hover:underline"
          >
            <MessageCircle className="h-4 w-4" />
            Entre em contato
          </a>
        </section>
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="w-full" size="lg">
          Usar cupom
        </Button>
      </div>
    </div>
  );
}
