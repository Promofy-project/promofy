"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
  /**
   * Quando informado, o componente vira um `<input type="checkbox">` NATIVO.
   *
   * É o que permite participar de um `<form action={serverAction}>` sem
   * JavaScript: o `<button role="checkbox">` abaixo não envia nada, e um
   * `required` nele não existe para o navegador. Sem `name`, nada muda — é o
   * caminho que o /admin/estabelecimentos já usava.
   */
  name?: string;
  required?: boolean;
}

const BASE =
  "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors";
const MARCADO = "border-primary bg-primary text-white";
const VAZIO = "border-border bg-surface hover:border-primary/50";

export function Checkbox({
  checked,
  onCheckedChange,
  id,
  className,
  name,
  required,
  ...props
}: CheckboxProps) {
  if (name) {
    return (
      <span className={cn("relative inline-grid", className)}>
        <input
          type="checkbox"
          id={id}
          name={name}
          required={required}
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className={cn(BASE, "appearance-none", checked ? MARCADO : VAZIO)}
          {...props}
        />
        {checked && (
          <Check
            className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white"
            strokeWidth={3}
            aria-hidden
          />
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(BASE, checked ? MARCADO : VAZIO, className)}
      {...props}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  );
}
