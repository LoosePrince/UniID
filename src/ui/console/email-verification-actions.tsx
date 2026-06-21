"use client";

import { useState, useTransition } from "react";
import { MailCheck, Send } from "lucide-react";
import { Button, toast } from "@/ui/primitives";

export function EmailVerificationActions({
  email,
  verifiedAt,
  featureEnabled = true
}: {
  email: string | null;
  verifiedAt: number | null;
  featureEnabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [devLink, setDevLink] = useState<string | null>(null);

  if (!featureEnabled) {
    return <p className="text-sm text-ink-500 dark:text-slate-400">邮箱验证功能已由系统管理员关闭。</p>;
  }

  if (!email) {
    return <p className="text-sm text-ink-500 dark:text-slate-400">绑定邮箱后即可请求验证链接。</p>;
  }

  if (verifiedAt) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-200">
        <MailCheck className="h-4 w-4" /> 邮箱已验证。
      </p>
    );
  }

  function requestVerify() {
    startTransition(async () => {
      const res = await fetch("/api/v1/auth/email/request", {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error?.message ?? "无法创建验证链接");
        return;
      }
      setDevLink(data.verifyUrl ?? null);
      toast.success("验证链接已创建");
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={requestVerify} loading={pending}>
        <Send /> 发送验证链接
      </Button>
      {devLink ? (
        <p className="max-w-xl break-all rounded-md border border-ink-100 bg-cream-50 px-3 py-2 font-mono text-xs text-ink-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          {devLink}
        </p>
      ) : null}
    </div>
  );
}
