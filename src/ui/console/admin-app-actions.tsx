"use client";

import { useState, useTransition } from "react";
import { Button } from "@/ui/primitives";

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
    body: JSON.stringify({ appId, status })
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `${res.status}`);
  }
}

export function AppStatusActions({ app }: { app: AppSummary }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSuspend = () => {
    if (!confirm(`暂停应用 ${app.name}？该 App 下所有 SDK 调用都会被拒绝。`)) return;
    setError(null);
    start(async () => {
      try { await setStatus(app.id, "suspended"); location.reload(); }
      catch (err) { setError((err as Error).message); }
    });
  };

  const handleActivate = () => {
    setError(null);
    start(async () => {
      try { await setStatus(app.id, "active"); location.reload(); }
      catch (err) { setError((err as Error).message); }
    });
  };

  const handleArchive = () => {
    if (!confirm(`归档应用 ${app.name}？归档后将隐藏不删除。`)) return;
    setError(null);
    start(async () => {
      try { await setStatus(app.id, "archived"); location.reload(); }
      catch (err) { setError((err as Error).message); }
    });
  };

  return (
    <div className="inline-flex gap-1 items-center">
      {app.status === "active" ? (
        <Button variant="ghost" size="sm" onClick={handleSuspend} disabled={pending}>暂停</Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={handleActivate} disabled={pending}>启用</Button>
      )}
      {app.status !== "archived" && (
        <Button variant="ghost" size="sm" onClick={handleArchive} disabled={pending}>归档</Button>
      )}
      {error && <span className="ml-2 text-xs text-danger-700">{error}</span>}
    </div>
  );
}
