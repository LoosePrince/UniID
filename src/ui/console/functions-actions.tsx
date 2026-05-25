"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/ui/primitives";

interface CreateFunctionFormProps {
  appId: string;
}

export function CreateFunctionForm({ appId }: CreateFunctionFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/functions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description: description || undefined })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      }
      setName("");
      setDescription("");
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
        <Label htmlFor="fn-name">函数名</Label>
        <Input
          id="fn-name"
          required
          pattern="[a-zA-Z0-9_\-]+"
          maxLength={64}
          placeholder="send-welcome-email"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="fn-desc">描述</Label>
        <Input
          id="fn-desc"
          placeholder="一句话描述"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || name.trim() === ""}>
        {busy ? "创建中…" : "创建函数"}
      </Button>
    </form>
  );
}

interface DeployButtonProps {
  appId: string;
  fnId: string;
}

const SAMPLE_SOURCE = `// handler(input, uniid) — input 由调用方传入，uniid 提供宿主能力
async function handler(input, uniid) {
  uniid.log?.("invoked with", input);
  return { ok: true, echoed: input };
}
`;

export function DeployButton({ appId, fnId }: DeployButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDeploy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/functions/${fnId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceCode: source })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        部署新版本
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <Label htmlFor={`src-${fnId}`}>源码 (handler(input, uniid))</Label>
      <textarea
        id={`src-${fnId}`}
        className="w-full min-h-[200px] rounded-sm border border-cream-300 bg-white p-2 font-mono text-xs"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={onDeploy} disabled={busy}>
          {busy ? "部署中…" : "部署"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          取消
        </Button>
      </div>
    </div>
  );
}
