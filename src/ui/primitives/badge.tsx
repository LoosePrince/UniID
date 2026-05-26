"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-2xs font-medium leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border border-ink-200/80 bg-cream-100/80 text-ink-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.48)] dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        accent: "border border-accent-200/70 bg-accent-50/70 text-accent-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-accent-300/40 dark:bg-accent-900/40 dark:text-accent-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        success: "border border-success-500/30 bg-success-50/80 text-success-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-success-500/40 dark:bg-success-700/30 dark:text-success-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        warning: "border border-warning-500/30 bg-warning-50/80 text-warning-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-warning-500/40 dark:bg-warning-700/30 dark:text-warning-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        danger: "border border-danger-500/30 bg-danger-50/80 text-danger-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-danger-500/40 dark:bg-danger-700/30 dark:text-danger-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        solid: "border border-ink-900 bg-ink-900 text-cream-50 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-950"
      }
    },
    defaultVariants: { tone: "neutral" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
