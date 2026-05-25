"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
  toast
} from "@/ui/primitives";

function RegisterPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/console";

  const [form, setForm] = useState({ username: "", email: "", displayName: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          email: form.email || undefined,
          displayName: form.displayName || undefined
        }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("注册失败", { description: data?.error?.message ?? `状态 ${res.status}` });
        setLoading(false);
        return;
      }
      toast.success("注册成功");
      router.replace(redirectTo);
    } catch {
      toast.error("网络错误");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px] shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">注册 UniID 账户</CardTitle>
        <CardDescription>开始管理你的应用、数据和文件。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-username">用户名</Label>
            <Input
              id="reg-username"
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
              minLength={3}
              maxLength={32}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">邮箱（可选）</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-displayName">显示名（可选）</Label>
            <Input
              id="reg-displayName"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">密码</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Spinner className="text-cream-50" /> : null}
            {loading ? "创建中…" : "创建账户"}
          </Button>
          <p className="text-xs text-ink-500 text-center pt-2">
            已有账户？{" "}
            <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent-600 hover:underline">
              直接登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RegisterPageContent />
    </Suspense>
  );
}
