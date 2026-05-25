"use client";

import * as React from "react";
import { cn } from "./utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-cream-200", className)}
      {...props}
    />
  );
}
