"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, toast } from "@/ui/primitives";

export function RevokeSessionButton({
  sessionId,
  kind
}: {
  sessionId: string;
  kind: "user" | "app";
}) {
  const router = useRouter();
  async function onClick() {
    if (!confirm("确认撤销该会话？")) return;
    try {
      const url = `/api/v1/auth/sessions?sessionId=${encodeURIComponent(sessionId)}&kind=${kind}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("撤销失败", { description: data?.error?.message });
        return;
      }
      toast.success("已撤销");
      router.refresh();
    } catch {
      toast.error("网络错误");
    }
  }
  return (
    <Button variant="ghost" size="xs" className="text-danger-600 hover:bg-danger-50" onClick={onClick}>
      <Trash2 className="h-3 w-3" /> 撤销
    </Button>
  );
}
