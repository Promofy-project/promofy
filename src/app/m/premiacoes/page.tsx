import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";

import { PagePlaceholder } from "@/components/page-placeholder";

export default function PremiacoesPage() {
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
        <h1 className="text-xl font-extrabold">Premiações</h1>
      </div>
      <PagePlaceholder
        icon={<Trophy className="h-6 w-6" />}
        title="Prêmios e recompensas"
        description="O catálogo de prêmios e o ranking completo chegam em uma próxima etapa."
      />
    </div>
  );
}
