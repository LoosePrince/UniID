"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Spinner, toast } from "@/ui/primitives";

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/console";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("登录失败", { description: data?.error?.message ?? `状态 ${res.status}` });
        setLoading(false);
        return;
      }
      toast.success("欢迎回来");
      router.replace(redirectTo);
    } catch {
      toast.error("网络错误");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px] shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">登录到 UniID</CardTitle>
        <CardDescription>使用你的账户继续。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-username">用户名</Label>
            <Input
              id="login-username"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">密码</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Spinner className="text-cream-50" /> : null}
            {loading ? "登录中…" : "登录"}
          </Button>
          <p className="text-xs text-ink-500 text-center pt-2">
            还没有账户？{" "}
            <Link href={`/register?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent-600 hover:underline">
              注册一个
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginPageContent />
    </Suspense>
  );
}
