"use client";

import { useState } from "react";
import { Button, Input, Label, Spinner, toast } from "@/ui/primitives";

export function ChangePasswordForm() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("修改失败", { description: data?.error?.message });
        return;
      }
      toast.success("密码已更新");
      setOldPw("");
      setNewPw("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="oldPw">原密码</Label>
        <Input id="oldPw" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required minLength={8} autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPw">新密码</Label>
        <Input id="newPw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">确认新密码</Label>
        <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" invalid={confirm.length > 0 && confirm !== newPw} />
      </div>
      <div className="pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner className="text-cream-50" /> : null} 更新密码
        </Button>
      </div>
    </form>
  );
}
