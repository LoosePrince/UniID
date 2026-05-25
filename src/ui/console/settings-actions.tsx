"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/ui/primitives";

interface BasicInfoFormProps {
  appId: string;
  initial: { name: string; description: string | null; primaryDomain: string };
}

export function BasicInfoForm({ appId, initial }: BasicInfoFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [primaryDomain, setPrimaryDomain] = useState(initial.primaryDomain);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description, primaryDomain })
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      setMsg("已保存");
      router.refresh();
    } catch (err) {
      setMsg(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="app-name">应用名称</Label>
        <Input id="app-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="app-desc">描述</Label>
        <Input id="app-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="app-domain">主域名</Label>
        <Input
          id="app-domain"
          required
          value={primaryDomain}
          onChange={(e) => setPrimaryDomain(e.target.value)}
        />
        <p className="mt-1 text-2xs text-ink-400">
          仅此域名（及已校验的附加域名）可访问该应用的 SDK API。
        </p>
      </div>
      {msg && <p className="text-xs text-ink-600">{msg}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "保存中…" : "保存"}
      </Button>
    </form>
  );
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

export function QuotaForm({ appId, quota }: QuotaFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(quota);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, v: number) {
    setForm((prev) => ({ ...prev, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quota: form })
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      setMsg("已保存");
      router.refresh();
    } catch (err) {
      setMsg(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Row label="RPS 限制">
        <Input
          type="number"
          min={1}
          value={form.rpsLimit}
          onChange={(e) => set("rpsLimit", Number(e.target.value))}
        />
      </Row>
      <Row label="每日 API 调用">
        <Input
          type="number"
          min={1}
          value={form.dailyApiCalls}
          onChange={(e) => set("dailyApiCalls", Number(e.target.value))}
        />
      </Row>
      <Row label="每月存储 (字节)">
        <Input
          type="number"
          min={0}
          value={form.monthlyStorageBytes}
          onChange={(e) => set("monthlyStorageBytes", Number(e.target.value))}
        />
      </Row>
      <Row label="每月出站 (字节)">
        <Input
          type="number"
          min={0}
          value={form.monthlyEgressBytes}
          onChange={(e) => set("monthlyEgressBytes", Number(e.target.value))}
        />
      </Row>
      <Row label="每日函数调用">
        <Input
          type="number"
          min={0}
          value={form.fnInvocationsDaily}
          onChange={(e) => set("fnInvocationsDaily", Number(e.target.value))}
        />
      </Row>
      {msg && <p className="text-xs text-ink-600">{msg}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "保存中…" : "保存配额"}
      </Button>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
      <Label className="text-ink-600">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

export function DangerZone({ appId, appName }: { appId: string; appName: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDestroy() {
    if (confirm !== appName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/settings`, {
        method: "DELETE",
        credentials: "include"
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      router.push("/console/apps");
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-sm border border-red-200 bg-red-50/50 p-4 space-y-3">
      <div>
        <h3 className="font-medium text-red-900 text-sm">删除应用</h3>
        <p className="text-xs text-red-700 mt-1">
          此操作不可恢复。所有 Schema / 记录 / 文件 / Webhooks / Cron / 授权关系会被级联删除。
        </p>
      </div>
      <div>
        <Label htmlFor="confirm-name">在下方输入应用名称以确认</Label>
        <Input
          id="confirm-name"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={appName}
        />
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <Button
        type="button"
        variant="outline"
        onClick={onDestroy}
        disabled={busy || confirm !== appName}
        className="border-red-300 text-red-700 hover:bg-red-100"
      >
        {busy ? "删除中…" : "永久删除"}
      </Button>
    </div>
  );
}

export function AddDomainForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ host })
      });
      setHost("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        required
        placeholder="example.com"
        value={host}
        onChange={(e) => setHost(e.target.value)}
      />
      <Button type="submit" disabled={busy || !host}>
        添加
      </Button>
    </form>
  );
}

export function RemoveDomainButton({ appId, domainId }: { appId: string; domainId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!confirm("确认移除此域名？")) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/domains/${domainId}`, {
        method: "DELETE",
        credentials: "include"
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={busy}>
      移除
    </Button>
  );
}
