"use client";

import type * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn, toast } from "@/ui/primitives";

export interface LogoutButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export function LogoutButton({
  children = "登出",
  className,
  onClick,
  type = "button",
  ...props
}: LogoutButtonProps) {
  const router = useRouter();
  return (
    <button
      type={type}
      onClick={async (event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        try {
          await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
          toast.success("已登出");
          router.replace("/login");
        } catch {
          toast.error("登出失败");
        }
      }}
      className={cn("flex w-full items-center gap-2 text-left text-danger-600 hover:text-danger-700", className)}
      {...props}
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{children}</span>
    </button>
  );
}
