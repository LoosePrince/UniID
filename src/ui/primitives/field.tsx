"use client";

import * as React from "react";
import { cn } from "./utils";

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  htmlFor?: string;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

export function Field({
  children,
  className,
  label,
  htmlFor,
  help,
  error,
  required,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium leading-none text-ink-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-1 text-danger-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs leading-5 text-danger-700 dark:text-danger-100" role="alert">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs leading-5 text-ink-500 dark:text-slate-400">{help}</p>
      ) : null}
    </div>
  );
}