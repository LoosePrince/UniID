"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./utils";

const toneStyles = {
  info: {
    icon: Info,
    className: "border-accent-300/40 bg-accent-50/50 text-accent-900 dark:border-accent-300/40 dark:bg-accent-900/30 dark:text-accent-100",
    iconClassName: "text-accent-600 dark:text-accent-200"
  },
  success: {
    icon: CheckCircle2,
    className: "border-success-500/30 bg-success-50/60 text-success-700 dark:border-success-500/40 dark:bg-success-700/20 dark:text-success-100",
    iconClassName: "text-success-600 dark:text-success-100"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning-500/40 bg-warning-50/60 text-warning-700 dark:border-warning-500/40 dark:bg-warning-700/20 dark:text-warning-100",
    iconClassName: "text-warning-600 dark:text-warning-100"
  },
  danger: {
    icon: XCircle,
    className: "border-danger-500/30 bg-danger-50/60 text-danger-700 dark:border-danger-500/40 dark:bg-danger-700/30 dark:text-danger-100",
    iconClassName: "text-danger-600 dark:text-danger-100"
  }
} as const;

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof toneStyles;
  icon?: React.ComponentType<{ className?: string }> | false;
}

export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  function Callout({ className, tone = "info", icon, children, ...props }, ref) {
    const style = toneStyles[tone];
    const Icon = icon === false ? null : icon ?? style.icon;

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-[0_10px_24px_rgba(19,17,14,0.045),inset_0_1px_0_rgba(255,255,255,0.48)] backdrop-blur-sm dark:shadow-[0_10px_24px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.035)]",
          style.className,
          className
        )}
        {...props}
      >
        {Icon ? <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.iconClassName)} /> : null}
        <div className="min-w-0 space-y-1">{children}</div>
      </div>
    );
  }
);

export function CalloutTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-medium leading-5", className)} {...props} />;
}

export function CalloutDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-5 opacity-80", className)} {...props} />;
}