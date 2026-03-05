"use client";

import { useState } from "react";
import { PasswordInput } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/button";

export function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword) {
      setError("请输入当前密码和新密码");
      return;
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      setError("新密码长度需在 6-128 位之间");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data.error as string | undefined;

        if (code === "CURRENT_PASSWORD_INCORRECT") {
          setError("当前密码不正确");
        } else if (code === "INVALID_NEW_PASSWORD") {
          setError("新密码长度需在 6-128 位之间");
        } else {
          setError("修改密码失败，请稍后重试");
        }
        return;
      }

      setSuccess("密码已更新，部分设备可能需要重新登录。");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">密码与账户安全</h2>
        <p className="text-xs text-slate-500">
          修改密码后，当前账户的其他设备会话将被逐步失效，确保账户安全。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 text-sm text-slate-300">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            当前密码
          </label>
          <PasswordInput
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            新密码
          </label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            确认新密码
          </label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-400">
            {success}
          </p>
        )}
        <div className="pt-1">
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "保存中..." : "保存新密码"}
          </PrimaryButton>
        </div>
      </form>
    </section>
  );
}

