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
import { useI18n } from "@/ui/i18n";

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

function parseEvents(source: string, t: (key: string) => string) {
  const events = source
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (events.length === 0) throw new Error(t("validation.eventsRequired"));
  if (events.length > 20) throw new Error(t("validation.eventsMax"));
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
  const { t } = useI18n();
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("webhooks.created"), { description: name.trim() });
      setName("");
      setUrl("");
      setEvents(["record.*"]);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.createFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field htmlFor="wh-name" label={t("common.name")} required>
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
      <Field htmlFor="wh-url" label={t("webhooks.targetUrl")} required>
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
      <Field label={t("webhooks.subscribeEvents")} required error={error}>
        <EventPresetButtons events={events} onChange={setEvents} disabled={busy} />
      </Field>
      <Button type="submit" loading={busy} loadingText={t("common.creating")} disabled={!name.trim() || !url.trim() || events.length === 0}>
        {t("webhooks.create")}
      </Button>
    </form>
  );
}

export function WebhookControls({ appId, hook }: { appId: string; hook: WebhookSummary }) {
  const { t } = useI18n();
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

  async function patchWebhook(body: Record<string, unknown>, successKey: string) {
    const res = await fetch(`/api/v1/apps/${appId}/webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
    toast.success(t(successKey), { description: hook.name });
    router.refresh();
  }

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      await patchWebhook(
        { isActive: hook.isActive !== 1 },
        hook.isActive === 1 ? "webhooks.paused" : "webhooks.enabled"
      );
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      if (json.ok) toast.success(t("webhooks.pingSuccess"), { description: `HTTP ${json.status}` });
      else toast.warning(t("webhooks.pingWarning"), { description: `HTTP ${json.status ?? "n/a"}` });
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("webhooks.pingFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("edit");
    setError(null);
    try {
      const nextEvents = parseEvents(eventsText, t);
      await patchWebhook(
        {
          name: name.trim(),
          url: url.trim(),
          events: nextEvents
        },
        "webhooks.saved"
      );
      setEditOpen(false);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.saveFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function rotateSecret() {
    setBusy("rotate");
    setError(null);
    try {
      await patchWebhook({ rotateSecret: true }, "webhooks.secretRotated");
      setRotateOpen(false);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("webhooks.rotateFailed"), { description: message });
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("webhooks.deleted"), { description: hook.name });
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.deleteFailed"), { description: message });
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
          {hook.isActive === 1 ? t("common.pause") : t("common.enable")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} disabled={busy !== null}>
          <Pencil /> {t("common.edit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRotateOpen(true)} disabled={busy !== null}>
          <RotateCcw /> {t("webhooks.rotateSecret")}
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy !== null}>
          <Trash2 /> {t("common.delete")}
        </Button>
      </div>
      {error ? <p className="text-xs text-danger-700">{error}</p> : null}

      <Dialog open={editOpen} onOpenChange={(next) => busy !== "edit" && setEditOpen(next)}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>{t("webhooks.editTitle")}</DialogTitle>
              <DialogDescription>{t("webhooks.editDescription")}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`wh-name-${hook.id}`} label={t("common.name")} required>
                <Input id={`wh-name-${hook.id}`} value={name} onChange={(e) => setName(e.target.value)} disabled={busy === "edit"} />
              </Field>
              <Field htmlFor={`wh-url-${hook.id}`} label={t("webhooks.targetUrl")} required>
                <Input id={`wh-url-${hook.id}`} type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy === "edit"} />
              </Field>
              <Field label={t("webhooks.eventPresets")}>
                <EventPresetButtons events={events} onChange={syncPreset} disabled={busy === "edit"} />
              </Field>
              <Field
                htmlFor={`wh-events-${hook.id}`}
                label={t("webhooks.eventList")}
                required
                help={t("webhooks.eventListHelp")}
                error={editOpen ? error : undefined}
              >
                <Textarea
                  id={`wh-events-${hook.id}`}
                  className="min-h-[150px] font-mono text-xs"
                  spellCheck={false}
                  value={eventsText}
                  onChange={(e) => {
                    setEventsText(e.target.value);
                    try {
                      setEvents(parseEvents(e.target.value, t));
                    } catch {}
                  }}
                  disabled={busy === "edit"}
                  invalid={Boolean(error && editOpen)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy === "edit"}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy === "edit"} loadingText={t("common.saving")} disabled={!name.trim() || !url.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={(next) => busy !== "rotate" && setRotateOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("webhooks.rotateTitle")}</DialogTitle>
            <DialogDescription>{t("webhooks.rotateDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-800">
              {t("webhooks.confirmRotate", { name: hook.name })}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRotateOpen(false)} disabled={busy === "rotate"}>
              {t("common.cancel")}
            </Button>
            <Button type="button" loading={busy === "rotate"} loadingText={t("common.rotating")} onClick={rotateSecret}>
              {t("webhooks.rotateSecret")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("webhooks.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("webhooks.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              {t("webhooks.confirmDelete", { name: hook.name })}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" loading={busy === "delete"} loadingText={t("common.deleting")} onClick={remove}>
              {t("common.delete")}
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
  const { t } = useI18n();
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("webhooks.deliveryRetried"), { description: deliveryId });
      router.refresh();
    } catch (err) {
      toast.error(t("webhooks.retryFailed"), { description: String((err as Error).message ?? err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={retry} loading={busy} disabled={!retryable} aria-label={t("common.retry")}>
      <RefreshCw /> {t("common.retry")}
    </Button>
  );
}
