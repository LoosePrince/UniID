"use client";

import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasswordInput, TextInput } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  const appId = searchParams.get("app_id");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 如果登录页在 iframe 中显示，也向父页面上报高度
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.getElementById("auth-login-root");
    if (!root) return;

    const reportHeight = () => {
      const card =
        (root.querySelector(".rounded-2xl") as HTMLElement | null) ||
        (root.firstElementChild as HTMLElement | null);
      const height = card
        ? card.getBoundingClientRect().height
        : root.scrollHeight;

      window.parent.postMessage(
        { type: "uniid_resize", height },
        "*"
      );
    };

    // 初次渲染先上报一次
    reportHeight();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        window.requestAnimationFrame(reportHeight);
      });
      observer.observe(root);

      return () => {
        observer.disconnect();
      };
    }

    const handleResize = () => {
      reportHeight();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
    <div className="flex w-full h-full min-h-screen items-center justify-center bg-slate-950 text-slate-50 overflow-hidden">
      <main id="auth-login-root" className="w-full h-full flex items-center justify-center">
        <Card className="w-full h-full border-none sm:border-slate-800 bg-slate-950 sm:bg-slate-900/50 shadow-none sm:shadow-2xl backdrop-blur-none sm:backdrop-blur-sm rounded-none sm:rounded-2xl overflow-hidden flex flex-col md:flex-row max-w-4xl">
          {/* 左侧：品牌信息 */}
          <div className="w-full md:w-2/5 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 p-6 border-b md:border-b-0 md:border-r border-slate-800/50 flex flex-col justify-center shrink-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 shrink-0">
                <span className="text-sky-400 font-bold text-lg">U</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400/80">
                  UniID 统一认证
                </p>
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  账号登录
                </h1>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                使用统一身份账号登录，安全、快捷地访问您的所有应用。
              </p>
              <div className="pt-4 border-t border-slate-800/50 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-sky-500"></div>
                  <span className="text-[11px] text-slate-400">单点登录 (SSO)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-sky-500"></div>
                  <span className="text-[11px] text-slate-400">端到端加密保护</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：登录表单 */}
          <div className="flex-1 p-6 flex flex-col justify-center bg-slate-950/20">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    用户名
                  </label>
                  <TextInput
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="bg-slate-900/50 border-slate-800 focus:border-sky-500/50 focus:ring-sky-500/20"
                    placeholder="输入用户名"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    密码
                  </label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="bg-slate-900/50 border-slate-800 focus:border-sky-500/50 focus:ring-sky-500/20"
                    placeholder="输入密码"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-[11px] text-red-400 flex items-center gap-2">
                    {error}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <PrimaryButton
                  type="submit"
                  disabled={loading}
                  className="w-full py-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
                >
                  {loading ? "登录中..." : "登录"}
                </PrimaryButton>

                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (redirectTo) params.set("redirectTo", redirectTo);
                      if (appId) params.set("app_id", appId);
                      router.push(`/register?${params.toString()}`);
                    }}
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    注册新账号
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Card>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-xs text-slate-500">正在加载登录页面...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

