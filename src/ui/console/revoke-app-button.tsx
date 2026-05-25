"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  toast
} from "@/ui/primitives";

export function RevokeAppButton({
  userId,
  appId,
  appName
}: {
  userId: string;
  appId: string;
  appName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/account/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ app_id: appId, _u: userId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("撤销失败", { description: data?.error?.message });
        setBusy(false);
        return;
      }
      toast.success(`已撤销 ${appName} 的访问`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("网络错误");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" className="text-danger-600 hover:text-danger-700 hover:bg-danger-50">
          <Trash2 className="h-3 w-3" /> 撤销
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>撤销 {appName} 的访问</DialogTitle>
          <DialogDescription>撤销后该应用将立即失去对你账号数据的访问。</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-ink-700">
            此操作会撤销所有 (你 × {appName}) 的会话与刷新令牌。
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>取消</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            <Trash2 /> 确认撤销
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
