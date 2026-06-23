import { PhoneFrame } from "@/components/phone-frame";
import { MobileFlowProvider } from "@/components/mobile-flow-provider";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileFlowProvider>
      <PhoneFrame>{children}</PhoneFrame>
    </MobileFlowProvider>
  );
}
