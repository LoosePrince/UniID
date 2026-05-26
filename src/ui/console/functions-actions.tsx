"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Code2, Play, Settings2, Trash2, UploadCloud } from "lucide-react";
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
