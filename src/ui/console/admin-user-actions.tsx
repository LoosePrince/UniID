"use client";

import { useState, useTransition } from "react";
import { Button } from "@/ui/primitives";

interface UserSummary {
  id: string;
  username: string;
  role: "user" | "admin";
  disabled: boolean;
}

async function callAdmin(action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/v1/admin/users/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `${res.status}`);
  }
}

export function UserActions({ user }: { user: UserSummary }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const doToggleDisable = () => {
    if (!confirm(user.disabled ? `恢复用户 ${user.username}？` : `禁用用户 ${user.username}？`)) return;
    setError(null);
    start(async () => {
      try {
        await callAdmin(user.disabled ? "enable" : "disable", { userId: user.id });
        location.reload();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const doSetRole = () => {
    const next = user.role === "admin" ? "user" : "admin";
    if (!confirm(`把 ${user.username} 设为 ${next}？`)) return;
    setError(null);
    start(async () => {
      try {
        await callAdmin("set-role", { userId: user.id, role: next });
        location.reload();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const doResetPassword = () => {
    const password = prompt(`为 ${user.username} 设置新密码（≥ 8 位）：`);
    if (!password) return;
    if (password.length < 8) { alert("密码至少 8 位"); return; }
    setError(null);
    start(async () => {
      try {
        await callAdmin("reset-password", { userId: user.id, newPassword: password });
        alert("已重置；该用户所有会话已注销");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="inline-flex gap-1 items-center">
      <Button variant="ghost" size="sm" onClick={doSetRole} disabled={pending}>
        改角色
      </Button>
      <Button variant="ghost" size="sm" onClick={doResetPassword} disabled={pending}>
        改密
      </Button>
      <Button
        variant={user.disabled ? "secondary" : "danger"}
        size="sm"
        onClick={doToggleDisable}
        disabled={pending}
      >
        {user.disabled ? "恢复" : "禁用"}
      </Button>
      {error && <span className="ml-2 text-xs text-danger-700">{error}</span>}
    </div>
  );
}
