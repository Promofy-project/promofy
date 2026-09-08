import { notFound } from "next/navigation";
import Link from "next/link";

import { TODOS_DOCUMENTOS_LEGAIS } from "@/lib/documentos-legais";

export function generateStaticParams() {
  return TODOS_DOCUMENTOS_LEGAIS.map((d) => ({ doc: d.slug }));
}

/**
 * Fase 18/19 LEGAL-PRIVACY-01: o texto jurídico integral destes 5
 * documentos NÃO está versionado neste repositório (confirmado em
 * docs/audits/2026-09-02-final-client-audit.md §1.3 e reconfirmado em
 * docs/audits/2026-09-08-legal-privacy-gap-analysis.md). Escrever o texto
 * aqui seria inventar cláusula jurídica — a instrução deste WP proíbe
 * isso explicitamente. A rota existe (não é 404 nem link morto) e mostra
 * o estado real: pendente de publicação, com contato para quem precisar
 * do documento antes da versão final entrar no ar.
 */
export default async function DocumentoLegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc: slug } = await params;
  const doc = TODOS_DOCUMENTOS_LEGAIS.find((d) => d.slug === slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-5 py-10">
      <Link href="/legal" className="text-sm text-muted-foreground underline">
        ← Todos os documentos
      </Link>
      <h1 className="text-2xl font-extrabold text-foreground">{doc.titulo}</h1>
      <p className="text-sm text-muted-foreground">Versão {doc.versao}</p>

      <div className="mt-2 rounded-card border border-border bg-muted p-5">
        <p className="text-sm font-semibold text-foreground">
          PENDING LEGAL FINALIZATION
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          O texto integral deste documento está em publicação e ainda não
          está hospedado nesta página. A versão vigente ({doc.versao}) é a
          que o Promofy usa hoje para registrar aceites — aceitar aqui não
          significa que o texto completo já esteja disponível para leitura
          nesta URL.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Precisa do texto agora?{" "}
          <a href="mailto:privacidade@promofy.com.br" className="underline">
            privacidade@promofy.com.br
          </a>
        </p>
      </div>
    </main>
  );
}
