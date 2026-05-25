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
    throw new Error("JSON 内容必须是 object。");
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
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("函数已创建", { description: name.trim() });
      setName("");
      setDescription("");
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
      <Field htmlFor="fn-name" label="函数名" required help="只能包含字母、数字、_ 和 -。">
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
      <Field htmlFor="fn-desc" label="描述">
        <Input
          id="fn-desc"
          maxLength={500}
          placeholder="一句话描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="fn-memory" label="内存 MB">
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
        <Field htmlFor="fn-timeout" label="超时 ms">
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
      <Button type="submit" loading={busy} loadingText="创建中…" disabled={name.trim() === ""}>
        创建函数
      </Button>
    </form>
  );
}

export function DeployButton({ appId, fnId, fnName }: { appId: string; fnId: string; fnName?: string }) {
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
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("函数已部署", { description: fnName ?? fnId });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("部署失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UploadCloud /> 部署
      </Button>
      <DialogContent className="max-w-3xl">
        <form onSubmit={onDeploy}>
          <DialogHeader>
            <DialogTitle>部署函数版本</DialogTitle>
            <DialogDescription>源码需要导出或声明 handler(input, uniid)。部署成功后会成为 active deployment。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field htmlFor={`src-${fnId}`} label="源码" required error={error}>
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
              取消
            </Button>
            <Button type="submit" loading={busy} loadingText="部署中…" disabled={source.trim() === ""}>
              部署新版本
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FunctionRowActions({ appId, fn }: { appId: string; fn: FunctionSummary }) {
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
    if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
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
      if (envJson.trim()) body.env = parseJsonObject(envJson, undefined);
      await patchFunction(body, "函数设置已保存");
      setSettingsOpen(false);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive() {
    setBusy("toggle");
    setError(null);
    try {
      await patchFunction({ isActive: fn.isActive !== 1 }, fn.isActive === 1 ? "函数已停用" : "函数已启用");
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("操作失败", { description: message });
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
      const parsedPayload = parseJsonObject(payload, {});
      const res = await fetch(`/api/v1/apps/${appId}/functions/${fn.id}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload: parsedPayload })
      });
      const json = (await res.json().catch(() => ({}))) as FunctionActionResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      setResult(formatResult(json));
      toast.success("测试调用已完成", { description: json.status ?? json.invocationId });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("调用失败", { description: message });
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
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("函数已删除", { description: fn.name });
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
      <div className="flex flex-wrap justify-end gap-1.5">
        <DeployButton appId={appId} fnId={fn.id} fnName={fn.name} />
        <Button size="sm" variant="ghost" onClick={() => setInvokeOpen(true)} disabled={!fn.activeDeploymentId || busy !== null}>
          <Play /> 测试
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleActive} loading={busy === "toggle"}>
          {fn.isActive === 1 ? "停用" : "启用"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} disabled={busy !== null}>
          <Settings2 /> 设置
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy !== null}>
          <Trash2 /> 删除
        </Button>
      </div>
      {error ? <p className="text-right text-xs text-danger-700">{error}</p> : null}

      <Dialog open={settingsOpen} onOpenChange={(next) => busy !== "settings" && setSettingsOpen(next)}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={saveSettings}>
            <DialogHeader>
              <DialogTitle>函数设置</DialogTitle>
              <DialogDescription className="font-mono">{fn.name}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`fn-desc-${fn.id}`} label="描述">
                <Input
                  id={`fn-desc-${fn.id}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={busy === "settings"}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field htmlFor={`fn-active-${fn.id}`} label="状态">
                  <Select
                    id={`fn-active-${fn.id}`}
                    value={isActive}
                    onValueChange={setIsActive}
                    disabled={busy === "settings"}
                    options={[
                      { value: "true", label: "active" },
                      { value: "false", label: "disabled" }
                    ]}
                  />
                </Field>
                <Field htmlFor={`fn-memory-${fn.id}`} label="内存 MB">
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
                <Field htmlFor={`fn-timeout-${fn.id}`} label="超时 ms">
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
                label="环境变量 JSON"
                help="可选；留空表示不修改现有环境变量。示例：{ &quot;API_KEY&quot;: &quot;...&quot; }"
                error={settingsOpen && busy === null ? error : undefined}
              >
                <Textarea
                  id={`fn-env-${fn.id}`}
                  className="min-h-[120px] font-mono text-xs"
                  spellCheck={false}
                  placeholder="留空则不修改"
                  value={envJson}
                  onChange={(e) => setEnvJson(e.target.value)}
                  disabled={busy === "settings"}
                  invalid={Boolean(error && settingsOpen)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)} disabled={busy === "settings"}>
                取消
              </Button>
              <Button type="submit" loading={busy === "settings"} loadingText="保存中…">
                保存设置
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={invokeOpen} onOpenChange={(next) => busy !== "invoke" && setInvokeOpen(next)}>
        <DialogContent className="max-w-3xl">
          <form onSubmit={invokeFunction}>
            <DialogHeader>
              <DialogTitle>测试调用</DialogTitle>
              <DialogDescription className="font-mono">{fn.name}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor={`fn-payload-${fn.id}`} label="Payload JSON" error={invokeOpen ? error : undefined}>
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
                    <Code2 className="h-3.5 w-3.5" /> 调用结果
                  </div>
                  <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap text-xs text-ink-700">{result}</pre>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInvokeOpen(false)} disabled={busy === "invoke"}>
                关闭
              </Button>
              <Button type="submit" loading={busy === "invoke"} loadingText="调用中…" disabled={!fn.activeDeploymentId}>
                执行测试
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除函数</DialogTitle>
            <DialogDescription>函数、部署版本、调用日志和关联 Cron 会按数据库关系一起清理。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              确认删除函数 <span className="font-mono">{fn.name}</span>？
            </div>
            {deleteOpen && error ? <p className="mt-3 text-xs text-danger-700">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy === "delete"}>
              取消
            </Button>
            <Button type="button" variant="danger" loading={busy === "delete"} loadingText="删除中…" onClick={deleteFunction}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}