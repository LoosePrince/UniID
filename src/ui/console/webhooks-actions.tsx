"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, RefreshCw, RotateCcw, Send, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  toast
} from "@/ui/primitives";

const EVENT_PRESETS = [
  "record.*",
  "record.created",
  "record.updated",
  "record.deleted",
  "file.uploaded",
  "file.deleted",
  "auth.login",
  "auth.logout",
  "authorization.granted",
  "authorization.revoked",
  "schema.activated"
];

interface ApiErrorResponse {
  error?: { message?: string; details?: unknown };
}

interface PingResponse extends ApiErrorResponse {
  status?: number;
  ok?: boolean;
}

export interface WebhookSummary {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: number;
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

function parseEvents(source: string) {
  const events = source
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (events.length === 0) throw new Error("至少选择或输入一个事件。");
  if (events.length > 20) throw new Error("事件数量不能超过 20 个。");
  return Array.from(new Set(events));
}

function eventsToText(events: string[]) {
  return events.join("\n");
}

function EventPresetButtons({
  events,
  onChange,
  disabled
}: {
  events: string[];
  onChange: (events: string[]) => void;
  disabled?: boolean;
}) {
  function toggleEvent(ev: string) {
    onChange(events.includes(ev) ? events.filter((item) => item !== ev) : [...events, ev]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_PRESETS.map((ev) => {
        const active = events.includes(ev);
        return (
          <button
            key={ev}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggleEvent(ev)}
            className={
              "rounded-sm border px-2 py-1 font-mono text-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
              (active
                ? "border-accent-300 bg-accent-100 text-accent-900"
                : "border-ink-200 bg-white text-ink-500 hover:border-ink-300")
            }
          >
            {ev}
          </button>
        );
      })}
    </div>
  );
}

export function CreateWebhookForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>(["record.*"]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), url: url.trim(), events })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("Webhook 已创建", { description: name.trim() });
      setName("");
      setUrl("");
      setEvents(["record.*"]);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("创建失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field htmlFor="wh-name" label="名称" required>
        <Input
          id="wh-name"
          required
          maxLength={64}
          placeholder="my-receiver"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="wh-url" label="目标 URL" required>
        <Input
          id="wh-url"
          required
          type="url"
          placeholder="https://example.com/uniid/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field label="订阅事件" required error={error}>
        <EventPresetButtons events={events} onChange={setEvents} disabled={busy} />
      </Field>
      <Button type="submit" loading={busy} loadingText="创建中…" disabled={!name.trim() || !url.trim() || events.length === 0}>
        创建 Webhook
      </Button>
    </form>
  );
}

