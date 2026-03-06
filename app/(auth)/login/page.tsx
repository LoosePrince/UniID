"use client";

import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasswordInput, TextInput } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "登录失败");
        setLoading(false);
        return;
      }

      await res.json();

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  }

  return (
    <main className="w-full max-w-md">
      <Card className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          UniID 登录
        </h1>
        <p className="text-sm text-slate-300">
          使用管理员账户或后续创建的用户账户登录统一认证服务。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              用户名
            </label>
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              密码
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </PrimaryButton>
        </form>
        <div className="space-y-1 text-xs text-slate-500">
          <p>
            还没有账号？{" "}
            <button
              type="button"
              onClick={() => router.push("/register")}
              className="text-sky-300 underline-offset-2 hover:underline"
            >
              立即注册
            </button>
          </p>
        </div>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="w-full max-w-md text-sm text-slate-300">加载中...</main>}>
      <LoginPageContent />
    </Suspense>
  );
}

