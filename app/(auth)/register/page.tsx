"use client";

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
    <main className="w-full max-w-md space-y-6 rounded-xl bg-slate-900/60 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
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
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
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
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
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
          <input
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
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
          <input
            type="password"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
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
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "注册中..." : "注册并登录"}
        </button>
      </form>
      <div className="text-xs text-slate-500">
        <p>
          已有账户？请前往
          <span className="font-mono text-sky-300"> /login </span>
          登录。
        </p>
      </div>
    </main>
  );
}