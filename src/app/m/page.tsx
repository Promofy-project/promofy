import { Bell, MapPin, Search } from "lucide-react";

import { cupons, cuponsEmDestaque } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CategoryChips } from "@/components/category-chips";
import { CouponCard } from "@/components/coupon-card";
import { CouponListItem } from "@/components/coupon-list-item";

export default function MobileHome() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> São Paulo, SP
          </p>
          <p className="text-lg font-extrabold leading-tight">Olá, Mariana 👋</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative grid h-10 w-10 place-items-center rounded-full bg-muted">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
          </button>
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-primary">
              MA
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar cupons, lojas…" className="pl-10" />
      </div>

      {/* Categories */}
      <CategoryChips />

      {/* Destaques carousel */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Ofertas em destaque</h2>
          <button className="text-xs font-semibold text-primary">Ver tudo</button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
          {cuponsEmDestaque.map((c) => (
            <CouponCard key={c.id} cupom={c} className="w-64 shrink-0" />
          ))}
        </div>
      </section>

      {/* Perto de você */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Perto de você</h2>
          <button className="text-xs font-semibold text-primary">Ver tudo</button>
        </div>
        <div className="flex flex-col gap-3">
          {cupons.slice(0, 6).map((c) => (
            <CouponListItem key={c.id} cupom={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
