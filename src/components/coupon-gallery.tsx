"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

/**
 * Galeria da folha do cupom.
 *
 * Com imagem real (Fase 7/C4), mostra a imagem. Sem ela, mantém o placeholder
 * de sempre — os três slides de gradiente variando só o filtro CSS. O fallback
 * não é uma tela de erro: é exatamente o que o app já mostrava, e continua
 * sendo o normal enquanto os lojistas não subirem foto.
 *
 * `imagemUrl` já vem validada por `urlPublicaImagem` (formato + pertence ao
 * estabelecimento daquele cupom) — aqui é só `string | null`.
 */
export function CouponGallery({
  gradiente,
  iconName,
  imagemUrl,
}: {
  gradiente: string;
  iconName: string;
  imagemUrl?: string | null;
}) {
  const [index, setIndex] = React.useState(0);
  const [quebrou, setQuebrou] = React.useState(false);

  // O objeto pode ter sido apagado do bucket com a coluna ainda apontando para
  // ele (o lojista tem DELETE). Sem este onError a folha exibiria um ícone de
  // imagem partida no lugar do desenho.
  const usarImagem = Boolean(imagemUrl) && !quebrou;

  const slides = [
    { background: gradiente, filter: "none" },
    { background: gradiente, filter: "saturate(0.75) brightness(1.08)" },
    { background: gradiente, filter: "hue-rotate(-12deg) brightness(0.95)" },
  ];

  return (
    <div>
      <div className="relative h-60 w-full overflow-hidden">
        {usarImagem ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/image não é
          // usado em lugar nenhum do repo e exigiria remotePatterns; fora do escopo.
          <img
            src={imagemUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setQuebrou(true)}
          />
        ) : (
          <>
            <div className="absolute inset-0" style={slides[index]} />
            <div className="bg-dots absolute inset-0 opacity-25" />
            <Icon
              name={iconName}
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 text-white/85"
            />
          </>
        )}
      </div>

      {/* Os dots são do placeholder de 3 slides; com imagem real há uma só. */}
      {!usarImagem && (
        <div className="flex justify-center gap-2 py-3">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Imagem ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-2 bg-border",
              )}
            />
          ))}
        </div>
      )}
      {usarImagem && <div className="py-3" />}
    </div>
  );
}
