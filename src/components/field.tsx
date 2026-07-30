import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";

export interface FieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * Campo com rótulo + input alto e arredondado (telas de entrada).
 *
 * `type="password"` ganha automaticamente o "visualizar senha" — é por
 * isso que as cinco telas de login não precisaram mudar nada.
 */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const classes = cn(
      "h-12 rounded-xl border-transparent bg-muted/70 focus-visible:border-primary focus-visible:bg-surface",
      className,
    );
    const Campo = props.type === "password" ? PasswordInput : Input;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        <Campo id={fieldId} ref={ref} className={classes} {...props} />
      </div>
    );
  },
);
Field.displayName = "Field";
