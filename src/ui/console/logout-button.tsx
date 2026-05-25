"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "@/ui/primitives";

export function LogoutButton({ children = "登出" }: { children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
          toast.success("已登出");
          router.replace("/login");
        } catch {
          toast.error("登出失败");
        }
      }}
      className="flex items-center gap-2 text-danger-600 hover:text-danger-700 w-full text-left"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{children}</span>
    </button>
  );
}
