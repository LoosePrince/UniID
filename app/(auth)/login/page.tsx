"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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

      // 后端会通过 Set-Cookie 写入 HttpOnly Cookie（uniid_token 等），
      // 前端不再在 localStorage 中持久化 token。
      await res.json(); // 方便未来使用响应体中的 user 信息

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
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
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
            autoComplete="current-password"
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
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
      <div className="space-y-1 text-xs text-slate-500">
        <p>初始管理员：用户名 admin，密码 admin123。</p>
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
    </main>
  );
}

