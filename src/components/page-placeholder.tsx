import { Hammer } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Stub para telas internas ainda não detalhadas — mantém a navegação fluida. */
export function PagePlaceholder({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-card border border-dashed border-border bg-card/60 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          {icon ?? <Hammer className="h-6 w-6" />}
        </div>
        <h2 className="mt-4 text-lg font-bold">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
        <Badge variant="yellow-soft" className="mt-4">
          Em construção
        </Badge>
      </div>
    </div>
  );
}
