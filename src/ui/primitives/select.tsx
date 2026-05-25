"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ children, className, invalid, ...props }, ref) {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          data-invalid={invalid ? "true" : undefined}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-ink-200 bg-white px-3 pr-9 text-sm text-ink-900",
            "transition-[border,box-shadow] duration-150 ease-out",
            "focus-visible:outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-400/30",
            "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-60",
            "data-[invalid=true]:border-danger-500 data-[invalid=true]:focus-visible:ring-danger-500/30",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
      </div>
    );
  }
);