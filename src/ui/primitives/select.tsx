"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useI18n } from "@/ui/i18n";
import { cn } from "./utils";

export interface SelectOptionModel {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectOptionGroupModel {
  label: React.ReactNode;
  options: SelectOptionModel[];
}

export type SelectEntry = SelectOptionModel | SelectOptionGroupModel;

type SelectRootProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;
type SelectTriggerBaseProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;

export interface SelectProps
  extends Omit<SelectTriggerBaseProps, "children" | "defaultValue" | "disabled" | "onChange" | "value"> {
  invalid?: boolean;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: React.ReactNode;
  options?: SelectEntry[];
  contentClassName?: string;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  children?: React.ReactNode;
  name?: SelectRootProps["name"];
  required?: SelectRootProps["required"];
  disabled?: SelectRootProps["disabled"];
  open?: SelectRootProps["open"];
  defaultOpen?: SelectRootProps["defaultOpen"];
  onOpenChange?: SelectRootProps["onOpenChange"];
  dir?: SelectRootProps["dir"];
}

export const SelectRoot = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export const SelectViewport = SelectPrimitive.Viewport;

function textFromNode(node: React.ReactNode) {
  return React.Children.toArray(node)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("");
}

function optionValue(value: unknown, fallback: React.ReactNode) {
  if (value === undefined || value === null) return textFromNode(fallback);
  return String(value);
}

function collectOptions(children: React.ReactNode): SelectEntry[] {
  const entries: SelectEntry[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === React.Fragment) {
      entries.push(...collectOptions(child.props.children));
      return;
    }

    if (child.type === "option") {
      const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement> & { children?: React.ReactNode };
      entries.push({
        value: optionValue(props.value, props.children),
        label: props.children,
        disabled: props.disabled
      });
      return;
    }

    if (child.type === "optgroup") {
      const props = child.props as React.OptgroupHTMLAttributes<HTMLOptGroupElement> & { children?: React.ReactNode };
      const options = collectOptions(props.children).filter((entry): entry is SelectOptionModel => !("options" in entry));
      entries.push({ label: props.label, options });
    }
  });

  return entries;
}

function renderEntry(entry: SelectEntry) {
  if ("options" in entry) {
    return (
      <SelectGroup key={String(entry.label)}>
        <SelectLabel>{entry.label}</SelectLabel>
        {entry.options.map((option) => renderEntry(option))}
      </SelectGroup>
    );
  }

  return (
    <SelectItem key={entry.value} value={entry.value} disabled={entry.disabled}>
      {entry.label}
    </SelectItem>
  );
}

export interface SelectTriggerProps extends SelectTriggerBaseProps {
  invalid?: boolean;
  showIcon?: boolean;
}

export const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, SelectTriggerProps>(
  function SelectTrigger({ className, children, invalid, showIcon = true, ...props }, ref) {
    return (
      <SelectPrimitive.Trigger
        ref={ref}
        data-invalid={invalid ? "true" : undefined}
        aria-invalid={invalid || undefined}
        className={cn(
          "group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-ink-200/80 bg-cream-50/70 px-3.5 text-left text-sm text-ink-900 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-100",
          "shadow-[0_8px_18px_rgba(19,17,14,0.045),inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-sm dark:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "transition-[border,box-shadow,background-color,transform] duration-200 ease-out",
          "hover:border-ink-300/80 hover:bg-white/80 dark:hover:border-slate-500/70 dark:hover:bg-slate-800/70",
          "focus-visible:border-accent-400/70 focus-visible:bg-white/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400/30 focus-visible:shadow-[0_0_0_3px_rgba(119,111,218,0.08),0_10px_24px_rgba(19,17,14,0.08)] dark:focus-visible:border-accent-300/40 dark:focus-visible:bg-slate-800/75 dark:focus-visible:ring-accent-300/20 dark:focus-visible:shadow-[0_0_0_3px_rgba(119,111,218,0.10),0_10px_24px_rgba(0,0,0,0.18)]",
          "disabled:cursor-not-allowed disabled:border-ink-100 disabled:bg-cream-100/70 disabled:text-ink-400 disabled:shadow-none dark:disabled:border-slate-700/60 dark:disabled:bg-slate-900/50 dark:disabled:text-slate-500",
          "data-[invalid=true]:border-danger-500/60 data-[invalid=true]:focus-visible:ring-danger-500/30",
          className
        )}
        {...props}
      >
        {children}
        {showIcon ? (
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 group-data-[state=open]:rotate-180 dark:text-slate-500" />
          </SelectPrimitive.Icon>
        ) : null}
      </SelectPrimitive.Trigger>
    );
  }
);

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = "popper", sideOffset = 6, ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "surface-elevated z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-ink-200/70 p-1.5 shadow-lg dark:border-slate-600/60",
          "data-[state=open]:animate-scale-in",
          className
        )}
        {...props}
      >
        <SelectViewport className="space-y-1">{children}</SelectViewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.14em] text-ink-400 dark:text-slate-500", className)}
      {...props}
    />
  );
});

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return <SelectPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-ink-100/90 dark:bg-slate-700/70", className)} {...props} />;
});