export function WebhookControls({ appId, hook }: { appId: string; hook: WebhookSummary }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [rotateOpen, setRotateOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"toggle" | "ping" | "edit" | "rotate" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(hook.name);
  const [url, setUrl] = React.useState(hook.url);
  const [eventsText, setEventsText] = React.useState(eventsToText(hook.events));
  const [events, setEvents] = React.useState<string[]>(hook.events);

  React.useEffect(() => {
    setName(hook.name);
    setUrl(hook.url);
    setEventsText(eventsToText(hook.events));
    setEvents(hook.events);
  }, [hook.events, hook.name, hook.url]);

  async function patchWebhook(body: Record<string, unknown>, successTitle: string) {
    const res = await fetch(`/api/v1/apps/${appId}/webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
    toast.success(successTitle, { description: hook.name });
    router.refresh();
  }

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      await patchWebhook({ isActive: hook.isActive !== 1 }, hook.isActive === 1 ? "Webhook 已暂停" : "Webhook 已启用");
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("操作失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function ping() {
    setBusy("ping");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/webhooks/${hook.id}/ping`, {
        method: "POST",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as PingResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      if (json.ok) toast.success("Ping 成功", { description: `HTTP ${json.status}` });
      else toast.warning("Ping 已发送但目标返回非 2xx", { description: `HTTP ${json.status ?? "n/a"}` });
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("Ping 失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("edit");
    setError(null);
    try {
      const nextEvents = parseEvents(eventsText);
      await patchWebhook(
        {
          name: name.trim(),
          url: url.trim(),
          events: nextEvents
        },
        "Webhook 已保存"
      );
      setEditOpen(false);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function rotateSecret() {
    setBusy("rotate");
    setError(null);
    try {
      await patchWebhook({ rotateSecret: true }, "Secret 已轮换");
      setRotateOpen(false);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("轮换失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/webhooks/${hook.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("Webhook 已删除", { description: hook.name });
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("删除失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  function syncPreset(nextEvents: string[]) {
    setEvents(nextEvents);
    setEventsText(eventsToText(nextEvents));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={ping} loading={busy === "ping"}>
          <Send /> Ping
        </Button>
        <Button size="sm" variant="ghost" onClick={toggle} loading={busy === "toggle"}>
          {hook.isActive === 1 ? "暂停" : "启用"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} disabled={busy !== null}>
          <Pencil /> 编辑
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRotateOpen(true)} disabled={busy !== null}>
          <RotateCcw /> 轮换 secret
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy !== null}>
          <Trash2 /> 删除
        </Button>
      </div>
      {error ? <p className="text-xs text-danger-700">{error}</p> : null}

      <Dialog open={editOpen} onOpenChange={(next) => busy !== "edit" && setEditOpen(next)}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>编辑 Webhook</DialogTitle>
              <DialogDescription>目标会收到 UniID 签名头：X-UniID-Event、X-UniID-Timestamp、X-UniID-Signature。</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`wh-name-${hook.id}`} label="名称" required>
                <Input id={`wh-name-${hook.id}`} value={name} onChange={(e) => setName(e.target.value)} disabled={busy === "edit"} />
              </Field>
              <Field htmlFor={`wh-url-${hook.id}`} label="目标 URL" required>
                <Input id={`wh-url-${hook.id}`} type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy === "edit"} />
              </Field>
              <Field label="事件快捷选择">
                <EventPresetButtons events={events} onChange={syncPreset} disabled={busy === "edit"} />
              </Field>
              <Field htmlFor={`wh-events-${hook.id}`} label="事件列表" required help="每行一个事件，也可用逗号分隔。" error={editOpen ? error : undefined}>
                <Textarea
                  id={`wh-events-${hook.id}`}
                  className="min-h-[150px] font-mono text-xs"
                  spellCheck={false}
                  value={eventsText}
                  onChange={(e) => {
                    setEventsText(e.target.value);
                    try {
                      setEvents(parseEvents(e.target.value));
                    } catch {}
                  }}
                  disabled={busy === "edit"}
                  invalid={Boolean(error && editOpen)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy === "edit"}>
                取消
              </Button>
              <Button type="submit" loading={busy === "edit"} loadingText="保存中…" disabled={!name.trim() || !url.trim()}>
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={(next) => busy !== "rotate" && setRotateOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>轮换 Webhook secret</DialogTitle>
            <DialogDescription>轮换后旧 secret 会立即失效，目标服务需要同步更新验签配置。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-800">
              确认轮换 <span className="font-mono">{hook.name}</span> 的 secret？
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRotateOpen(false)} disabled={busy === "rotate"}>
              取消
            </Button>
            <Button type="button" loading={busy === "rotate"} loadingText="轮换中…" onClick={rotateSecret}>
              确认轮换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 Webhook</DialogTitle>
            <DialogDescription>删除后不会再接收新投递，历史投递记录会随关联关系清理。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              确认删除 Webhook <span className="font-mono">{hook.name}</span>？
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>
              取消
            </Button>
            <Button type="button" variant="danger" loading={busy === "delete"} loadingText="删除中…" onClick={remove}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DeliveryRetryButton({
  appId,
  hookId,
  deliveryId,
  status
}: {
  appId: string;
  hookId: string;
  deliveryId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const retryable = status === "failed" || status === "dlq";

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/webhooks/${hookId}/deliveries/${deliveryId}/retry`, {
        method: "POST",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("投递已重新入队", { description: deliveryId });
      router.refresh();
    } catch (err) {
      toast.error("重试失败", { description: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={retry} loading={busy} disabled={!retryable} aria-label="重试投递">
      <RefreshCw /> 重试
    </Button>
  );
}