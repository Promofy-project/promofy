import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/** Cabeçalho de tela cheia do app /m: seta voltar + título centralizado. */
export function MobilePageHeader({
  title,
  back = "/m",
  className,
}: {
  title: string;
  back?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface/95 px-3 py-3 backdrop-blur",
        className,
      )}
    >
      <Link
        href={back}
        aria-label="Voltar"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h1 className="flex-1 text-center text-base font-bold">{title}</h1>
      <span className="h-9 w-9 shrink-0" aria-hidden />
    </header>
  );
}
