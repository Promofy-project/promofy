import { Heart } from "lucide-react";

import { cuponsEmDestaque } from "@/lib/mock-data";
import { CouponListItem } from "@/components/coupon-list-item";
import { PagePlaceholder } from "@/components/page-placeholder";

export default function FavoritosPage() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <h1 className="text-xl font-extrabold">Favoritos</h1>
      <div className="flex flex-col gap-3">
        {cuponsEmDestaque.slice(0, 3).map((c) => (
          <CouponListItem key={c.id} cupom={c} />
        ))}
      </div>
      <PagePlaceholder
        icon={<Heart className="h-6 w-6" />}
        title="Seus cupons salvos"
        description="A coleção completa de favoritos será detalhada em breve."
      />
    </div>
  );
}
