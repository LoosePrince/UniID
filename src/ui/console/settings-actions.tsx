"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Globe2, Save, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Textarea,
  toast
} from "@/ui/primitives";

interface ApiErrorResponse {
  error?: { message?: string };
}

interface BasicInfoFormProps {
  appId: string;
  initial: { name: string; description: string | null; primaryDomain: string };
}

interface QuotaFormProps {
  appId: string;
  quota: {
    rpsLimit: number;
    dailyApiCalls: number;
    monthlyStorageBytes: number;
    monthlyEgressBytes: number;
    fnInvocationsDaily: number;
  };
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

function toNonNegativeInt(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0;
}

function toPositiveInt(value: string) {
  return Math.max(1, toNonNegativeInt(value));
}

export function BasicInfoForm({ appId, initial }: BasicInfoFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description ?? "");
  const [primaryDomain, setPrimaryDomain] = React.useState(initial.primaryDomain);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          primaryDomain: primaryDomain.trim()
        })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("基础信息已保存", { description: name.trim() });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field htmlFor="app-name" label="应用名称" required>
        <Input
          id="app-name"
          required
          maxLength={64}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
        />
      </Field>
      <Field htmlFor="app-desc" label="描述" help="可选；用于控制台列表和应用概览展示。">
        <Textarea
          id="app-desc"
          className="min-h-24"
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={busy}
        />
      </Field>
      <Field
        htmlFor="app-domain"
        label="主域名"
        required
        error={error}
        help="仅此域名（及已校验的附加域名）可访问该应用的 SDK API。"
      >
        <Input
          id="app-domain"
          required
          value={primaryDomain}
          onChange={(event) => setPrimaryDomain(event.target.value)}
          disabled={busy}
          invalid={Boolean(error)}
          placeholder="example.com"
        />
      </Field>
      <Button type="submit" loading={busy} loadingText="保存中…" disabled={!name.trim() || !primaryDomain.trim()}>
        <Save /> 保存
      </Button>
    </form>
  );
}

export function QuotaForm({ appId, quota }: QuotaFormProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(quota);
  const [error, setError] = React.useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quota: form })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("配额已保存");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <QuotaField label="RPS 限制" htmlFor="quota-rps">
        <Input
          id="quota-rps"
          type="number"
          min={1}
          value={form.rpsLimit}
          onChange={(event) => set("rpsLimit", toPositiveInt(event.target.value))}
          disabled={busy}
        />
      </QuotaField>
      <QuotaField label="每日 API 调用" htmlFor="quota-daily-api">
        <Input
          id="quota-daily-api"
          type="number"
          min={1}
          value={form.dailyApiCalls}
          onChange={(event) => set("dailyApiCalls", toPositiveInt(event.target.value))}
          disabled={busy}
        />
      </QuotaField>
      <QuotaField label="每月存储（字节）" htmlFor="quota-storage">
        <Input
          id="quota-storage"
          type="number"
          min={0}
          value={form.monthlyStorageBytes}
          onChange={(event) => set("monthlyStorageBytes", toNonNegativeInt(event.target.value))}
          disabled={busy}
        />
      </QuotaField>
      <QuotaField label="每月出站（字节）" htmlFor="quota-egress">
        <Input
          id="quota-egress"
          type="number"
          min={0}
          value={form.monthlyEgressBytes}
          onChange={(event) => set("monthlyEgressBytes", toNonNegativeInt(event.target.value))}
          disabled={busy}
        />
      </QuotaField>
      <QuotaField label="每日函数调用" htmlFor="quota-fn">
        <Input
          id="quota-fn"
          type="number"
          min={0}
          value={form.fnInvocationsDaily}
          onChange={(event) => set("fnInvocationsDaily", toNonNegativeInt(event.target.value))}
          disabled={busy}
        />
      </QuotaField>
      {error ? (
        <p className="text-xs leading-5 text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} loadingText="保存中…">
        <Save /> 保存配额
      </Button>
    </form>
  );
}

function QuotaField({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <Field htmlFor={htmlFor} label={label} className="grid gap-2 sm:grid-cols-[160px_1fr] sm:items-center sm:space-y-0">
      {children}
    </Field>
  );
}

export function DangerZone({ appId, appName }: { appId: string; appName: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onDestroy() {
    if (confirm !== appName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/settings`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("应用已删除", { description: appName });
      router.push("/console/apps");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("删除失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-danger-200 bg-danger-50/60 p-4 space-y-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-danger-600" />
        <div>
          <h3 className="font-medium text-danger-900 text-sm">删除应用</h3>
          <p className="text-xs leading-5 text-danger-700 mt-1">
            此操作不可恢复。所有 Schema / 记录 / 文件 / Webhooks / Cron / 授权关系会被级联删除。
          </p>
        </div>
      </div>
      <Field htmlFor="confirm-name" label="在下方输入应用名称以确认" error={error}>
        <Input
          id="confirm-name"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder={appName}
          disabled={busy}
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="button" variant="danger" onClick={onDestroy} loading={busy} loadingText="删除中…" disabled={confirm !== appName}>
        <Trash2 /> 永久删除
      </Button>
    </div>
  );
}

export function AddDomainForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [host, setHost] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedHost = host.trim();
    if (!normalizedHost) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ host: normalizedHost })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      setHost("");
      toast.success("域名已添加", { description: normalizedHost });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("添加失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 sm:flex sm:items-start sm:gap-2 sm:space-y-0">
      <Field htmlFor="domain-host" label="新增附加域名" error={error} className="flex-1">
        <Input
          id="domain-host"
          required
          placeholder="example.com"
          value={host}
          onChange={(event) => setHost(event.target.value)}
          disabled={busy}
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" className="sm:mt-5" loading={busy} loadingText="添加中…" disabled={!host.trim()}>
        <Globe2 /> 添加
      </Button>
    </form>
  );
}

export function RemoveDomainButton({
  appId,
  domainId,
  host
}: {
  appId: string;
  domainId: string;
  host?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label = host ?? domainId;

  async function removeDomain() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/domains/${domainId}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("域名已移除", { description: label });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("移除失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          移除
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>移除域名</DialogTitle>
          <DialogDescription>移除后，该域名将无法继续访问此应用的 SDK API。</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            确认移除 <span className="font-mono">{label}</span>？
          </div>
          {error ? (
            <p className="text-xs leading-5 text-danger-700" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="danger" onClick={removeDomain} loading={busy} loadingText="移除中…">
            <Trash2 /> 确认移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}