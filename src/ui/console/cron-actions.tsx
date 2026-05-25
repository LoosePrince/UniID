"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/ui/primitives";

interface FnOption {
  id: string;
  name: string;
}

export function CreateCronForm({ appId, fns }: { appId: string; fns: FnOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cronExpr, setCronExpr] = useState("*/5 * * * *");
  const [fnId, setFnId] = useState<string>(fns[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/cron`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, cronExpr, fnId })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      }
      setName("");
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  if (fns.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        请先在「函数」页面创建并部署函数，才能为它建立定时任务。
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="cron-name">名称</Label>
        <Input
          id="cron-name"
          required
          maxLength={64}
          placeholder="daily-cleanup"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="cron-expr">表达式</Label>
        <Input
          id="cron-expr"
          required
          placeholder="*/5 * * * *"
          value={cronExpr}
          onChange={(e) => setCronExpr(e.target.value)}
        />
        <p className="mt-1 text-2xs text-ink-400">
          5 字段标准 cron：分 时 日 月 周。
        </p>
      </div>
      <div>
        <Label htmlFor="cron-fn">函数</Label>
        <select
          id="cron-fn"
          className="w-full h-9 rounded-sm border border-cream-300 bg-white px-2 text-sm"
          value={fnId}
          onChange={(e) => setFnId(e.target.value)}
        >
          {fns.map((fn) => (
            <option key={fn.id} value={fn.id}>
              {fn.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !name || !fnId}>
        {busy ? "创建中…" : "创建任务"}
      </Button>
    </form>
  );
}

export function CronJobControls({
  appId,
  jobId,
  isActive
}: {
  appId: string;
  jobId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/cron/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !isActive })
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("确认删除此定时任务？")) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/cron/${jobId}`, {
        method: "DELETE",
        credentials: "include"
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="ghost" onClick={toggle} disabled={busy}>
        {isActive ? "停用" : "启用"}
      </Button>
      <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
        删除
      </Button>
    </div>
  );
}
