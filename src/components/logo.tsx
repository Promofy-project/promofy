import { TicketPercent } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  variant = "default",
}: {
  className?: string;
  /** "default" = blue mark on light bg · "light" = white text on blue bg */
  variant?: "default" | "light";
}) {
  const isLight = variant === "light";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-[10px] shadow-sm",
          isLight ? "bg-white" : "bg-primary",
        )}
      >
        <TicketPercent
          className={cn("h-5 w-5", isLight ? "text-primary" : "text-white")}
          strokeWidth={2.4}
        />
      </span>
      <span
        className={cn(
          "text-xl font-extrabold tracking-tight",
          isLight ? "text-white" : "text-foreground",
        )}
      >
        Promo<span className="text-yellow">fy</span>
      </span>
    </span>
  );
}
