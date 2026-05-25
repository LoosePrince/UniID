"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/ui/primitives";

const EVENT_PRESETS = [
  "record.*",
  "record.created",
  "record.updated",
  "record.deleted",
  "file.uploaded",
  "file.deleted",
  "auth.login",
  "auth.logout"
];

export function CreateWebhookForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["record.*"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, url, events })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      }
      setName("");
      setUrl("");
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="wh-name">名称</Label>
        <Input
          id="wh-name"
          required
          maxLength={64}
          placeholder="my-receiver"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="wh-url">目标 URL</Label>
        <Input
          id="wh-url"
          required
          type="url"
          placeholder="https://example.com/uniid/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div>
        <Label>订阅事件</Label>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_PRESETS.map((ev) => (
            <button
              key={ev}
              type="button"
              onClick={() => toggleEvent(ev)}
              className={
                "px-2 py-1 rounded-sm text-2xs font-mono border " +
                (events.includes(ev)
                  ? "bg-accent-100 border-accent-300 text-accent-900"
                  : "bg-white border-cream-300 text-ink-500 hover:border-cream-400")
              }
            >
              {ev}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !name || !url || events.length === 0}>
        {busy ? "创建中…" : "创建 Webhook"}
      </Button>
    </form>
  );
}

export function WebhookControls({
  appId,
  hookId,
  isActive
}: {
  appId: string;
  hookId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/webhooks/${hookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("确认删除此 Webhook？")) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/webhooks/${hookId}`, {
        method: "DELETE",
        credentials: "include"
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function ping() {
    setBusy(true);
    setPingResult(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/webhooks/${hookId}/ping`, {
        method: "POST",
        credentials: "include"
      });
      const j = (await res.json().catch(() => ({}))) as { status?: number; ok?: boolean };
      setPingResult(j.ok ? `200 OK (status=${j.status})` : `failed (status=${j.status ?? "n/a"})`);
    } catch (err) {
      setPingResult(`error: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => call({ isActive: !isActive })} disabled={busy}>
          {isActive ? "停用" : "启用"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => call({ rotateSecret: true })} disabled={busy}>
          轮换 secret
        </Button>
        <Button size="sm" variant="ghost" onClick={ping} disabled={busy}>
          Ping
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
          删除
        </Button>
      </div>
      {pingResult && <p className="text-2xs text-ink-500">{pingResult}</p>}
    </div>
  );
}
