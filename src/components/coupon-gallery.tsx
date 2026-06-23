"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

/** Galeria de imagens do produto (placeholder) com dots indicadores. */
export function CouponGallery({
  gradiente,
  iconName,
}: {
  gradiente: string;
  iconName: string;
}) {
  const [index, setIndex] = React.useState(0);
  const slides = [
    { background: gradiente, filter: "none" },
    { background: gradiente, filter: "saturate(0.75) brightness(1.08)" },
    { background: gradiente, filter: "hue-rotate(-12deg) brightness(0.95)" },
  ];

  return (
    <div>
      <div className="relative h-60 w-full overflow-hidden">
        <div className="absolute inset-0" style={slides[index]} />
        <div className="bg-dots absolute inset-0 opacity-25" />
        <Icon
          name={iconName}
          className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 text-white/85"
        />
      </div>

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
    </div>
  );
}
