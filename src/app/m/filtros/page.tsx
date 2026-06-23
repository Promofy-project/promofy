import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

import { PagePlaceholder } from "@/components/page-placeholder";

export default function FiltrosPage() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <Link
          href="/m"
          aria-label="Voltar"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Filtros</h1>
      </div>
      <PagePlaceholder
        icon={<SlidersHorizontal className="h-6 w-6" />}
        title="Filtros de busca"
        description="Filtros por categoria, distância, preço e horário chegam em breve."
      />
    </div>
  );
}
