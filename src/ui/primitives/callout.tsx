"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./utils";

const toneStyles = {
  info: {
    icon: Info,
    className: "border-accent-100/80 bg-accent-50/72 text-accent-900",
    iconClassName: "text-accent-600"
  },
  success: {
    icon: CheckCircle2,
    className: "border-success-100/80 bg-success-50/78 text-success-700",
    iconClassName: "text-success-600"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning-100/80 bg-warning-50/78 text-warning-700",
    iconClassName: "text-warning-600"
  },
  danger: {
    icon: XCircle,
    className: "border-danger-100/80 bg-danger-50/78 text-danger-700",
    iconClassName: "text-danger-600"
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
          "relative flex gap-3 rounded-xl border px-4 py-3 text-sm shadow-[0_10px_26px_rgba(19,17,14,0.04),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-sm",
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