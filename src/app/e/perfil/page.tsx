import { Store, MapPin, Tag } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { buscarGaleriaDaSessao } from "@/lib/data/galeria-estab";
import { buscarCatalogoResolucao } from "@/lib/data/taxonomia";
import { rotuloHierarquico } from "@/lib/categoria-visual";
import { urlPublicaImagem } from "@/lib/imagem-cupom";
import { BotaoSair } from "@/components/botao-sair";
import { GaleriaEstabelecimento } from "@/components/estab/galeria-estabelecimento";

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

  let est: { id: string; nome: string; cidade: string; status: string; logo: string } | null =
    null;
  let categoriaLabel: string | null = null;
  let segmentoLabel: string | null = null;
  if (uid) {
    const { data } = await supabase
      .from("estabelecimentos")
      .select("id, nome, cidade, status, logo, categoria_principal_id")
      .eq("owner_id", uid)
      .maybeSingle();
    if (data) {
      est = {
        id: data.id,
        nome: data.nome,
        cidade: data.cidade,
        status: data.status,
        logo: data.logo ?? "",
      };
      if (data.categoria_principal_id) {
        const catalogo = await buscarCatalogoResolucao();
        const vis = catalogo.find((c) => c.id === data.categoria_principal_id);
        categoriaLabel = vis?.label ?? null;
        segmentoLabel = vis?.segmentoLabel ?? null;
      }
    }
  }

  // CLIENT-RETURNS-03 — PARIDADE COM O PORTAL. A galeria do perfil é
  // gerenciável aqui também, pelo MESMO componente (`GaleriaEstabelecimento`).
  // Deixar o Portal com galeria e o /e só de leitura seria pedir ao lojista
  // que trocasse de aparelho para trocar uma foto do próprio balcão.
  const galeria = est ? await buscarGaleriaDaSessao() : { imagens: [] };

  const logoUrl = est
    ? urlPublicaImagem(est.logo, est.id, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    : null;

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <header className="pt-2">
        <h1 className="text-xl font-extrabold">Perfil</h1>
      </header>

      <div className="rounded-card border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-6 w-6" />
            </div>
          )}
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
            <span>
              {categoriaLabel
                ? rotuloHierarquico(segmentoLabel, categoriaLabel)
                : "—"}
            </span>
          </div>
        </dl>
      </div>

      {est && (
        <div className="rounded-card border border-border bg-card p-4">
          <GaleriaEstabelecimento
            nomeEstabelecimento={est.nome}
            imagens={galeria.imagens.map((i) => ({ id: i.id, url: i.url }))}
            compacto
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Para editar nome, cidade, relatórios e campanhas, use a plataforma web
        do estabelecimento.
      </p>

      <div className="mt-auto">
        <BotaoSair redirect="/e/login" variant="outline" className="w-full">
          Sair da conta
        </BotaoSair>
      </div>
    </div>
  );
}
