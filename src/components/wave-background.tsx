import { cn } from "@/lib/utils";

/**
 * Grafismo do fundo amarelo da marca.
 *
 * Ondas amplas que irradiam de um ponto fora do quadro — o mesmo motivo
 * do material de marca que já roda nas landings (`public/lp/*​/wave-amarela.png`).
 * Substitui os riscos diagonais que existiam aqui antes, que não vinham
 * da identidade visual (eram desenhados à mão, com hex chapado).
 *
 * PONTO ÚNICO DE TROCA: quando a equipe fornecer o grafismo definitivo do
 * manual, só este arquivo muda — as duas telas que o usam
 * (`phone-frame.tsx` nas telas de entrada e `landing/hero.tsx`) continuam
 * intocadas, e as cores saem dos tokens em globals.css.
 *
 * Vetor de propósito: escala de 390×844 (celular) a hero widescreen sem
 * borrar e sem pesar no LCP da tela de login.
 */

/** Anéis do leque: raio + espessura crescendo para fora (mais aberto na borda). */
const ONDAS: Array<{ r: number; w: number }> = [
  { r: 46, w: 9 },
  { r: 84, w: 12 },
  { r: 130, w: 16 },
  { r: 186, w: 21 },
  { r: 252, w: 27 },
  { r: 330, w: 34 },
  { r: 422, w: 43 },
  { r: 530, w: 54 },
  { r: 656, w: 68 },
  { r: 802, w: 86 },
  { r: 972, w: 106 },
  { r: 1170, w: 130 },
];

export function WaveBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none overflow-hidden bg-yellow", className)}
    >
      <svg
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 400 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* clarão suave no núcleo, como no material da marca */}
          <radialGradient id="promofy-wave-nucleo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" style={{ stopColor: "var(--promofy-wave-light)", stopOpacity: 0.5 }} />
            <stop offset="1" style={{ stopColor: "var(--promofy-wave-light)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        {/*
          translate = foco do leque (fora do quadro, embaixo à direita);
          rotate + scale achatam os círculos em ondas largas e inclinadas.
          O `scale` não-uniforme é intencional: afina o traço nas pontas e
          engrossa na barriga, que é o que dá o aspecto de pena/onda em vez
          de alvo concêntrico.
        */}
        <g transform="translate(330 706) rotate(-20) scale(1 0.58)">
          {ONDAS.map(({ r, w }, i) => (
            <circle
              key={r}
              cx="0"
              cy="0"
              r={r}
              strokeWidth={w}
              style={{
                stroke:
                  i % 2 === 0
                    ? "var(--promofy-wave-deep)"
                    : "var(--promofy-wave-light)",
                opacity: i % 2 === 0 ? 0.4 : 0.55,
              }}
            />
          ))}
        </g>

        <circle cx="330" cy="706" r="160" fill="url(#promofy-wave-nucleo)" />
      </svg>
    </div>
  );
}
