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
            "!bg-white !border-ink-100 !text-ink-900 !shadow-md !rounded-md !text-sm !p-3",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-ink-500",
          actionButton: "!bg-ink-900 !text-cream-50 !rounded-xs",
          cancelButton: "!bg-cream-100 !text-ink-700 !rounded-xs",
          error: "!border-danger-100 !bg-danger-50 !text-danger-700",
          success: "!border-success-100 !bg-success-50 !text-success-700",
          warning: "!border-warning-100 !bg-warning-50 !text-warning-700"
        }
      }}
    />
  );
}

export { toast };
