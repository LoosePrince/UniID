"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/ui/primitives";

export function AddMemberForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username })
      });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`);
      setUsername("");
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
        <Label htmlFor="member-username">UniID 用户名</Label>
        <Input
          id="member-username"
          required
          placeholder="alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <p className="mt-1 text-2xs text-ink-400">
          被添加的成员拥有该应用的管理员权限（除删除应用外的全部操作）。
        </p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !username}>
        {busy ? "添加中…" : "添加成员"}
      </Button>
    </form>
  );
}

export function RemoveMemberButton({ appId, userId }: { appId: string; userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("确认移除此成员？")) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/apps/${appId}/members/${userId}`, {
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
