"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-2xs font-medium leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-cream-100 text-ink-700 border border-ink-100",
        accent: "bg-accent-50 text-accent-700 border border-accent-100",
        success: "bg-success-50 text-success-700 border border-success-100",
        warning: "bg-warning-50 text-warning-700 border border-warning-100",
        danger: "bg-danger-50 text-danger-700 border border-danger-100",
        solid: "bg-ink-900 text-cream-50 border border-ink-900"
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
