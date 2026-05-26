"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      gap={8}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-ink-200 !bg-white !p-3 !text-sm !text-ink-900 !shadow-[0_12px_28px_rgba(19,17,14,0.14)] dark:!border-slate-600 dark:!bg-slate-900 dark:!text-slate-100 dark:!shadow-[0_14px_32px_rgba(0,0,0,0.28)]",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-ink-500 dark:!text-slate-400",
          actionButton: "!bg-ink-900 !text-cream-50 !rounded-xs dark:!bg-slate-100 dark:!text-slate-950",
          cancelButton: "!bg-cream-100 !text-ink-700 !rounded-xs dark:!bg-slate-800 dark:!text-slate-200",
          error: "!border-danger-100 !bg-danger-50 !text-danger-700 dark:!border-danger-500/40 dark:!bg-danger-700 dark:!text-danger-50",
          success: "!border-success-100 !bg-success-50 !text-success-700 dark:!border-success-500/40 dark:!bg-success-700 dark:!text-success-50",
          warning: "!border-warning-100 !bg-warning-50 !text-warning-700 dark:!border-warning-500/40 dark:!bg-warning-700 dark:!text-warning-50"
        }
      }}
    />
  );
}

export { toast };
