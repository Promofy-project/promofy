import { PhoneFrame } from "@/components/phone-frame";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PhoneFrame>{children}</PhoneFrame>;
}
