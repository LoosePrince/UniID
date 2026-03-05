import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  const base =
    "w-full rounded-xl bg-slate-900/60 p-8 shadow-xl shadow-slate-900/40 backdrop-blur";

  return <div className={`${base} ${className ?? ""}`.trim()}>{children}</div>;
}

