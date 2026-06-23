import { cn } from "@/lib/utils";

/**
 * Fundo de ondas diagonais para as telas de entrada (amarelo da marca).
 * Ondas suaves, levemente mais escuras que o fundo — não chapado.
 */
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
          {/* onda base — repetida e rotacionada para diagonal */}
          <pattern
            id="promofy-wave"
            x="0"
            y="0"
            width="160"
            height="54"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-14)"
          >
            <path
              d="M-20 34 Q 20 6 60 34 T 140 34 T 220 34"
              stroke="#E6A700"
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
              opacity="0.28"
            />
          </pattern>
          {/* segunda camada, deslocada, para dar profundidade */}
          <pattern
            id="promofy-wave-2"
            x="0"
            y="26"
            width="160"
            height="54"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-14)"
          >
            <path
              d="M-20 34 Q 20 62 60 34 T 140 34 T 220 34"
              stroke="#FFE08A"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              opacity="0.45"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#promofy-wave-2)" />
        <rect width="100%" height="100%" fill="url(#promofy-wave)" />
      </svg>
    </div>
  );
}
