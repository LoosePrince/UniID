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

export function RevokeSessionButton({
  sessionId,
  kind,
  label = "撤销",
  variant = "ghost"
}: {
  sessionId: string;
  kind: "user" | "app";
  label?: string;
  variant?: "ghost" | "danger" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    setError(null);
    startTransition(async () => {
      try {
        const url = `/api/v1/auth/sessions?sessionId=${encodeURIComponent(sessionId)}&kind=${kind}`;
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `撤销失败 (${res.status})`);
        }
        toast.success("会话已撤销");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "撤销失败";
        setError(message);
        toast.error("撤销失败", { description: message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="xs" className={variant === "ghost" ? "text-danger-600 hover:bg-danger-50" : undefined}>
          <Trash2 className="h-3 w-3" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>撤销会话</DialogTitle>
          <DialogDescription>
            撤销后该设备或 SDK 会话需要重新登录授权。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-ink-600">确定撤销该会话吗？该操作会立即生效。</p>
          {error ? (
            <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>取消</Button>
          <Button variant="danger" onClick={revoke} loading={pending} loadingText="撤销中...">
            <Trash2 /> 确认撤销
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}