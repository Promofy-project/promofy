import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { CategoryChips } from "@/components/category-chips";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function BuscarPage() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-extrabold">Buscar</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar cupons, lojas, categorias…" className="pl-10" />
      </div>
      <CategoryChips />
      <PagePlaceholder
        icon={<Search className="h-6 w-6" />}
        title="Resultados de busca"
        description="Os filtros e resultados detalhados chegam em uma próxima etapa."
      />
    </div>
  );
}
