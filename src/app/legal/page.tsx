import Link from "next/link";

import { TODOS_DOCUMENTOS_LEGAIS } from "@/lib/documentos-legais";

export default function LegalIndexPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-5 py-10">
      <h1 className="text-2xl font-extrabold text-foreground">
        Documentos legais
      </h1>
      <ul className="mt-2 divide-y divide-border rounded-card border border-border bg-card">
        {TODOS_DOCUMENTOS_LEGAIS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/legal/${doc.slug}`}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-muted"
            >
              <span className="text-sm font-semibold text-foreground">
                {doc.titulo}
              </span>
              <span className="text-xs text-muted-foreground">v{doc.versao}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
