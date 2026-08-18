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
import { janelaAlcancavel } from "@/lib/janela";
import { linhasDaJanela, temRestricao } from "@/lib/janela-formato";
import { diaSemanaBrt } from "@/lib/dias";
import {
  listarPtBr,
  regrasParaExibir,
  rotuloEconomia,
  rotulosFormasConsumo,
  rotulosTaxas,
} from "@/lib/cupom-campos";
import { cn, formatBRL } from "@/lib/utils";
import { CouponGallery } from "@/components/coupon-gallery";
import { FeedbackCarousel } from "@/components/feedback-carousel";
import { CupomAcaoUsar } from "@/components/cupom-acao-usar";
import { FavoriteButton } from "@/components/favorite-button";
import { RegistrarVisualizacao } from "@/components/registrar-visualizacao";
import { urlPublicaImagem } from "@/lib/imagem-cupom";

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
  //
  // Fase 9/QA: a pergunta é ALCANCE, não "agora". `dentroDaJanela` diria
  // "fora" às 17:48 num cupom que abre às 18:00, mas o prazo de 5h cobre a
  // janela inteira e `ativar_cupom` aceita (migration 30). Esmaecer aqui
  // seria justamente o botão inerte que a Fase 5 matou — só que ao contrário.
  const foraDaJanela = doBanco
    ? !janelaAlcancavel(doBanco.janela, doBanco.prazoAtivacaoHoras ?? 5)
    : false;

  // Fase 6/H1: a tabela "Regras de Uso" descreve ESTE MESMO objeto `janela`.
  // Antes era uma constante literal ("Hoje, Quinta", "09:00 - 16:00") que
  // contradizia o botão logo acima. "hoje" resolvido no servidor (BRT).
  const janela = doBanco?.janela;
  const janelaRestringe = temRestricao(janela);
  const linhas = linhasDaJanela(janela, diaSemanaBrt());

  // Fase 6.5/EXTRA: tira a regra que e copia do beneficio (cupons legados)
  const regrasVisiveis = regrasParaExibir(cupom.regras, cupom.beneficio);

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
      <CouponGallery
        gradiente={categoria.gradiente}
        iconName={categoria.icon}
        imagemUrl={urlPublicaImagem(
          cupom.imagem,
          cupom.estabelecimentoId,
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        )}
      />

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
            Estou economizando{" "}
            {rotuloEconomia(formatBRL(cupom.economia), cupom.economiaVariavel)}
          </p>
        </div>

        {/* Benefícios Exclusivos */}
        <section>
          <h3 className="mb-2 text-base font-bold">Benefícios Exclusivos</h3>
          {/* Fase 6.5/EXTRA: benefício e regras são SEÇÕES DISTINTAS. Antes
              os dois eram concatenados, e como a action copiava o benefício
              para `regras`, o mesmo texto aparecia duas vezes. `regrasParaExibir`
              tira a duplicata dos cupons legados — sem migration de dados. */}
          <div className="rounded-card bg-yellow-soft p-4 text-sm leading-relaxed text-[#7a5e0a]">
            {cupom.beneficio.trim() || "Sem condições adicionais."}
          </div>
          {regrasVisiveis.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {regrasVisiveis.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                  {r}
                </li>
              ))}
            </ul>
          )}
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
            /* Sem janela estruturada, o servidor NÃO restringe nada. Mostrar
               só a descrição livre do lojista ("Seg a Sáb, 10h às 22h")
               recriaria a contradição que esta fase mata — num domingo o
               texto diria "Seg a Sáb" com o botão ativo. Então a descrição
               fica como informação do estabelecimento e a regra que o app
               aplica é dita explicitamente. */
            <div className="rounded-card border-2 border-primary px-4 py-3 text-sm text-foreground">
              <p className="font-semibold">Sem restrição de horário no app</p>
              {cupom.horarios.trim() && (
                <p className="mt-1 text-muted-foreground">
                  Horário informado pelo estabelecimento: {cupom.horarios.trim()}.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Fase 6/C1: formas de consumo e taxas não cobertas. Ficam logo
            abaixo das Regras de Uso porque são a outra metade da mesma
            pergunta ("como e com que custo eu uso isto?"). Campo vazio
            não vira linha — não informado é diferente de "todas". */}
        {((cupom.formasConsumo?.length ?? 0) > 0 ||
          (cupom.taxas?.length ?? 0) > 0) && (
          <section className="flex flex-col gap-3">
            {(cupom.formasConsumo?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-1.5 text-base font-bold">Formas de consumo</h3>
                <div className="flex flex-wrap gap-2">
                  {rotulosFormasConsumo(cupom.formasConsumo ?? []).map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(cupom.taxas?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-1.5 text-base font-bold">O que não está incluso</h3>
                <p className="text-sm text-muted-foreground">
                  O benefício não cobre{" "}
                  {listarPtBr(rotulosTaxas(cupom.taxas ?? [])).toLowerCase()}.
                </p>
              </div>
            )}
          </section>
        )}

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
