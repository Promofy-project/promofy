import {
  UtensilsCrossed,
  Dumbbell,
  Car,
  Scissors,
  Clapperboard,
  Plane,
  Shirt,
  Smartphone,
  GraduationCap,
  PawPrint,
  Wrench,
  Stethoscope,
  Sofa,
  Baby,
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
 * Registry curado de ícones — mapeia os nomes que vêm do BANCO
 * (`segmentos.icone`, `categorias_novas.icone`) para componentes lucide,
 * mantendo a camada de dados livre de imports de React.
 *
 * Marco 2A: os catorze primeiros são os ícones dos 14 segmentos do
 * catálogo (`docs/taxonomia/catalogo-v1.json`). Oito deles entraram
 * agora — antes do cutover o banco só oferecia seis famílias, e um
 * segmento de Turismo teria caído silenciosamente no `Ticket` abaixo.
 * `scripts/test-m2-cutover.ts` falha se algum `icone` do catálogo real
 * não estiver aqui: o fallback existe para o desconhecido, não para o
 * catálogo que a gente já conhece.
 */
const registry: Record<string, LucideIcon> = {
  // --- os 14 segmentos ---
  UtensilsCrossed, // Alimentação
  Dumbbell, // Fitness e Saúde
  Car, // Automotivo
  Scissors, // Beleza e Bem Estar
  Clapperboard, // Entretenimento
  Plane, // Turismo e Hotelaria
  Shirt, // Moda
  Smartphone, // Eletrônicos
  GraduationCap, // Educação
  PawPrint, // Pet
  Wrench, // Serviços
  Stethoscope, // Saúde
  Sofa, // Casa e Decoração
  Baby, // Infantil e Maternidade

  // --- ícones de UI usados fora da taxonomia ---
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
