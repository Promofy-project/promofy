import { Crown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface PodiumEntry {
  nome: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function firstName(name: string) {
  return name.split(" ")[0];
}

// Configuração por posição (1º, 2º, 3º)
const rankStyle: Record<
  1 | 2 | 3,
  { ring: string; block: string; pedestal: string; avatar: string }
> = {
  1: {
    ring: "ring-[#FAC81E]",
    block: "from-[#FACC15] to-[#E6A700]",
    pedestal: "h-12",
    avatar: "h-11 w-11",
  },
  2: {
    ring: "ring-[#C7CCD6]",
    block: "from-[#D7DCE5] to-[#AEB4C2]",
    pedestal: "h-8",
    avatar: "h-9 w-9",
  },
  3: {
    ring: "ring-[#E2A06A]",
    block: "from-[#E8B486] to-[#CD7F44]",
    pedestal: "h-6",
    avatar: "h-9 w-9",
  },
};

function Column({ entry, rank }: { entry: PodiumEntry; rank: 1 | 2 | 3 }) {
  const s = rankStyle[rank];
  return (
    <div className="flex w-1/3 flex-col items-center justify-end">
      {rank === 1 && (
        <Crown className="mb-0.5 h-4 w-4 fill-[#FAC81E] text-[#E6A700]" />
      )}
      <Avatar className={cn(s.avatar, "ring-2", s.ring)}>
        <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
          {initials(entry.nome)}
        </AvatarFallback>
      </Avatar>
      <span className="mt-1 max-w-full truncate text-[10px] font-medium text-foreground">
        {firstName(entry.nome)}
      </span>
      <div
        className={cn(
          "mt-1 flex w-full items-start justify-center rounded-t-md bg-gradient-to-b pt-1 text-sm font-extrabold text-white shadow-sm",
          s.block,
          s.pedestal,
        )}
      >
        {rank}
      </div>
    </div>
  );
}

/** Pódio com 3 posições: 2º à esquerda, 1º ao centro (mais alto), 3º à direita. */
export function Podium({
  titulo,
  entries,
}: {
  titulo: string;
  /** top 3, em ordem (entries[0] = 1º lugar) */
  entries: PodiumEntry[];
}) {
  const [first, second, third] = entries;
  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="mb-2 text-center text-xs font-bold text-foreground">
        {titulo}
      </p>
      <div className="flex w-full items-end justify-center gap-0.5">
        {second && <Column entry={second} rank={2} />}
        {first && <Column entry={first} rank={1} />}
        {third && <Column entry={third} rank={3} />}
      </div>
    </div>
  );
}
