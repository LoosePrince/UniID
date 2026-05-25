"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "./spinner";
import { cn } from "./utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium select-none whitespace-nowrap",
    "transition-[background,border,color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50",
    "disabled:pointer-events-none disabled:opacity-55",
    "data-[loading=true]:cursor-wait data-[loading=true]:opacity-85",
    "[&>svg]:size-4 [&>svg]:shrink-0"
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-ink-900 text-cream-50 hover:bg-ink-800 active:bg-ink-950 shadow-xs",
        secondary:
          "bg-cream-100 text-ink-900 hover:bg-cream-200 active:bg-cream-300 border border-ink-100",
        outline:
          "bg-transparent text-ink-900 border border-ink-200 hover:bg-cream-100 active:bg-cream-200",
        ghost:
          "bg-transparent text-ink-700 hover:bg-cream-100 hover:text-ink-900 active:bg-cream-200",
        danger:
          "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 shadow-xs",
        link:
          "bg-transparent text-accent-600 underline-offset-4 hover:underline px-0 h-auto"
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-sm",
        sm: "h-8 px-3 text-sm rounded-sm",
        md: "h-9 px-4 text-sm rounded-md",
        lg: "h-11 px-5 text-md rounded-md",
        icon: "h-9 w-9 rounded-md"
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
