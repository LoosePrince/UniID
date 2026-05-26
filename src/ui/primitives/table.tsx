"use client";

import * as React from "react";
import { cn } from "./utils";

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...props }, ref) {
    return <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />;
  }
);

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader({ className, ...props }, ref) {
    return <thead ref={ref} className={cn("border-b border-ink-200/70 bg-cream-100/50 dark:border-slate-600/60 dark:bg-slate-800/40", className)} {...props} />;
  }
);

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
  }
);

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableFooter({ className, ...props }, ref) {
    return <tfoot ref={ref} className={cn("border-t border-ink-200/70 bg-cream-100/60 font-medium dark:border-slate-600/60 dark:bg-slate-800/50", className)} {...props} />;
  }
);

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cn("border-b border-ink-200/60 transition-colors hover:bg-white/70 dark:border-slate-700/60 dark:hover:bg-slate-800/50", className)}
        {...props}
      />
    );
  }
);

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead({ className, ...props }, ref) {
    return (
      <th
        ref={ref}
        className={cn("h-10 px-4 text-left align-middle text-xs font-medium text-ink-500 dark:text-slate-400", className)}
        {...props}
      />
    );
  }
);

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({ className, ...props }, ref) {
    return <td ref={ref} className={cn("px-4 py-3 align-middle text-ink-700 dark:text-slate-300", className)} {...props} />;
  }
);

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  function TableCaption({ className, ...props }, ref) {
    return <caption ref={ref} className={cn("mt-3 text-xs text-ink-500 dark:text-slate-400", className)} {...props} />;
  }
);

export function TableShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-ink-200/70 bg-cream-50/60 shadow-[0_12px_30px_rgba(19,17,14,0.055),inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-sm dark:border-slate-600/60 dark:bg-slate-900/50 dark:shadow-[0_12px_28px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]",
        className
      )}
      {...props}
    />
  );
}