import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  MapPin,
  Phone,
  MessageCircle,
} from "lucide-react";

import { getCupom, getCategoria, avaliacoes } from "@/lib/mock-data";
import { buscarCupomPorId } from "@/lib/data/cupons";
import { dentroDaJanela } from "@/lib/janela";
import { linhasDaJanela, resumoJanela, temRestricao } from "@/lib/janela-formato";
import { diaSemanaBrt } from "@/lib/dias";
import { cn, formatBRL } from "@/lib/utils";
import { CouponGallery } from "@/components/coupon-gallery";
import { FeedbackCarousel } from "@/components/feedback-carousel";
import { CupomAcaoUsar } from "@/components/cupom-acao-usar";
import { FavoriteButton } from "@/components/favorite-button";
import { RegistrarVisualizacao } from "@/components/registrar-visualizacao";

// O /m inteiro já é dinâmico (o layout lê cookies); o detalhe deixa de
// ser SSG do mock para poder cair no banco quando o id não está no mock
// (cupom aprovado ao vivo — Fase 4).
export const dynamic = "force-dynamic";

export default async function CupomDetalhe({
  params,
}: {
  params: { id: string };
}) {
  // BANCO PRIMEIRO (Fase 6/H3). Era o contrário, e por isso o mesmo cupom
  // exibia duas validades no mesmo fluxo: a home lia do banco ("até 20/08") e
  // esta tela lia do mock ("até 12/08", mock-data.ts:180). O mock fica só como
  // fallback dos ids que existem apenas no protótipo — nenhuma rota some.
  const doBanco = await buscarCupomPorId(params.id);
  const doMock = getCupom(params.id);
  const cupom = doBanco ?? doMock;
  if (!cupom) notFound();

  // A JANELA VEM SEMPRE DO BANCO, mesmo quando o conteúdo vem do mock:
  // o mock só tem `horarios` como texto ("Ter a Dom, 18h às 23h"), sem
  // dias/início/fim estruturados. Confiar nele mostraria o botão
  // habilitado num cupom que a RPC vai recusar — o "botão inerte" que
  // esta fase existe para matar. Calculado no servidor (fuso BRT).
  const foraDaJanela = doBanco ? !dentroDaJanela(doBanco.janela) : false;

  // Fase 6/H1: a tabela "Regras de Uso" descreve ESTE MESMO objeto `janela`.
  // Antes era uma constante literal ("Hoje, Quinta", "09:00 - 16:00") que
  // contradizia o botão logo acima. "hoje" resolvido no servidor (BRT).
  const janela = doBanco?.janela;
  const janelaRestringe = temRestricao(janela);
  const linhas = linhasDaJanela(janela, diaSemanaBrt());

  const categoria = getCategoria(cupom.categoria);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <RegistrarVisualizacao cupomId={cupom.id} />
      {/* Header azul */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-primary px-3 py-3 text-white">
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
        {/* Fase 4: coração real — favorita o estabelecimento do cupom */}
        <FavoriteButton estabelecimentoId={cupom.estabelecimentoId} />
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
            <CupomAcaoUsar
              cupom={cupom}
              size="sm"
              className="shrink-0"
              foraDaJanela={foraDaJanela}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Estou economizando {formatBRL(cupom.economia)}
          </p>
        </div>

        {/* Benefícios Exclusivos */}
        <section>
          <h3 className="mb-2 text-base font-bold">Benefícios Exclusivos</h3>
          <div className="rounded-card bg-yellow-soft p-4 text-sm leading-relaxed text-[#7a5e0a]">
            {/* Fase 6/H3: com o BANCO como fonte primária, benefício e regras
                podem vir vazios (cupom criado no /e sem benefício). Antes o
                mock sempre tinha os dois e a concatenação crua bastava; agora
                ela renderizaria um ". " solto. */}
            {[cupom.beneficio, cupom.regras[0]].filter(Boolean).join(". ") ||
              "Sem condições adicionais."}
          </div>
        </section>

        {/* Regras de Uso — a janela REAL do cupom, a mesma que o servidor
            aplica em ativar_cupom. Duas colunas e não três: o modelo tem UMA
            faixa de horário por cupom; "Manhã/Tarde" e "Noite" eram ficção. */}
        <section>
          <h3 className="mb-2 text-base font-bold">Regras de Uso</h3>
          {janelaRestringe ? (
            <div className="overflow-hidden rounded-card border-2 border-primary">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="bg-primary text-left text-xs font-semibold text-white">
                      <th className="whitespace-nowrap px-3 py-2">Dia</th>
                      <th className="whitespace-nowrap px-3 py-2">Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((row, i) => (
                      <tr
                        key={row.dia}
                        className={cn(
                          "border-t border-border",
                          row.hoje
                            ? "bg-primary/5 font-bold text-foreground"
                            : row.permitido
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60",
                          i % 2 === 1 && !row.hoje && "bg-muted/40",
                        )}
                      >
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {row.hoje ? `Hoje, ${row.dia}` : row.dia}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                          {row.faixa}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-card border-2 border-primary px-4 py-3 text-sm text-foreground">
              {resumoJanela(cupom.horarios)}
            </div>
          )}
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
        <CupomAcaoUsar cupom={cupom} size="lg" full foraDaJanela={foraDaJanela} />
      </div>
    </div>
  );
}
