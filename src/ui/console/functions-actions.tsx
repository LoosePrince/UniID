"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellRing, Code2, Pencil, Play, Settings2, Trash2, UploadCloud } from "lucide-react";
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
  Select,
  Textarea,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface ApiErrorResponse {
  error?: { message?: string; details?: unknown };
}

interface FunctionActionResponse extends ApiErrorResponse {
  invocationId?: string;
  status?: string;
  durationMs?: number;
  output?: unknown;
  logs?: string[];
}

export interface FunctionSummary {
  id: string;
  name: string;
  description: string | null;
  isActive: number;
  memoryMb: number;
  timeoutMs: number;
  activeDeploymentId: string | null;
}

export interface FunctionEventTriggerSummary {
  id: string;
  name: string;
  fnId: string;
  events: string[];
  filterJson: string | null;
  isActive: number;
  fn: {
    id: string;
    name: string;
    isActive: number;
    activeDeploymentId: string | null;
  };
}

interface FnOption {
  id: string;
  name: string;
  activeDeploymentId?: string | null;
  isActive?: number;
}

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

const SAMPLE_SOURCE = `async function handler(input, uniid) {
  uniid.log?.("invoked with", input);
  return { ok: true, echoed: input };
}
`;

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

function parseJsonObject(
  source: string,
  emptyValue: Record<string, unknown> | undefined,
  t: (key: string, values?: Record<string, string>) => string
) {
  const trimmed = source.trim();
  if (!trimmed) return emptyValue;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(t("common.jsonInvalid"));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("common.jsonMustBeObject"));
  }
  return parsed as Record<string, unknown>;
}

function formatResult(result: FunctionActionResponse) {
  return JSON.stringify(
    {
      invocationId: result.invocationId,
      status: result.status,
      durationMs: result.durationMs,
      output: result.output,
      logs: result.logs
    },
    null,
    2
  );
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

function filterToText(filterJson: string | null) {
  if (!filterJson) return "";
  try {
    return JSON.stringify(JSON.parse(filterJson), null, 2);
  } catch {
    return filterJson;
  }
}

function fnLabel(fns: FnOption[], fnId: string) {
  return fns.find((fn) => fn.id === fnId)?.name ?? fnId;
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
  function toggleEvent(event: string) {
    onChange(events.includes(event) ? events.filter((item) => item !== event) : [...events, event]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_PRESETS.map((event) => {
        const active = events.includes(event);
        return (
          <button
            key={event}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggleEvent(event)}
            className={
              "rounded-sm border px-2 py-1 font-mono text-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
              (active
                ? "border-accent-300 bg-accent-100 text-accent-900 dark:border-accent-300/50 dark:bg-accent-900/40 dark:text-accent-100"
                : "border-ink-200 bg-white text-ink-500 hover:border-ink-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300")
            }
          >
            {event}
          </button>
        );
      })}
    </div>
  );
}

