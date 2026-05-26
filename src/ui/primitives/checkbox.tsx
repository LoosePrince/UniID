"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "./utils";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-xs border border-ink-300/90 bg-cream-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-slate-500/70 dark:bg-slate-800/60 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "transition-[background,border,box-shadow,color] duration-150 hover:border-ink-400 hover:bg-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/25 dark:hover:border-slate-400/70 dark:hover:bg-slate-800/75",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-ink-900 data-[state=checked]:bg-ink-900 data-[state=checked]:text-cream-50 dark:data-[state=checked]:border-slate-200 dark:data-[state=checked]:bg-slate-100 dark:data-[state=checked]:text-slate-950",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check className="h-3 w-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
