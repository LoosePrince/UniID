"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "./utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-ink-200/70 bg-ink-200/80 p-px shadow-[inset_0_1px_2px_rgba(19,17,14,0.08)] dark:border-slate-600/60 dark:bg-slate-700/80",
        "transition-[background,border,box-shadow] duration-150 hover:border-ink-300 hover:bg-ink-300/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/25 dark:hover:border-slate-500 dark:hover:bg-slate-600/80",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-accent-500 data-[state=checked]:bg-accent-600 data-[state=checked]:shadow-[inset_0_1px_2px_rgba(34,34,92,0.22)] dark:data-[state=checked]:border-accent-300/70 dark:data-[state=checked]:bg-accent-500",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-[0_1px_4px_rgba(19,17,14,0.18)] ring-0 transition-[transform,background,box-shadow] dark:bg-slate-100 dark:data-[state=checked]:bg-white data-[state=checked]:shadow-[0_1px_5px_rgba(34,34,92,0.28)]",
          "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  );
});
