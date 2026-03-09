"use client";

import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { LogoutButton } from "@/components/LogoutButton";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardUser = {
  id: string;
  username: string;
  role: string;
};

type DashboardStats = {
  appCount: number;
  authorizationCount: number;
  activeSessionCount: number;
  lastLoginAt: number | null;
};

export default function DashboardPage() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [showIllegalAccess, setShowIllegalAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    valid: boolean;
    user: DashboardUser | null;
    stats: DashboardStats | null;
  }>({
    valid: false,
    user: null,
    stats: null
  });

  useEffect(() => {
    // 检测是否被嵌入
    const embedded = window.self !== window.top;
    setIsEmbedded(embedded);

    if (embedded) {
      setShowIllegalAccess(true);
      setLoading(false);
      
      // 2s 后触发取消事件
      const timer = setTimeout(() => {
        window.parent.postMessage({ type: "uniid_login_cancel" }, "*");
      }, 2000);
      
      return () => clearTimeout(timer);
    }

    // 如果不是嵌入模式，则获取数据
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/data"); // 假设有一个合并的 API 或者是分步获取
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isEmbedded && showIllegalAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50 p-6">
        <Card className="max-w-md w-full p-8 border-red-500/20 bg-red-500/5 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-red-400">非法访问</h1>
          <p className="text-sm text-slate-400">后台管理页面不允许在嵌入式窗口中显示。</p>
          <div className="pt-2">
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 animate-[progress_2s_linear]"></div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">正在自动返回...</p>
          <style jsx>{`
            @keyframes progress {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const { valid, user, stats } = data;

  return (
    <main className="w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <Card className="space-y-8 bg-slate-900/50 border-slate-800 backdrop-blur-sm">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
              控制台
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              UniID 控制台
            </h1>
            <p className="text-sm text-slate-400">
              管理你的账户、应用授权与数据访问，会话与安全设置将在此统一呈现。
            </p>
          </div>
          {valid && user && (
            <div className="flex items-start gap-4 text-sm text-slate-300 bg-slate-800/30 p-3 rounded-xl border border-slate-800/50">
              <div className="space-y-1">
                <p className="flex items-center gap-2">
                  <span className="text-slate-500">用户:</span>
                  <span className="font-mono text-sky-400">{user.username}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-slate-500">角色:</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                    {user.role}
                  </span>
                </p>
                {stats?.lastLoginAt && (
                  <p className="text-[10px] text-slate-500">
                    最近登录: {new Date(stats.lastLoginAt * 1000).toLocaleString("zh-CN")}
                  </p>
                )}
              </div>
              <LogoutButton />
            </div>
          )}
        </header>

        {!valid || !user ? (
          <section className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-slate-300">当前未检测到有效登录状态</p>
              <p className="text-sm text-slate-500">
                请先在<Link href="/login" className="text-sky-400 hover:underline mx-1">登录页面</Link>完成登录。
              </p>
            </div>
          </section>
        ) : (
          <>
            {stats && (
              <section className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">
                  数据总览
                </h2>
                <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700">
                    <p className="text-slate-500 font-medium">管理的应用</p>
                    <p className="mt-2 text-3xl font-bold text-slate-50">
                      {stats.appCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700">
                    <p className="text-slate-500 font-medium">有效授权</p>
                    <p className="mt-2 text-3xl font-bold text-slate-50">
                      {stats.authorizationCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700">
                    <p className="text-slate-500 font-medium">活跃会话</p>
                    <p className="mt-2 text-3xl font-bold text-slate-50">
                      {stats.activeSessionCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700">
                    <p className="text-slate-500 font-medium">账户安全</p>
                    <p className="mt-2 text-3xl font-bold text-green-400">
                      {stats.activeSessionCount > 0 ? "正常" : "待登录"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            <div className="pt-4">
              <DashboardTabs />
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

