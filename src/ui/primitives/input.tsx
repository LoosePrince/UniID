"use client";

import * as React from "react";
import { cn } from "./utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-invalid={invalid ? "true" : undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full rounded-lg border border-ink-200/80 bg-cream-50/70 px-3.5 text-sm text-ink-900 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-100",
          "shadow-[0_8px_18px_rgba(19,17,14,0.045),inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-sm dark:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "placeholder:text-ink-400 dark:placeholder:text-slate-500",
          "transition-[border,box-shadow,background-color] duration-200 ease-out",
          "hover:border-ink-300/80 hover:bg-white/80 dark:hover:border-slate-500/70 dark:hover:bg-slate-800/70",
          "focus-visible:border-accent-400/70 focus-visible:bg-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/30 focus-visible:shadow-[0_0_0_3px_rgba(119,111,218,0.08),0_10px_24px_rgba(19,17,14,0.08)] dark:focus-visible:border-accent-300/40 dark:focus-visible:bg-slate-800/75 dark:focus-visible:ring-accent-300/20 dark:focus-visible:shadow-[0_0_0_3px_rgba(119,111,218,0.10),0_10px_24px_rgba(0,0,0,0.18)]",
          "disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-cream-100/70 disabled:text-ink-400 disabled:shadow-none dark:disabled:border-slate-700/60 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-500",
          "data-[invalid=true]:border-danger-500/60 data-[invalid=true]:focus-visible:ring-danger-500/30",
          className
        )}
        {...props}
      />
    );
  }
);

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-invalid={invalid ? "true" : undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex min-h-24 w-full resize-y rounded-lg border border-ink-200/80 bg-cream-50/70 px-3.5 py-2.5 text-sm text-ink-900 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-100",
          "shadow-[0_8px_18px_rgba(19,17,14,0.045),inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-sm dark:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "placeholder:text-ink-400 dark:placeholder:text-slate-500",
          "transition-[border,box-shadow,background-color] duration-200 ease-out",
          "hover:border-ink-300/80 hover:bg-white/80 dark:hover:border-slate-500/70 dark:hover:bg-slate-800/70",
          "focus-visible:border-accent-400/70 focus-visible:bg-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/30 focus-visible:shadow-[0_0_0_3px_rgba(119,111,218,0.08),0_10px_24px_rgba(19,17,14,0.08)] dark:focus-visible:border-accent-300/40 dark:focus-visible:bg-slate-800/75 dark:focus-visible:ring-accent-300/20 dark:focus-visible:shadow-[0_0_0_3px_rgba(119,111,218,0.10),0_10px_24px_rgba(0,0,0,0.18)]",
          "disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-cream-100/70 disabled:text-ink-400 disabled:shadow-none dark:disabled:border-slate-700/60 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-500",
          "data-[invalid=true]:border-danger-500/60 data-[invalid=true]:focus-visible:ring-danger-500/30",
          className
        )}
        {...props}
      />
    );
  }
);