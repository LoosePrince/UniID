"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
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
          "group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-white/70 bg-white/76 px-3.5 text-left text-sm text-ink-900",
          "shadow-[0_8px_20px_rgba(19,17,14,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm",
          "transition-[border,box-shadow,background-color,transform] duration-200 ease-out",
          "hover:bg-white hover:shadow-[0_12px_28px_rgba(19,17,14,0.08),inset_0_1px_0_rgba(255,255,255,0.88)]",
          "focus-visible:border-accent-300 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/30 focus-visible:shadow-[0_10px_28px_rgba(91,91,214,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]",
          "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-65 disabled:shadow-none",
          "data-[invalid=true]:border-danger-300 data-[invalid=true]:focus-visible:ring-danger-500/28",
          className
        )}
        {...props}
      >
        {children}
        {showIcon ? (
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
          "surface-elevated z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/70 p-1.5 shadow-lg",
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
      className={cn("px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.14em] text-ink-400", className)}
      {...props}
    />
  );
});

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return <SelectPrimitive.Separator ref={ref} className={cn("my-1 h-px bg-ink-100/90", className)} {...props} />;
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
      placeholder = "请选择",
      required,
      value,
      ...triggerProps
    },
    ref
  ) {
    const nativeOptions = React.useMemo(() => collectOptions(children), [children]);
    const entries = options ?? nativeOptions;
    const hasEntries = Boolean(options) || nativeOptions.length > 0;

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
          <SelectValue placeholder={placeholder} />
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
        "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 pr-9 text-sm font-medium text-ink-700",
        "outline-none transition-[background,color,box-shadow] duration-150",
        "data-[state=checked]:bg-accent-50/70 data-[state=checked]:font-semibold data-[state=checked]:text-ink-900",
        "data-[highlighted]:bg-accent-50 data-[highlighted]:text-ink-900 data-[highlighted]:shadow-[inset_0_0_0_1px_rgba(119,111,218,0.16)]",
        "data-[highlighted]:data-[state=checked]:bg-accent-100 data-[highlighted]:data-[state=checked]:text-ink-900",
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