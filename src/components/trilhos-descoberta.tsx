import Link from "next/link";

import type { Cupom } from "@/lib/types";
import { CouponCard } from "@/components/coupon-card";
import { CupomSeloUtilizado } from "@/components/cupom-selo-utilizado";

function Trilho({
  titulo,
  href,
  cupons,
  vazio,
}: {
  titulo: string;
  href: string;
  cupons: Cupom[];
  vazio?: string;
}) {
  if (cupons.length === 0) {
    return vazio ? (
      <section className="px-4">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{vazio}</p>
      </section>
    ) : null;
  }
  return (
    <section className="px-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">{titulo}</h2>
        <Link href={href} className="text-xs font-bold text-primary">
          Ver todos
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        {cupons.slice(0, 8).map((c) => (
          <div key={c.id} className="w-[220px] shrink-0">
            <CouponCard
              cupom={c}
              href={`/m/cupom/${c.id}`}
              economiaTone="blue"
              compact
              overlay={<CupomSeloUtilizado cupomId={c.id} />}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrilhosDescoberta({
  novos,
  emAlta,
  popularesRegiao,
  cidade,
  ultimasUnidades,
}: {
  novos: Cupom[];
  emAlta: Cupom[];
  popularesRegiao: Cupom[];
  cidade?: string;
  ultimasUnidades: Cupom[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <Trilho titulo="Novos do dia" href="/m/buscar?trilho=novos" cupons={novos} />
      <Trilho titulo="Em alta" href="/m/buscar?trilho=alta" cupons={emAlta} />
      {cidade ? (
        <Trilho
          titulo={`Populares em ${cidade.split(",")[0]}`}
          href={`/m/buscar?trilho=populares&cidade=${encodeURIComponent(cidade)}`}
          cupons={popularesRegiao}
        />
      ) : (
        <Trilho
          titulo="Populares na região"
          href="/m/buscar"
          cupons={[]}
          vazio="Escolha uma cidade para ver o que está popular por lá."
        />
      )}
      <Trilho
        titulo="Últimas unidades"
        href="/m/buscar?trilho=unidades"
        cupons={ultimasUnidades}
      />
    </div>
  );
}
