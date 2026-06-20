"use client";

import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Button, Field, Input, toast } from "@/ui/primitives";

export function TwoFactorActions({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isEnabled, setIsEnabled] = useState(enabled);

  function beginSetup() {
    startTransition(async () => {
      const res = await fetch("/api/v1/account/2fa/setup", {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error?.message ?? "无法创建两步验证密钥");
        return;
      }
      setSetup(data);
      toast.success("已创建两步验证密钥");
    });
  }

  function enable() {
    if (!setup) return;
    startTransition(async () => {
      const res = await fetch("/api/v1/account/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ secret: setup.secret, code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error?.message ?? "验证码无效");
        return;
      }
      setIsEnabled(true);
      setSetup(null);
      setCode("");
      toast.success("两步验证已启用");
    });
  }

  function disable() {
    startTransition(async () => {
      const res = await fetch("/api/v1/account/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: disableCode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error?.message ?? "验证码无效");
        return;
      }
      setIsEnabled(false);
      setDisableCode("");
      toast.success("两步验证已关闭");
    });
  }

  if (isEnabled) {
    return (
      <div className="max-w-md space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <ShieldCheck className="mr-2 inline h-4 w-4" />
          当前账号登录时需要 TOTP 验证码。
        </div>
        <Field label="关闭验证码" htmlFor="disable-2fa-code" help="输入当前认证器中的 6 位验证码。">
          <Input
            id="disable-2fa-code"
            value={disableCode}
            onChange={(event) => setDisableCode(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
          />
        </Field>
        <Button variant="danger" onClick={disable} loading={pending} disabled={!/^\d{6}$/.test(disableCode)}>
          <ShieldOff /> 关闭两步验证
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      {!setup ? (
        <Button onClick={beginSetup} loading={pending}>
          <KeyRound /> 创建两步验证密钥
        </Button>
      ) : (
        <>
          <div className="space-y-2 rounded-md border border-ink-100 bg-cream-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
            <p className="font-medium text-ink-900 dark:text-slate-100">把密钥添加到认证器应用</p>
            <p className="break-all font-mono text-xs text-ink-700 dark:text-slate-300">{setup.secret}</p>
            <p className="break-all text-xs text-ink-500 dark:text-slate-400">{setup.otpauthUrl}</p>
          </div>
          <Field label="验证码" htmlFor="enable-2fa-code" help="输入认证器里显示的 6 位验证码完成启用。">
            <Input
              id="enable-2fa-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={enable} loading={pending} disabled={!/^\d{6}$/.test(code)}>
              <ShieldCheck /> 启用
            </Button>
            <Button variant="ghost" onClick={() => setSetup(null)} disabled={pending}>
              取消
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