export function CreateFunctionForm({ appId }: { appId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [memoryMb, setMemoryMb] = React.useState("64");
  const [timeoutMs, setTimeoutMs] = React.useState("5000");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/functions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          memoryMb: Number(memoryMb),
          timeoutMs: Number(timeoutMs)
        })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      toast.success(t("functions.created"), { description: name.trim() });
      setName("");
      setDescription("");
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
      <Field htmlFor="fn-name" label={t("functions.name")} required help={t("functions.nameHelp")}>
        <Input
          id="fn-name"
          required
          pattern="[a-zA-Z0-9_\-]+"
          maxLength={64}
          placeholder="send-welcome-email"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="fn-desc" label={t("common.description")}>
        <Input
          id="fn-desc"
          maxLength={500}
          placeholder={t("functions.descPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="fn-memory" label={t("functions.memoryMb")}>
          <Input
            id="fn-memory"
            type="number"
            min={16}
            max={512}
            value={memoryMb}
            onChange={(e) => setMemoryMb(e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field htmlFor="fn-timeout" label={t("functions.timeoutMs")}>
          <Input
            id="fn-timeout"
            type="number"
            min={100}
            max={60000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
            disabled={busy}
          />
        </Field>
      </div>
      {error ? (
        <p className="text-xs leading-5 text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} loadingText={t("common.creating")} disabled={name.trim() === ""}>
        {t("functions.create")}
      </Button>
    </form>
  );
}

export function CreateEventTriggerForm({ appId, fns }: { appId: string; fns: FnOption[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [fnId, setFnId] = React.useState<string>(fns[0]?.id ?? "");
  const [events, setEvents] = React.useState<string[]>(["record.*"]);
  const [eventsText, setEventsText] = React.useState(eventsToText(["record.*"]));
  const [filterJson, setFilterJson] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!fnId && fns[0]) setFnId(fns[0].id);
  }, [fnId, fns]);

  function syncEvents(nextEvents: string[]) {
    setEvents(nextEvents);
    setEventsText(eventsToText(nextEvents));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const parsedEvents = parseEvents(eventsText, t);
      const filter = parseJsonObject(filterJson, undefined, t);
      const res = await fetch(`/api/v1/apps/${appId}/functions/triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          fnId,
          events: parsedEvents,
          filter,
          isActive: true
        })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      toast.success(t("functions.triggerCreated"), { description: name.trim() });
      setName("");
      setFilterJson("");
      setEvents(["record.*"]);
      setEventsText(eventsToText(["record.*"]));
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.createFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  if (fns.length === 0) {
    return <p className="text-sm text-ink-500">{t("functions.noFunctionsForTriggers")}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field htmlFor="trigger-name" label={t("common.name")} required>
        <Input
          id="trigger-name"
          required
          maxLength={64}
          placeholder="on-record-change"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="trigger-fn" label={t("common.function")} required>
        <Select
          id="trigger-fn"
          value={fnId}
          onValueChange={setFnId}
          disabled={busy}
          options={fns.map((fn) => ({ value: fn.id, label: fn.name }))}
        />
      </Field>
      <Field label={t("functions.eventPresets")}>
        <EventPresetButtons events={events} onChange={syncEvents} disabled={busy} />
      </Field>
      <Field htmlFor="trigger-events" label={t("functions.eventList")} required help={t("functions.eventListHelp")}>
        <Textarea
          id="trigger-events"
          className="min-h-[120px] font-mono text-xs"
          spellCheck={false}
          value={eventsText}
          onChange={(e) => {
            setEventsText(e.target.value);
            try {
              setEvents(parseEvents(e.target.value, t));
            } catch {}
          }}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="trigger-filter" label={t("functions.triggerFilterJson")} help={t("functions.triggerFilterHelp")} error={error}>
        <Textarea
          id="trigger-filter"
          className="min-h-[120px] font-mono text-xs"
          spellCheck={false}
          placeholder={'{\n  "dataType": "post"\n}'}
          value={filterJson}
          onChange={(e) => setFilterJson(e.target.value)}
          disabled={busy}
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" loading={busy} loadingText={t("common.creating")} disabled={!name.trim() || !fnId}>
        <BellRing /> {t("functions.createTrigger")}
      </Button>
    </form>
  );
}

export function EventTriggerControls({
  appId,
  trigger,
  fns
}: {
  appId: string;
  trigger: FunctionEventTriggerSummary;
  fns: FnOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"toggle" | "edit" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(trigger.name);
  const [fnId, setFnId] = React.useState(trigger.fnId);
  const [events, setEvents] = React.useState<string[]>(trigger.events);
  const [eventsText, setEventsText] = React.useState(eventsToText(trigger.events));
  const [filterJson, setFilterJson] = React.useState(filterToText(trigger.filterJson));
  const [isActive, setIsActive] = React.useState(trigger.isActive === 1 ? "true" : "false");

  React.useEffect(() => {
    setName(trigger.name);
    setFnId(trigger.fnId);
    setEvents(trigger.events);
    setEventsText(eventsToText(trigger.events));
    setFilterJson(filterToText(trigger.filterJson));
    setIsActive(trigger.isActive === 1 ? "true" : "false");
  }, [trigger.events, trigger.filterJson, trigger.fnId, trigger.isActive, trigger.name]);

  function syncEvents(nextEvents: string[]) {
    setEvents(nextEvents);
    setEventsText(eventsToText(nextEvents));
  }

  async function patchTrigger(body: Record<string, unknown>, successTitle: string) {
    const res = await fetch(`/api/v1/apps/${appId}/functions/triggers/${trigger.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
    toast.success(successTitle, { description: trigger.name });
    router.refresh();
  }

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      await patchTrigger(
        { isActive: trigger.isActive !== 1 },
        trigger.isActive === 1 ? t("functions.triggerDisabled") : t("functions.triggerEnabled")
      );
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("edit");
    setError(null);
    try {
      await patchTrigger(
        {
          name: name.trim(),
          fnId,
          events: parseEvents(eventsText, t),
          filter: parseJsonObject(filterJson, undefined, t) ?? null,
          isActive: isActive === "true"
        },
        t("functions.triggerSaved")
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

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/functions/triggers/${trigger.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      toast.success(t("functions.triggerDeleted"), { description: trigger.name });
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={toggle} loading={busy === "toggle"}>
          {trigger.isActive === 1 ? t("common.pause") : t("common.enable")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} disabled={busy !== null}>
          <Pencil /> {t("common.edit")}
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
              <DialogTitle>{t("functions.editTriggerTitle")}</DialogTitle>
              <DialogDescription>{t("functions.editTriggerDescription")}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`trigger-name-${trigger.id}`} label={t("common.name")} required>
                <Input
                  id={`trigger-name-${trigger.id}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy === "edit"}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field htmlFor={`trigger-fn-${trigger.id}`} label={t("common.function")} required>
                  <Select
                    id={`trigger-fn-${trigger.id}`}
                    value={fnId}
                    onValueChange={setFnId}
                    disabled={busy === "edit"}
                    options={fns.map((fn) => ({ value: fn.id, label: fn.name }))}
                  />
                </Field>
                <Field htmlFor={`trigger-active-${trigger.id}`} label={t("common.status")}>
                  <Select
                    id={`trigger-active-${trigger.id}`}
                    value={isActive}
                    onValueChange={setIsActive}
                    disabled={busy === "edit"}
                    options={[
                      { value: "true", label: t("common.active") },
                      { value: "false", label: t("common.paused") }
                    ]}
                  />
                </Field>
              </div>
              <Field label={t("functions.eventPresets")}>
                <EventPresetButtons events={events} onChange={syncEvents} disabled={busy === "edit"} />
              </Field>
              <Field
                htmlFor={`trigger-events-${trigger.id}`}
                label={t("functions.eventList")}
                required
                help={t("functions.eventListHelp")}
              >
                <Textarea
                  id={`trigger-events-${trigger.id}`}
                  className="min-h-[130px] font-mono text-xs"
                  spellCheck={false}
                  value={eventsText}
                  onChange={(e) => {
                    setEventsText(e.target.value);
                    try {
                      setEvents(parseEvents(e.target.value, t));
                    } catch {}
                  }}
                  disabled={busy === "edit"}
                />
              </Field>
              <Field
                htmlFor={`trigger-filter-${trigger.id}`}
                label={t("functions.triggerFilterJson")}
                help={t("functions.triggerFilterHelp")}
                error={editOpen ? error : undefined}
              >
                <Textarea
                  id={`trigger-filter-${trigger.id}`}
                  className="min-h-[140px] font-mono text-xs"
                  spellCheck={false}
                  value={filterJson}
                  onChange={(e) => setFilterJson(e.target.value)}
                  disabled={busy === "edit"}
                  invalid={Boolean(error && editOpen)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy === "edit"}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy === "edit"} loadingText={t("common.saving")} disabled={!name.trim() || !fnId}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("functions.deleteTriggerTitle")}</DialogTitle>
            <DialogDescription>{t("functions.deleteTriggerDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              {t("functions.confirmDeleteTrigger", { name: trigger.name })}
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

export function TriggerFunctionName({ fns, fnId }: { fns: FnOption[]; fnId: string }) {
  return <span className="font-mono">{fnLabel(fns, fnId)}</span>;
}

export function DeployButton({ appId, fnId, fnName }: { appId: string; fnId: string; fnName?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState(SAMPLE_SOURCE);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onDeploy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/functions/${fnId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceCode: source })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      toast.success(t("functions.deployed"), { description: fnName ?? fnId });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.deployFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UploadCloud /> {t("common.deploy")}
      </Button>
      <DialogContent className="max-w-3xl">
        <form onSubmit={onDeploy}>
          <DialogHeader>
            <DialogTitle>{t("functions.deployTitle")}</DialogTitle>
            <DialogDescription>{t("functions.deployDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field htmlFor={`src-${fnId}`} label={t("common.sourceCode")} required error={error}>
              <Textarea
                id={`src-${fnId}`}
                className="min-h-[420px] font-mono text-xs"
                spellCheck={false}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={busy}
                invalid={Boolean(error)}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy} loadingText={t("common.deploying")} disabled={source.trim() === ""}>
              {t("functions.deployVersion")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FunctionRowActions({ appId, fn }: { appId: string; fn: FunctionSummary }) {
  const { t } = useI18n();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [invokeOpen, setInvokeOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"settings" | "toggle" | "invoke" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState(fn.description ?? "");
  const [memoryMb, setMemoryMb] = React.useState(String(fn.memoryMb));
  const [timeoutMs, setTimeoutMs] = React.useState(String(fn.timeoutMs));
  const [isActive, setIsActive] = React.useState(fn.isActive === 1 ? "true" : "false");
  const [envJson, setEnvJson] = React.useState("");
  const [payload, setPayload] = React.useState("{\n  \n}");
  const [result, setResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDescription(fn.description ?? "");
    setMemoryMb(String(fn.memoryMb));
    setTimeoutMs(String(fn.timeoutMs));
    setIsActive(fn.isActive === 1 ? "true" : "false");
  }, [fn.description, fn.isActive, fn.memoryMb, fn.timeoutMs]);

  async function patchFunction(body: Record<string, unknown>, successTitle: string) {
    const res = await fetch(`/api/v1/apps/${appId}/functions/${fn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
    toast.success(successTitle, { description: fn.name });
    router.refresh();
  }

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("settings");
    setError(null);
    try {
      const body: Record<string, unknown> = {
        description,
        isActive: isActive === "true",
        memoryMb: Number(memoryMb),
        timeoutMs: Number(timeoutMs)
      };
      if (envJson.trim()) body.env = parseJsonObject(envJson, undefined, t);
      await patchFunction(body, t("functions.settingsSaved"));
      setSettingsOpen(false);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.saveFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive() {
    setBusy("toggle");
    setError(null);
    try {
      await patchFunction({ isActive: fn.isActive !== 1 }, fn.isActive === 1 ? t("functions.disabled") : t("functions.enabled"));
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function invokeFunction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("invoke");
    setError(null);
    setResult(null);
    try {
      const parsedPayload = parseJsonObject(payload, {}, t);
      const res = await fetch(`/api/v1/apps/${appId}/functions/${fn.id}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload: parsedPayload })
      });
      const json = (await res.json().catch(() => ({}))) as FunctionActionResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      setResult(formatResult(json));
      toast.success(t("functions.invokeDone"), { description: json.status ?? json.invocationId });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.invokeFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function deleteFunction() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/functions/${fn.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      toast.success(t("functions.deleted"), { description: fn.name });
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        <DeployButton appId={appId} fnId={fn.id} fnName={fn.name} />
        <Button size="sm" variant="ghost" onClick={() => setInvokeOpen(true)} disabled={!fn.activeDeploymentId || busy !== null}>
          <Play /> {t("common.test")}
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleActive} loading={busy === "toggle"}>
          {fn.isActive === 1 ? t("common.disable") : t("common.enable")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} disabled={busy !== null}>
          <Settings2 /> {t("functions.settingsTitle")}
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy !== null}>
          <Trash2 /> {t("common.delete")}
        </Button>
      </div>
      {error ? <p className="text-right text-xs text-danger-700">{error}</p> : null}

      <Dialog open={settingsOpen} onOpenChange={(next) => busy !== "settings" && setSettingsOpen(next)}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={saveSettings}>
            <DialogHeader>
              <DialogTitle>{t("functions.settingsTitle")}</DialogTitle>
              <DialogDescription className="font-mono">{fn.name}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`fn-desc-${fn.id}`} label={t("common.description")}>
                <Input
                  id={`fn-desc-${fn.id}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy === "settings"}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field htmlFor={`fn-active-${fn.id}`} label={t("common.status")}>
                  <Select
                    id={`fn-active-${fn.id}`}
                    value={isActive}
                    onValueChange={setIsActive}
                    disabled={busy === "settings"}
                    options={[
                      { value: "true", label: t("common.active") },
                      { value: "false", label: t("common.disabled") }
                    ]}
                  />
                </Field>
                <Field htmlFor={`fn-memory-${fn.id}`} label={t("functions.memoryMb")}>
                  <Input
                    id={`fn-memory-${fn.id}`}
                    type="number"
                    min={16}
                    max={512}
                    value={memoryMb}
                    onChange={(e) => setMemoryMb(e.target.value)}
                    disabled={busy === "settings"}
                  />
                </Field>
                <Field htmlFor={`fn-timeout-${fn.id}`} label={t("functions.timeoutMs")}>
                  <Input
                    id={`fn-timeout-${fn.id}`}
                    type="number"
                    min={100}
                    max={60000}
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(e.target.value)}
                    disabled={busy === "settings"}
                  />
                </Field>
              </div>
              <Field
                htmlFor={`fn-env-${fn.id}`}
                label={t("functions.envJson")}
                help={t("functions.envHelp")}
                error={settingsOpen && busy === null ? error : undefined}
              >
                <Textarea
                  id={`fn-env-${fn.id}`}
                  className="min-h-[120px] font-mono text-xs"
                  spellCheck={false}
                  placeholder={t("functions.envPlaceholder")}
                  value={envJson}
                  onChange={(e) => setEnvJson(e.target.value)}
                  disabled={busy === "settings"}
                  invalid={Boolean(error && settingsOpen)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)} disabled={busy === "settings"}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy === "settings"} loadingText={t("common.saving")}>
                {t("functions.saveSettings")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={invokeOpen} onOpenChange={(next) => busy !== "invoke" && setInvokeOpen(next)}>
        <DialogContent className="max-w-3xl">
          <form onSubmit={invokeFunction}>
            <DialogHeader>
              <DialogTitle>{t("functions.invokeTitle")}</DialogTitle>
              <DialogDescription className="font-mono">{fn.name}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`fn-payload-${fn.id}`} label={t("cron.payloadJson")} error={invokeOpen ? error : undefined}>
                <Textarea
                  id={`fn-payload-${fn.id}`}
                  className="min-h-[180px] font-mono text-xs"
                  spellCheck={false}
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  disabled={busy === "invoke"}
                  invalid={Boolean(error && invokeOpen)}
                />
              </Field>
              {result ? (
                <div className="rounded-md border border-ink-100 bg-cream-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-700">
                    <Code2 className="h-3.5 w-3.5" /> {t("functions.invokeResult")}
                  </div>
                  <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap text-xs text-ink-700">{result}</pre>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInvokeOpen(false)} disabled={busy === "invoke"}>
                {t("common.close")}
              </Button>
              <Button type="submit" loading={busy === "invoke"} loadingText={t("functions.invoking")} disabled={!fn.activeDeploymentId}>
                {t("functions.runTest")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("functions.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("functions.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              {t("functions.confirmDelete", { name: fn.name })}
            </div>
            {deleteOpen && error ? <p className="mt-3 text-xs text-danger-700">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" loading={busy === "delete"} loadingText={t("common.deleting")} onClick={deleteFunction}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
