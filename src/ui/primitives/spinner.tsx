"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./utils";

export function Spinner({ className, ...props }: React.HTMLAttributes<SVGElement>) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-ink-400", className)} {...props} />;
}
