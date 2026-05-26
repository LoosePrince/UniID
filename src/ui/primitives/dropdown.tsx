"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "./utils";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuPortal = DropdownPrimitive.Portal;
export const DropdownMenuSub = DropdownPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

type MenuTone = "default" | "accent" | "danger";

function menuItemClassName(tone: MenuTone, inset?: boolean) {
  return cn(
    "relative flex min-h-9 cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 dark:text-slate-300",
    "outline-none transition-[background,color,box-shadow,transform] duration-150",
    "focus:bg-ink-100/60 focus:text-ink-900 focus:shadow-[inset_0_0_0_1px_rgba(119,111,218,0.18)] dark:focus:bg-slate-800/60 dark:focus:text-slate-100 dark:focus:shadow-[inset_0_0_0_1px_rgba(129,148,163,0.2)]",
    "data-[highlighted]:bg-ink-100/60 data-[highlighted]:text-ink-900 data-[highlighted]:shadow-[inset_0_0_0_1px_rgba(119,111,218,0.18)] dark:data-[highlighted]:bg-slate-800/60 dark:data-[highlighted]:text-slate-100 dark:data-[highlighted]:shadow-[inset_0_0_0_1px_rgba(129,148,163,0.2)]",
    "data-[state=open]:bg-accent-50/50 data-[state=open]:text-ink-900 data-[state=open]:shadow-[inset_0_0_0_1px_rgba(119,111,218,0.22)] dark:data-[state=open]:bg-slate-800/60 dark:data-[state=open]:text-slate-100 dark:data-[state=open]:shadow-[inset_0_0_0_1px_rgba(129,148,163,0.24)]",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
    "[&>svg]:size-4 [&>svg]:shrink-0",
    tone === "accent" && "text-accent-700 focus:bg-accent-50/60 focus:text-accent-800 data-[highlighted]:bg-accent-50/60 data-[highlighted]:text-accent-800 dark:text-accent-200 dark:focus:bg-accent-900/30 dark:focus:text-accent-100 dark:data-[highlighted]:bg-accent-900/30 dark:data-[highlighted]:text-accent-100",
    tone === "danger" && "text-danger-600 focus:bg-danger-50/60 focus:text-danger-700 data-[highlighted]:bg-danger-50/60 data-[highlighted]:text-danger-700 dark:text-danger-100 dark:focus:bg-danger-700/30 dark:focus:text-danger-50 dark:data-[highlighted]:bg-danger-700/30 dark:data-[highlighted]:text-danger-50",
    inset && "pl-8"
  );
}

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger> & { tone?: MenuTone; inset?: boolean }
>(function DropdownMenuSubTrigger({ className, children, tone = "default", inset, ...props }, ref) {
  return (
    <DropdownPrimitive.SubTrigger
      ref={ref}
      className={cn(menuItemClassName(tone, inset), "pr-2.5", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
    </DropdownPrimitive.SubTrigger>
  );
});

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <DropdownMenuPortal>
      <DropdownPrimitive.SubContent
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "surface-elevated z-50 min-w-40 overflow-hidden rounded-2xl border border-ink-200/70 p-1.5 shadow-lg dark:border-slate-600/60",
          "data-[state=open]:animate-scale-in",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  );
});

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <DropdownMenuPortal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "surface-elevated z-50 min-w-44 overflow-hidden rounded-2xl border border-ink-200/70 p-1.5 shadow-lg dark:border-slate-600/60",
          "data-[state=open]:animate-scale-in",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  );
});

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { inset?: boolean; tone?: MenuTone }
>(function DropdownMenuItem({ className, inset, tone = "default", ...props }, ref) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(menuItemClassName(tone, inset), className)}
      {...props}
    />
  );
});

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem> & { tone?: MenuTone }
>(function DropdownMenuCheckboxItem({ className, children, checked, tone = "default", ...props }, ref) {
  return (
    <DropdownPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(menuItemClassName(tone), "pl-9 pr-3", className)}
      {...props}
    >
      <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem> & { tone?: MenuTone }
>(function DropdownMenuRadioItem({ className, children, tone = "default", ...props }, ref) {
  return (
    <DropdownPrimitive.RadioItem
      ref={ref}
      className={cn(menuItemClassName(tone), "pl-9 pr-3", className)}
      {...props}
    >
      <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <Circle className="h-2.5 w-2.5 fill-current" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.RadioItem>
  );
});

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Label
      ref={ref}
      className={cn("px-3 pb-1.5 pt-2 text-2xs font-medium uppercase tracking-[0.14em] text-ink-400 dark:text-slate-500", className)}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownPrimitive.Separator ref={ref} className={cn("my-1.5 h-px bg-ink-100/90 dark:bg-slate-700/70", className)} {...props} />;
});

export function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto pl-6 font-mono text-2xs tracking-wider text-current opacity-55", className)} {...props} />;
}