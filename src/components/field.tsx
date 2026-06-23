import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface FieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Campo com rótulo + input alto e arredondado (telas de entrada). */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <Input
          id={fieldId}
          ref={ref}
          className={cn(
            "h-12 rounded-xl border-transparent bg-muted/70 focus-visible:border-primary focus-visible:bg-surface",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Field.displayName = "Field";
