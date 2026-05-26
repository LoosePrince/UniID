"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "./utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-ink-200/70 bg-cream-50/70 p-1 shadow-[0_8px_18px_rgba(19,17,14,0.055),inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-sm dark:border-slate-600/60 dark:bg-slate-900/50 dark:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)]",
        className
      )}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium text-ink-500 dark:text-slate-400",
        "transition-[background,color,box-shadow,transform] duration-200 ease-out hover:bg-ink-100/50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/30 dark:hover:bg-slate-800/50 dark:hover:text-slate-100",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-white/80 data-[state=active]:text-ink-900 data-[state=active]:shadow-[0_6px_16px_rgba(19,17,14,0.075),inset_0_0_0_1px_rgba(213,210,200,0.75),inset_0_1px_0_rgba(255,255,255,0.72)] dark:data-[state=active]:bg-slate-800/75 dark:data-[state=active]:text-slate-100 dark:data-[state=active]:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_0_0_1px_rgba(129,148,163,0.28),inset_0_1px_0_rgba(255,255,255,0.045)]",
        className
      )}
      {...props}
    />
  );
});

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("pt-4 focus-visible:outline-none", className)} {...props} />;
});