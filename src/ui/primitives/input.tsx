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
          "flex h-10 w-full rounded-lg border border-white/70 bg-white/76 px-3.5 text-sm text-ink-900",
          "shadow-[0_8px_20px_rgba(19,17,14,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm",
          "placeholder:text-ink-400",
          "transition-[border,box-shadow,background-color] duration-200 ease-out",
          "focus-visible:border-accent-300 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/30 focus-visible:shadow-[0_10px_28px_rgba(91,91,214,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]",
          "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-65 disabled:shadow-none",
          "data-[invalid=true]:border-danger-300 data-[invalid=true]:focus-visible:ring-danger-500/28",
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
          "flex min-h-24 w-full resize-y rounded-lg border border-white/70 bg-white/76 px-3.5 py-2.5 text-sm text-ink-900",
          "shadow-[0_8px_20px_rgba(19,17,14,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm",
          "placeholder:text-ink-400",
          "transition-[border,box-shadow,background-color] duration-200 ease-out",
          "focus-visible:border-accent-300 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/30 focus-visible:shadow-[0_10px_28px_rgba(91,91,214,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]",
          "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-65 disabled:shadow-none",
          "data-[invalid=true]:border-danger-300 data-[invalid=true]:focus-visible:ring-danger-500/28",
          className
        )}
        {...props}
      />
    );
  }
);