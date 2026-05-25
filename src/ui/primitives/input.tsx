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
          "flex h-9 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900",
          "placeholder:text-ink-400",
          "transition-[border,box-shadow] duration-150 ease-out",
          "focus-visible:outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-400/30",
          "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-60",
          "data-[invalid=true]:border-danger-500 data-[invalid=true]:focus-visible:ring-danger-500/30",
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
          "flex min-h-20 w-full resize-y rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900",
          "placeholder:text-ink-400",
          "transition-[border,box-shadow] duration-150 ease-out",
          "focus-visible:outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-400/30",
          "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-60",
          "data-[invalid=true]:border-danger-500 data-[invalid=true]:focus-visible:ring-danger-500/30",
          className
        )}
        {...props}
      />
    );
  }
);
