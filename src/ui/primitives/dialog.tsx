"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "./utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-[10px]",
        "data-[state=open]:animate-fade-in data-[state=closed]:opacity-0",
        className
      )}
      {...props}
    />
  );
});

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "surface-elevated supports-blur-fallback fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-200/70 shadow-lg dark:border-slate-600/60",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          className
        )}
        {...props}
      >
        {children}
        <div data-dialog-close-wrapper className="absolute right-4 top-4 z-10">
          <DialogPrimitive.Close
            data-dialog-close
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-[background,color,box-shadow] hover:bg-ink-100/60 hover:text-ink-900 focus:outline-none focus:ring-1 focus:ring-accent-300/30 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 border-b border-ink-200/60 p-5 dark:border-slate-700/60", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-ink-200/60 p-5 sm:flex-row sm:justify-end dark:border-slate-700/60",
        className
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-lg font-semibold text-ink-900 leading-snug dark:text-slate-100", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm leading-6 text-ink-500 dark:text-slate-400", className)}
      {...props}
    />
  );
});

export const DialogBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function DialogBody({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-5", className)} {...props} />;
  }
);