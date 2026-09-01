import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * 404 do segmento /m — cupom inexistente, rota morta, etc.
 * Evita a página genérica do Next com stack/idioma de framework.
 */
export default function MobileNotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-5">
      <div className="max-w-xs text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-bold">Não encontramos isso</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          O cupom ou a página pode ter saído do ar. Volte à busca e escolha
          outra oferta.
        </p>
        <Link
          href="/m/buscar"
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-btn bg-primary text-sm font-bold text-primary-foreground"
        >
          Ir para a busca
        </Link>
      </div>
    </div>
  );
}
