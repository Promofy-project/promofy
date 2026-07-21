import { Store, MapPin, Tag } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { BotaoSair } from "@/components/botao-sair";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Em análise",
  suspenso: "Suspenso",
};

export default async function PerfilPage() {
  const supabase = createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;

  let est: { nome: string; cidade: string; status: string } | null = null;
  let categoriaLabel: string | null = null;
  if (uid) {
    const { data } = await supabase
      .from("estabelecimentos")
      .select("nome, cidade, status, categoria_id")
      .eq("owner_id", uid)
      .maybeSingle();
    if (data) {
      est = { nome: data.nome, cidade: data.cidade, status: data.status };
      if (data.categoria_id) {
        const { data: cat } = await supabase
          .from("categorias")
          .select("label")
          .eq("id", data.categoria_id)
          .maybeSingle();
        categoriaLabel = cat?.label ?? null;
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="text-xl font-extrabold">Perfil</h1>
      </header>

      <div className="rounded-card border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Store className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">
              {est?.nome ?? "Estabelecimento"}
            </p>
            <p className="text-sm text-muted-foreground">
              {est ? STATUS_LABEL[est.status] ?? est.status : "—"}
            </p>
          </div>
        </div>
        <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{est?.cidade ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{categoriaLabel ?? "—"}</span>
          </div>
        </dl>
      </div>

      <p className="text-xs text-muted-foreground">
        Para editar dados, relatórios e campanhas, use a plataforma web do
        estabelecimento.
      </p>

      <div className="mt-auto">
        <BotaoSair redirect="/e/login" variant="outline" className="w-full">
          Sair da conta
        </BotaoSair>
      </div>
    </div>
  );
}
