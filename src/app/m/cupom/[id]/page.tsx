import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  MessageSquareOff,
} from "lucide-react";

import { buscarCupomPorId } from "@/lib/data/cupons";
import { buscarFiltrosPublicos } from "@/lib/data/categorias";
import { resolverCategoriaVisual, rotuloHierarquico } from "@/lib/categoria-visual";
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
import { CupomAcaoUsar } from "@/components/cupom-acao-usar";
import { FavoriteButton } from "@/components/favorite-button";
import { BotaoCompartilhar } from "@/components/botao-compartilhar";
import { RegistrarVisualizacao } from "@/components/registrar-visualizacao";
import { urlPublicaImagem } from "@/lib/imagem-cupom";
import { CupomSinais } from "@/components/cupom-sinais";

// O /m inteiro já é dinâmico (o layout lê cookies); o detalhe deixa de
// ser SSG do mock para poder cair no banco quando o id não está no mock
// (cupom aprovado ao vivo — Fase 4).
export const dynamic = "force-dynamic";

export default async function CupomDetalhe({
  params,
}: {
  params: { id: string };
}) {
  // Só o banco. Sem fallback de protótipo: id ausente ou invisível → 404.
  const [cupom, catalogo] = await Promise.all([
    buscarCupomPorId(params.id),
    buscarFiltrosPublicos(),
  ]);
  if (!cupom) notFound();

  const foraDaJanela = !janelaAlcancavel(
    cupom.janela,
    cupom.prazoAtivacaoHoras ?? 5,
  );

  const janela = cupom.janela;
  const janelaRestringe = temRestricao(janela);
  const linhas = linhasDaJanela(janela, diaSemanaBrt());

  // Fase 6.5/EXTRA: tira a regra que e copia do beneficio (cupons legados)
  const regrasVisiveis = regrasParaExibir(cupom.regras, cupom.beneficio);

  const categoria = cupom.categoriaVisual ?? resolverCategoriaVisual(cupom.categoria, catalogo);

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
        <BotaoCompartilhar titulo={cupom.titulo} />
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
          <p className="mt-1.5 text-sm font-semibold text-muted-foreground">
            {rotuloHierarquico(categoria.segmentoLabel, categoria.label)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Estou economizando{" "}
            {rotuloEconomia(formatBRL(cupom.economia), cupom.economiaVariavel)}
          </p>
          <CupomSinais cupom={cupom} className="mt-3" />
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

        {/* Avaliações
            Fase 9/Z3 — os depoimentos saíram. Eram de `mock-data`: "Mariana
            Alves" e "Rafael Souza" com textos que ninguém escreveu, colados a
            um cupom REAL, na única das três telas com dado inventado que o
            CONSUMIDOR via. É a mesma decisão que matou o "8,7" do portal e os
            cards do dashboard — depoimento fictício ao lado de oferta real
            contamina a credibilidade da oferta.

            ADENDO 05/08 — o cliente decidiu o destino: avaliação é do
            ESTABELECIMENTO, e NUNCA volta para a página do cupom. Por isso o
            estado honesto não promete mais "avaliações deste cupom" — dizer
            isso seria prometer uma tela que, por decisão de produto, não vai
            existir. O sistema de estrelas + texto vive no perfil do
            estabelecimento (backlog da Fase 10). */}
        <section>
          <h3 className="mb-3 text-base font-bold">Avaliações</h3>
          <div className="flex items-start gap-3 rounded-card border border-border bg-card p-4">
            <MessageSquareOff
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold">
                Cupom não recebe avaliação
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Quem resgata avalia o estabelecimento, e não a oferta. É no
                perfil do estabelecimento que essas avaliações ficam.
              </p>
            </div>
          </div>
        </section>

        {/* Localização — só o que o schema tem (cidade). Rua, telefone e
            WhatsApp NÃO existem em estabelecimentos: inventar número/endereço
            era dado fake apresentado como real. Sem cidade, o bloco some. */}
        {cupom.cidade ? (
          <section>
            <h3 className="mb-2 text-base font-bold">Localização</h3>
            <p className="flex items-start gap-2 text-sm text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {cupom.cidade}
            </p>
          </section>
        ) : null}
      </div>

      {/* Rodapé fixo */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <CupomAcaoUsar cupom={cupom} size="lg" full foraDaJanela={foraDaJanela} />
      </div>
    </div>
  );
}
