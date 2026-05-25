"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, KeyRound, UserCog } from "lucide-react";
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
  toast
} from "@/ui/primitives";

interface UserSummary {
  id: string;
  username: string;
  role: "user" | "admin";
  disabled: boolean;
}

type UserActionKind = "role" | "password" | "status";

async function callAdmin(action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/v1/admin/users/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `${res.status}`);
  }
}

export function UserActions({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<UserActionKind | null>(null);
  const [role, setRole] = useState<"user" | "admin">(user.role === "admin" ? "user" : "admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const statusAction = user.disabled ? "enable" : "disable";
  const statusLabel = user.disabled ? "恢复" : "禁用";

  const dialogCopy = useMemo(() => {
    if (dialog === "role") {
      return {
        title: "修改用户角色",
        description: "角色会影响系统管理权限，请确认后再保存。",
        submit: "保存角色"
      };
    }
    if (dialog === "password") {
      return {
        title: "重置用户密码",
        description: "重置后该用户所有控制台和 SDK 会话都会被注销。",
        submit: "确认重置"
      };
    }
    return {
      title: `${statusLabel}用户`,
      description: user.disabled ? "恢复后该用户可以重新登录控制台。" : "禁用后该用户的所有会话都会被注销。",
      submit: `确认${statusLabel}`
    };
  }, [dialog, statusLabel, user.disabled]);

  function openDialog(kind: UserActionKind) {
    setDialog(kind);
    setError(null);
    setPassword("");
    setRole(user.role === "admin" ? "user" : "admin");
  }

  function closeDialog() {
    if (pending) return;
    setDialog(null);
    setError(null);
  }

  function submit() {
    if (!dialog) return;
    setError(null);

    startTransition(async () => {
      try {
        if (dialog === "role") {
          await callAdmin("set-role", { userId: user.id, role });
          toast.success("角色已更新");
        } else if (dialog === "password") {
          if (password.length < 8) throw new Error("密码至少 8 位");
          await callAdmin("reset-password", { userId: user.id, newPassword: password });
          toast.success("密码已重置", { description: "该用户所有会话已注销" });
        } else {
          await callAdmin(statusAction, { userId: user.id });
          toast.success(user.disabled ? "用户已恢复" : "用户已禁用");
        }
        setDialog(null);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";
        setError(message);
        toast.error("操作失败", { description: message });
      }
    });
  }

  return (
    <>
      <div className="inline-flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => openDialog("role")}>
          <UserCog /> 改角色
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openDialog("password")}>
          <KeyRound /> 改密
        </Button>
        <Button variant={user.disabled ? "secondary" : "danger"} size="sm" onClick={() => openDialog("status")}>
          {user.disabled ? <Shield /> : <ShieldOff />} {statusLabel}
        </Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(value) => (value ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogCopy.title}</DialogTitle>
            <DialogDescription>{dialogCopy.description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-md border border-ink-100 bg-cream-50 px-3 py-2 text-sm">
              <span className="text-ink-500">目标用户：</span>
              <span className="font-mono text-ink-900">@{user.username}</span>
            </div>

            {dialog === "role" ? (
              <Field label="新角色" htmlFor={`role-${user.id}`}>
                <Select id={`role-${user.id}`} value={role} onChange={(event) => setRole(event.target.value as "user" | "admin")} disabled={pending}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </Select>
              </Field>
            ) : null}

            {dialog === "password" ? (
              <Field label="新密码" htmlFor={`password-${user.id}`} required error={password.length > 0 && password.length < 8 ? "密码至少 8 位" : undefined}>
                <Input
                  id={`password-${user.id}`}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                  minLength={8}
                  invalid={password.length > 0 && password.length < 8}
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                />
              </Field>
            ) : null}

            {error ? (
              <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={pending}>取消</Button>
            <Button
              variant={dialog === "status" && !user.disabled ? "danger" : "primary"}
              onClick={submit}
              loading={pending}
              loadingText="处理中..."
              disabled={dialog === "password" && password.length < 8}
            >
              {dialogCopy.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}