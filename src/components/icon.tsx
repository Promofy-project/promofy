import {
  UtensilsCrossed,
  Dumbbell,
  Scissors,
  Smartphone,
  GraduationCap,
  PawPrint,
  Ticket,
  Eye,
  TrendingUp,
  TrendingDown,
  Star,
  DollarSign,
  Users,
  Store,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icon registry — maps the string names stored in mock-data
 * to lucide components (keeps data layer free of React imports).
 */
const registry: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Dumbbell,
  Scissors,
  Smartphone,
  GraduationCap,
  PawPrint,
  Ticket,
  Eye,
  TrendingUp,
  TrendingDown,
  Star,
  DollarSign,
  Users,
  Store,
  HeartHandshake,
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = registry[name] ?? Ticket;
  return <Cmp className={className} />;
}
