"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { Button, Field, Input, toast } from "@/ui/primitives";

export function ChangePasswordForm() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && confirm !== newPw;
  const canSubmit = oldPw.length >= 8 && newPw.length >= 8 && confirm === newPw;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mismatch) {
      setError("两次输入的新密码不一致");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `修改失败 (${res.status})`);
        }
        toast.success("密码已更新");
        setOldPw("");
        setNewPw("");
        setConfirm("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "修改失败";
        setError(message);
        toast.error("修改失败", { description: message });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <Field label="原密码" htmlFor="oldPw" required>
        <Input
          id="oldPw"
          type={showPasswords ? "text" : "password"}
          value={oldPw}
          onChange={(event) => setOldPw(event.target.value)}
          disabled={pending}
          required
          minLength={8}
          autoComplete="current-password"
        />
      </Field>

      <Field label="新密码" htmlFor="newPw" required help="至少 8 位，建议混合大小写、数字和符号。">
        <Input
          id="newPw"
          type={showPasswords ? "text" : "password"}
          value={newPw}
          onChange={(event) => setNewPw(event.target.value)}
          disabled={pending}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      <Field label="确认新密码" htmlFor="confirm" required error={mismatch ? "两次输入的新密码不一致" : undefined}>
        <Input
          id="confirm"
          type={showPasswords ? "text" : "password"}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={pending}
          required
          minLength={8}
          autoComplete="new-password"
          invalid={mismatch}
        />
      </Field>

      {error && !mismatch ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" loading={pending} loadingText="更新中..." disabled={!canSubmit}>
          <Save /> 更新密码
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowPasswords((value) => !value)} disabled={pending}>
          {showPasswords ? <EyeOff /> : <Eye />} {showPasswords ? "隐藏密码" : "显示密码"}
        </Button>
        <span className="inline-flex items-center gap-1 text-xs text-ink-400">
          <KeyRound className="h-3.5 w-3.5" /> 修改后当前会话保持登录
        </span>
      </div>
    </form>
  );
}