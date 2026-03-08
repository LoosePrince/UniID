import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

export const primaryButtonClasses =
  "flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClasses =
  "inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

type NativeButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

interface BaseButtonProps extends NativeButtonProps {
  className?: string;
}

function mergeClasses(base: string, extra?: string) {
  return `${base} ${extra ?? ""}`.trim();
}

export function PrimaryButton(props: BaseButtonProps) {
  const { className, children, type, ...rest } = props;

  return (
    <button
      type={type ?? "button"}
      className={mergeClasses(primaryButtonClasses, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton(props: BaseButtonProps) {
  const { className, children, type, ...rest } = props;

  return (
    <button
      type={type ?? "button"}
      className={mergeClasses(secondaryButtonClasses, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