export const Select = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, SelectProps>(
  function Select(
    {
      children,
      className,
      contentClassName,
      defaultOpen,
      defaultValue,
      dir,
      disabled,
      invalid,
      name,
      onChange,
      onOpenChange,
      onValueChange,
      open,
      options,
      placeholder,
      required,
      value,
      ...triggerProps
    },
    ref
  ) {
    const { t } = useI18n();
    const nativeOptions = React.useMemo(() => collectOptions(children), [children]);
    const entries = options ?? nativeOptions;
    const hasEntries = Boolean(options) || nativeOptions.length > 0;
    const resolvedPlaceholder = placeholder ?? t("common.selectPlaceholder");

    function handleValueChange(nextValue: string) {
      onValueChange?.(nextValue);
      onChange?.({
        target: { name, value: nextValue },
        currentTarget: { name, value: nextValue }
      } as unknown as React.ChangeEvent<HTMLSelectElement>);
    }

    return (
      <SelectRoot
        value={value === undefined ? undefined : String(value)}
        defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
        disabled={disabled}
        name={name}
        required={required}
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        onValueChange={handleValueChange}
        dir={dir}
      >
        <SelectTrigger ref={ref} invalid={invalid} aria-required={required || undefined} className={className} {...triggerProps}>
          <SelectValue placeholder={resolvedPlaceholder} />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {hasEntries ? entries.map((entry) => renderEntry(entry)) : children}
        </SelectContent>
      </SelectRoot>
    );
  }
);

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 pr-9 text-sm font-medium text-ink-700 dark:text-slate-300",
        "outline-none transition-[background,color,box-shadow] duration-150",
        "data-[state=checked]:bg-accent-50/50 data-[state=checked]:font-semibold data-[state=checked]:text-ink-900 data-[state=checked]:shadow-[inset_0_0_0_1px_rgba(119,111,218,0.22)] dark:data-[state=checked]:bg-slate-800/60 dark:data-[state=checked]:text-slate-100 dark:data-[state=checked]:shadow-[inset_0_0_0_1px_rgba(129,148,163,0.24)]",
        "data-[highlighted]:bg-ink-100/60 data-[highlighted]:text-ink-900 data-[highlighted]:shadow-[inset_0_0_0_1px_rgba(119,111,218,0.18)] dark:data-[highlighted]:bg-slate-800/60 dark:data-[highlighted]:text-slate-100 dark:data-[highlighted]:shadow-[inset_0_0_0_1px_rgba(129,148,163,0.2)]",
        "data-[highlighted]:data-[state=checked]:bg-accent-50/60 data-[highlighted]:data-[state=checked]:text-ink-900 dark:data-[highlighted]:data-[state=checked]:bg-slate-800/70 dark:data-[highlighted]:data-[state=checked]:text-slate-100",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        "[&>svg]:size-4 [&>svg]:shrink-0",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 flex h-4 w-4 items-center justify-center text-current">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
});