"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "./spinner";
import { cn } from "./utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-transparent",
    "font-medium select-none",
    "transition-[background,border,color,box-shadow,transform,opacity] duration-200 ease-out",
    "hover:-translate-y-0.5 active:translate-y-0",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50",
    "disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none",
    "data-[loading=true]:cursor-wait data-[loading=true]:opacity-90",
    "[&>svg]:size-4 [&>svg]:shrink-0"
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-ink-900 text-cream-50 shadow-[0_16px_34px_rgba(19,17,14,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-800 active:bg-ink-950",
        secondary:
          "border-white/80 bg-white/76 text-ink-900 shadow-[0_12px_28px_rgba(19,17,14,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-sm hover:bg-white hover:shadow-[0_18px_34px_rgba(19,17,14,0.1),inset_0_1px_0_rgba(255,255,255,0.9)]",
        outline:
          "border-ink-200/80 bg-white/30 text-ink-900 shadow-[0_8px_20px_rgba(19,17,14,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm hover:bg-white/78 hover:shadow-[0_16px_30px_rgba(19,17,14,0.08),inset_0_1px_0_rgba(255,255,255,0.86)]",
        ghost:
          "bg-transparent text-ink-700 shadow-none hover:bg-white/72 hover:text-ink-900",
        danger:
          "bg-danger-500 text-white shadow-[0_16px_32px_rgba(197,59,59,0.24),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-danger-600 active:bg-danger-700",
        link:
          "h-auto rounded-none border-transparent bg-transparent px-0 text-accent-600 shadow-none hover:translate-y-0 hover:text-accent-700 hover:underline",
        hero:
          "accent-halo sheen-subtle border border-accent-200/70 bg-[linear-gradient(135deg,#4b4bc4_0%,#5b5bd6_42%,#776fda_100%)] text-white shadow-[0_22px_48px_rgba(61,61,160,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-[linear-gradient(135deg,#4343b4_0%,#5757cf_42%,#7068d7_100%)]"
      },
      size: {
        xs: "h-8 rounded-lg px-3 text-xs",
        sm: "h-9 rounded-lg px-4 text-sm",
        md: "h-10 rounded-xl px-4 text-sm",
        lg: "h-12 rounded-xl px-6 text-md",
        icon: "h-10 w-10 rounded-xl"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      disabled,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        children?: React.ReactNode;
      }>;

      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          data-loading={loading ? "true" : undefined}
          aria-busy={loading || undefined}
          aria-disabled={isDisabled ? true : undefined}
          {...props}
        >
          {React.cloneElement(
            child,
            undefined,
            <>
              {loading && <Spinner className="h-3.5 w-3.5 text-current" aria-hidden="true" />}
              {loading && loadingText ? loadingText : child.props.children}
            </>
          )}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        data-loading={loading ? "true" : undefined}
        aria-busy={loading || undefined}
        disabled={isDisabled}
        type={type}
        {...props}
      >
        {loading && <Spinner className="h-3.5 w-3.5 text-current" aria-hidden="true" />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);

export { buttonVariants };