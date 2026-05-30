"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/ui/i18n";
import { Button } from "./button";
import { cn } from "./utils";

export interface CodeBlockProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  language?: string;
  value: string;
  maxHeight?: string;
}

export function CodeBlock({
  title,
  language = "json",
  value,
  maxHeight = "22rem",
  className,
  ...props
}: CodeBlockProps) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950 text-slate-100 shadow-[0_18px_42px_rgba(0,0,0,0.22)] dark:border-slate-600/70 dark:bg-slate-950",
        className
      )}
      {...props}
    >
      {(title || language) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 bg-slate-900/95 px-3 py-2">
          <div className="min-w-0">
            {title ? <p className="truncate text-xs font-medium text-slate-100">{title}</p> : null}
            {language ? <p className="font-mono text-2xs uppercase tracking-[0.14em] text-slate-400">{language}</p> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 rounded-md px-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            onClick={copy}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
        </div>
      )}
      <pre
        className="overflow-auto p-4 font-mono text-xs leading-6 text-slate-200"
        style={{ maxHeight }}
      >
        <code>{value}</code>
      </pre>
    </div>
  );
}