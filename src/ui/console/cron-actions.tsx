"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Play, Trash2 } from "lucide-react";
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

interface ApiErrorResponse {
  error?: { message?: string; details?: unknown };
}

interface RunResponse extends ApiErrorResponse {
  invocationId?: string;
  status?: string;
  durationMs?: number;
  output?: unknown;
  logs?: string[];
}

interface FnOption {
  id: string;
  name: string;
}

export interface CronJobSummary {
  id: string;
  name: string;
  cronExpr: string;
  fnId: string;
  payload: string | null;
  isActive: number;
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

function parseJsonObject(source: string, emptyValue: Record<string, unknown> | undefined = undefined) {
  const trimmed = source.trim();
  if (!trimmed) return emptyValue;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("请输入合法 JSON。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload 必须是 JSON object。");
  }
  return parsed as Record<string, unknown>;
}

function payloadToText(payload: string | null) {
  if (!payload) return "{\n  \n}";
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function formatRunResult(result: RunResponse) {
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

export function CreateCronForm({ appId, fns }: { appId: string; fns: FnOption[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [cronExpr, setCronExpr] = React.useState("*/5 * * * *");
  const [fnId, setFnId] = React.useState<string>(fns[0]?.id ?? "");
  const [payload, setPayload] = React.useState("{\n  \n}");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!fnId && fns[0]) setFnId(fns[0].id);
  }, [fnId, fns]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const parsedPayload = parseJsonObject(payload, undefined);
      const res = await fetch(`/api/v1/apps/${appId}/cron`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          cronExpr: cronExpr.trim(),
          fnId,
          payload: parsedPayload
        })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("定时任务已创建", { description: name.trim() });
      setName("");
      setPayload("{\n  \n}");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("创建失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  if (fns.length === 0) {
    return <p className="text-sm text-ink-500">请先在「函数」页面创建并部署函数，才能为它建立定时任务。</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field htmlFor="cron-name" label="名称" required>
        <Input
          id="cron-name"
          required
          maxLength={64}
          placeholder="daily-cleanup"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="cron-expr" label="表达式" required help="5 字段标准 cron：分 时 日 月 周。">
        <Input
          id="cron-expr"
          required
          placeholder="*/5 * * * *"
          value={cronExpr}
          onChange={(e) => setCronExpr(e.target.value)}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="cron-fn" label="函数" required>
        <Select id="cron-fn" value={fnId} onChange={(e) => setFnId(e.target.value)} disabled={busy}>
          {fns.map((fn) => (
            <option key={fn.id} value={fn.id}>
              {fn.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field htmlFor="cron-payload" label="Payload JSON" error={error}>
        <Textarea
          id="cron-payload"
          className="min-h-[160px] font-mono text-xs"
          spellCheck={false}
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          disabled={busy}
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" loading={busy} loadingText="创建中…" disabled={!name.trim() || !fnId}>
        创建任务
      </Button>
    </form>
  );
}

export function CronJobControls({
  appId,
  job,
  fns
}: {
  appId: string;
  job: CronJobSummary;
  fns: FnOption[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"toggle" | "run" | "edit" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [runResult, setRunResult] = React.useState<string | null>(null);
  const [name, setName] = React.useState(job.name);
  const [cronExpr, setCronExpr] = React.useState(job.cronExpr);
  const [fnId, setFnId] = React.useState(job.fnId);
  const [payload, setPayload] = React.useState(payloadToText(job.payload));
  const [isActive, setIsActive] = React.useState(job.isActive === 1 ? "true" : "false");

  React.useEffect(() => {
    setName(job.name);
    setCronExpr(job.cronExpr);
    setFnId(job.fnId);
    setPayload(payloadToText(job.payload));
    setIsActive(job.isActive === 1 ? "true" : "false");
  }, [job.cronExpr, job.fnId, job.isActive, job.name, job.payload]);

  async function patchJob(body: Record<string, unknown>, successTitle: string) {
    const res = await fetch(`/api/v1/apps/${appId}/cron/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
    toast.success(successTitle, { description: job.name });
    router.refresh();
  }

  async function toggle() {
    setBusy("toggle");
    setError(null);
    try {
      await patchJob({ isActive: job.isActive !== 1 }, job.isActive === 1 ? "任务已暂停" : "任务已启用");
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("操作失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    setBusy("run");
    setError(null);
    setRunResult(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/cron/${job.id}/run`, {
        method: "POST",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as RunResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      setRunResult(formatRunResult(json));
      toast.success("任务已执行", { description: json.status ?? json.invocationId });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("执行失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("edit");
    setError(null);
    try {
      await patchJob(
        {
          name: name.trim(),
          cronExpr: cronExpr.trim(),
          fnId,
          payload: parseJsonObject(payload, undefined),
          isActive: isActive === "true"
        },
        "任务已保存"
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

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/cron/${job.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("任务已删除", { description: job.name });
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={runNow} loading={busy === "run"}>
          <Play /> 立即运行
        </Button>
        <Button size="sm" variant="ghost" onClick={toggle} loading={busy === "toggle"}>
          {job.isActive === 1 ? "暂停" : "启用"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} disabled={busy !== null}>
          <Pencil /> 编辑
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy !== null}>
          <Trash2 /> 删除
        </Button>
      </div>
      {error ? <p className="text-xs text-danger-700">{error}</p> : null}
      {runResult ? (
        <pre className="max-h-[160px] overflow-auto rounded-md border border-ink-100 bg-cream-50 p-2 text-xs text-ink-700">
          {runResult}
        </pre>
      ) : null}

      <Dialog open={editOpen} onOpenChange={(next) => busy !== "edit" && setEditOpen(next)}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>编辑定时任务</DialogTitle>
              <DialogDescription>保存后调度器会按最新表达式重新注册。</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`cron-name-${job.id}`} label="名称" required>
                <Input id={`cron-name-${job.id}`} value={name} onChange={(e) => setName(e.target.value)} disabled={busy === "edit"} />
              </Field>
              <Field htmlFor={`cron-expr-${job.id}`} label="表达式" required help="5 字段标准 cron：分 时 日 月 周。">
                <Input id={`cron-expr-${job.id}`} value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} disabled={busy === "edit"} />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field htmlFor={`cron-fn-${job.id}`} label="函数" required>
                  <Select id={`cron-fn-${job.id}`} value={fnId} onChange={(e) => setFnId(e.target.value)} disabled={busy === "edit"}>
                    {fns.map((fn) => (
                      <option key={fn.id} value={fn.id}>
                        {fn.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field htmlFor={`cron-active-${job.id}`} label="状态">
                  <Select id={`cron-active-${job.id}`} value={isActive} onChange={(e) => setIsActive(e.target.value)} disabled={busy === "edit"}>
                    <option value="true">active</option>
                    <option value="false">paused</option>
                  </Select>
                </Field>
              </div>
              <Field htmlFor={`cron-payload-${job.id}`} label="Payload JSON" error={editOpen ? error : undefined}>
                <Textarea
                  id={`cron-payload-${job.id}`}
                  className="min-h-[180px] font-mono text-xs"
                  spellCheck={false}
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  disabled={busy === "edit"}
                  invalid={Boolean(error && editOpen)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy === "edit"}>
                取消
              </Button>
              <Button type="submit" loading={busy === "edit"} loadingText="保存中…" disabled={!name.trim() || !fnId}>
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除定时任务</DialogTitle>
            <DialogDescription>删除后不会再触发关联函数。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              确认删除任务 <span className="font-mono">{job.name}</span>？
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