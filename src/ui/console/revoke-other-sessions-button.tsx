"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast
} from "@/ui/primitives";

interface SessionTarget {
  id: string;
  kind: "user" | "app";
}

export function RevokeOtherSessionsButton({ sessions }: { sessions: SessionTarget[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revokeAll() {
    setError(null);
    startTransition(async () => {
      const failures: string[] = [];
      for (const session of sessions) {
        const url = `/api/v1/auth/sessions?sessionId=${encodeURIComponent(session.id)}&kind=${session.kind}`;
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failures.push(data?.error?.message ?? `${session.id}: ${res.status}`);
        }
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 2).join("；");
        setError(message);
        toast.error("部分会话撤销失败", { description: message });
        return;
      }

      toast.success("其他会话已撤销");
      setOpen(false);
      router.refresh();
    });
  }

  if (sessions.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Trash2 /> 无其他会话
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 /> 撤销其他会话
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>撤销其他会话</DialogTitle>
          <DialogDescription>
            将撤销除当前控制台设备外的 {sessions.length} 个控制台 / SDK 会话。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-ink-600">撤销后对应设备需要重新登录或重新授权。</p>
          {error ? (
            <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>取消</Button>
          <Button variant="danger" onClick={revokeAll} loading={pending} loadingText="撤销中...">
            <Trash2 /> 确认撤销
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}