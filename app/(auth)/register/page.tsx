"use client";

import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasswordInput, TextInput } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password,
          email: email || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data.error as string | undefined;
        if (code === "USERNAME_TAKEN") {
          setError("该用户名已被占用");
        } else if (code === "INVALID_USERNAME") {
          setError("用户名格式不合法");
        } else if (code === "INVALID_PASSWORD") {
          setError("密码长度需在 6-128 位之间");
        } else {
          setError("注册失败");
        }
        setLoading(false);
        return;
      }

      await res.json();
      router.push("/dashboard");
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
          创建 UniID 账户
        </h1>
        <p className="text-sm text-slate-300">
          注册后即可在统一认证服务中管理应用与数据。
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
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              邮箱（可选）
            </label>
            <TextInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              密码
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              确认密码
            </label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "注册中..." : "注册并登录"}
          </PrimaryButton>
        </form>
        <div className="text-xs text-slate-500">
          <p>
            已有账户？
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-sky-300 underline-offset-2 hover:underline"
            >
              立即登录
            </button>
          </p>
        </div>
      </Card>
    </main>
  );
}