import { notFound } from "next/navigation";
import Link from "next/link";

import { TODOS_DOCUMENTOS_LEGAIS, EMAIL_PRIVACIDADE } from "@/lib/documentos-legais";
import { PARAGRAFOS_PRIVACIDADE } from "@/lib/legal-content/privacidade";
import { PARAGRAFOS_COOKIES } from "@/lib/legal-content/cookies";
import { PARAGRAFOS_TERMOS_CONSUMIDOR } from "@/lib/legal-content/termos-consumidor";
import { PARAGRAFOS_TERMOS_PARCEIRO } from "@/lib/legal-content/termos-parceiro";
import { PARAGRAFOS_PROMOPOINTS } from "@/lib/legal-content/promopoints";

export function generateStaticParams() {
  return TODOS_DOCUMENTOS_LEGAIS.map((d) => ({ doc: d.slug }));
}

const CONTEUDO_POR_SLUG: Record<string, readonly string[]> = {
  privacidade: PARAGRAFOS_PRIVACIDADE,
  cookies: PARAGRAFOS_COOKIES,
  "termos-consumidor": PARAGRAFOS_TERMOS_CONSUMIDOR,
  "termos-parceiro": PARAGRAFOS_TERMOS_PARCEIRO,
  promopoints: PARAGRAFOS_PROMOPOINTS,
};

/**
 * Fase 4 LEGAL-PRIVACY-01H: o texto vem da fonte primária do cliente
 * (docs/legal/source/*.docx, extraído verbatim em
 * src/lib/legal-content/*.ts) — não é mais um placeholder. "PENDING
 * LEGAL FINALIZATION" saiu porque a fonte existe; o que resta pendente é
 * só a data de publicação real (os arquivos trazem "[DATA DE
 * PUBLICAÇÃO]") — por isso o aviso de rascunho fica FORA do texto
 * jurídico, nunca dentro dele.
 */
export default async function DocumentoLegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc: slug } = await params;
  const doc = TODOS_DOCUMENTOS_LEGAIS.find((d) => d.slug === slug);
  const paragrafos = CONTEUDO_POR_SLUG[slug];
  if (!doc || !paragrafos) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-5 py-10">
      <Link href="/legal" className="text-sm text-muted-foreground underline">
        ← Todos os documentos
      </Link>

      {doc.status === "draft" && (
        <div className="rounded-card border border-yellow/40 bg-yellow-soft px-4 py-3 text-sm text-foreground">
          <p className="font-semibold">Documento em revisão — ainda não vigente para novo aceite.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O texto abaixo é o conteúdo recebido do time jurídico, exibido na íntegra para consulta. Ele
            ainda não tem data de publicação/vigência definida e, por isso, não é usado hoje para exigir
            aceite de ninguém.
          </p>
        </div>
      )}

      <article className="flex flex-col gap-3">
        {paragrafos.map((texto, i) => (
          <p
            key={i}
            className={
              i === 0
                ? "text-2xl font-extrabold text-foreground"
                : /^\d+(\.\d+)*[.\s]/.test(texto) && texto.length < 80
                  ? "mt-2 text-base font-bold text-foreground"
                  : "text-sm leading-relaxed text-foreground"
            }
          >
            {texto}
          </p>
        ))}
      </article>

      <div className="mt-4 rounded-card border border-border bg-muted p-4 text-xs text-muted-foreground">
        Dúvidas sobre este documento:{" "}
        <a href={`mailto:${EMAIL_PRIVACIDADE}`} className="underline">
          {EMAIL_PRIVACIDADE}
        </a>
      </div>
    </main>
  );
}
