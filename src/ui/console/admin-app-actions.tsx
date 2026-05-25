"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, PauseCircle, PlayCircle } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast
} from "@/ui/primitives";

type AppStatus = "active" | "suspended" | "archived";

interface AppSummary {
  id: string;
  name: string;
  status: AppStatus;
}

async function setStatus(appId: string, status: AppStatus) {
  const res = await fetch("/api/v1/admin/apps/set-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ appId, status })
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `${res.status}`);
  }
}

const statusCopy: Record<AppStatus, { label: string; title: string; description: string }> = {
  active: {
    label: "启用",
    title: "启用应用",
    description: "启用后 SDK 请求和授权流程会恢复可用。"
  },
  suspended: {
    label: "暂停",
    title: "暂停应用",
    description: "暂停后该应用下所有 SDK 调用都会被拒绝，但数据不会删除。"
  },
  archived: {
    label: "归档",
    title: "归档应用",
    description: "归档用于隐藏不活跃应用，不会删除应用数据。"
  }
};

export function AppStatusActions({ app }: { app: AppSummary }) {
  const router = useRouter();
  const [target, setTarget] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(targetStatus: AppStatus) {
    setTarget(targetStatus);
    setError(null);
  }

  function close() {
    if (pending) return;
    setTarget(null);
    setError(null);
  }

  function submit() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      try {
        await setStatus(app.id, target);
        toast.success(`应用已${statusCopy[target].label}`);
        setTarget(null);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";
        setError(message);
        toast.error("操作失败", { description: message });
      }
    });
  }

  const copy = target ? statusCopy[target] : null;

  return (
    <>
      <div className="inline-flex flex-wrap justify-end gap-1">
        {app.status === "active" ? (
          <Button variant="ghost" size="sm" onClick={() => open("suspended")}>
            <PauseCircle /> 暂停
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => open("active")}>
            <PlayCircle /> 启用
          </Button>
        )}
        {app.status !== "archived" ? (
          <Button variant="ghost" size="sm" onClick={() => open("archived")}>
            <Archive /> 归档
          </Button>
        ) : null}
      </div>

      <Dialog open={target !== null} onOpenChange={(value) => (value ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-md border border-ink-100 bg-cream-50 px-3 py-2 text-sm">
              <span className="text-ink-500">目标应用：</span>
              <span className="font-medium text-ink-900">{app.name}</span>
            </div>
            {error ? (
              <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={pending}>取消</Button>
            <Button
              variant={target === "suspended" ? "danger" : "primary"}
              onClick={submit}
              loading={pending}
              loadingText="处理中..."
            >
              确认{copy?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}