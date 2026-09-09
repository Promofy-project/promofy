/**
 * Galeria do perfil do estabelecimento — LADO CONSUMIDOR (CLIENT-RETURNS-03).
 *
 * Server component: é só imagem e layout, nada de estado. O carrossel é uma
 * faixa com scroll horizontal e `snap` — CSS puro, sem biblioteca e sem
 * JavaScript, o que também é o que faz ele funcionar com teclado e leitor de
 * tela sem nenhum trabalho extra.
 *
 * GALERIA VAZIA NÃO RENDERIZA NADA. Quem chama recebe `null` e não fica com um
 * título órfão em cima de um retângulo cinza. Uma imagem só também não vira
 * "carrossel de 1": ela ocupa a largura inteira.
 *
 * Esta seção é ADICIONAL. Não desloca a logo nem a identidade acima dela, e
 * não tem nada a ver com a imagem principal do cupom.
 */
import { ASPECTO_IMAGEM_GALERIA, altImagemGaleria } from "@/lib/galeria-estabelecimento";

export function GaleriaPerfilEstab({
  nomeEstabelecimento,
  imagens,
}: {
  nomeEstabelecimento: string;
  /** Já ordenadas e com URL resolvida por `buscarGaleriaPublica`. */
  imagens: { id: string; url: string | null }[];
}) {
  // Caminho inválido → `url` nula → a imagem não entra. Um <img> sem src é
  // pior que uma foto a menos.
  const validas = imagens.filter((i) => i.url);
  if (validas.length === 0) return null;

  const total = validas.length;

  return (
    <section>
      <h3 className="mb-2 text-base font-bold">Fotos do estabelecimento</h3>
      {total === 1 ? (
        <div
          className="overflow-hidden rounded-card border border-border bg-muted"
          style={{ aspectRatio: `${ASPECTO_IMAGEM_GALERIA} / 1` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={validas[0].url as string}
            alt={altImagemGaleria(nomeEstabelecimento, 0, total)}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        // A faixa rola DENTRO de si mesma (`overflow-x-auto`); o body nunca
        // rola na horizontal, nem com 12 fotos num viewport de 390px.
        <ul className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
          {validas.map((img, i) => (
            <li
              key={img.id}
              className="w-[78%] shrink-0 snap-start overflow-hidden rounded-card border border-border bg-muted sm:w-[46%]"
              style={{ aspectRatio: `${ASPECTO_IMAGEM_GALERIA} / 1` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url as string}
                alt={altImagemGaleria(nomeEstabelecimento, i, total)}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
