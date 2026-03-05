import type {
  DetailedHTMLProps,
  InputHTMLAttributes,
  ForwardedRef,
} from "react";
import { forwardRef } from "react";

type NativeInputProps = DetailedHTMLProps<
  InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

interface BaseInputProps extends NativeInputProps {
  className?: string;
}

function mergeClasses(base: string, extra?: string) {
  return `${base} ${extra ?? ""}`.trim();
}

const BaseInput = forwardRef(function BaseInput(
  props: BaseInputProps,
  ref: ForwardedRef<HTMLInputElement>
) {
  const { className, ...rest } = props;

  const base =
    "w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40";

  return <input ref={ref} className={mergeClasses(base, className)} {...rest} />;
});

export const TextInput = forwardRef<HTMLInputElement, BaseInputProps>(
  function TextInput(props, ref) {
    return <BaseInput ref={ref} type={props.type ?? "text"} {...props} />;
  }
);

export const PasswordInput = forwardRef<HTMLInputElement, BaseInputProps>(
  function PasswordInput(props, ref) {
    return <BaseInput ref={ref} type={props.type ?? "password"} {...props} />;
  }
);

