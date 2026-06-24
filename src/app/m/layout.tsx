import { PhoneFrame } from "@/components/phone-frame";
import { MobileFlowProvider } from "@/components/mobile-flow-provider";
import { CouponStateProvider } from "@/components/coupon-state-provider";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileFlowProvider>
      <CouponStateProvider>
        <PhoneFrame>{children}</PhoneFrame>
      </CouponStateProvider>
    </MobileFlowProvider>
  );
}
