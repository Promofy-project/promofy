import { PhoneFrame } from "@/components/phone-frame";
import { MobileFlowProvider } from "@/components/mobile-flow-provider";
import { CouponStateProvider } from "@/components/coupon-state-provider";
import { FavoritesProvider } from "@/components/favorites-provider";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileFlowProvider>
      <FavoritesProvider>
        <CouponStateProvider>
          <PhoneFrame>{children}</PhoneFrame>
        </CouponStateProvider>
      </FavoritesProvider>
    </MobileFlowProvider>
  );
}
