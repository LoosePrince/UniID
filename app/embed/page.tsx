"use client";

import { PrimaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Step = "idle" | "checking" | "authorize" | "done";

interface EmbedUser {
  id: string;
  username: string;
  role: string;
}

interface EmbedApp {
  id: string;
  name: string;
  description: string | null;
  domain: string;
}

function EmbedPageContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get("app_id") ?? "";
  // parentOrigin 仅从 postMessage 的 event.origin 获取（浏览器生成，可信），不使用 URL 或 event.data
  const [parentOrigin, setParentOrigin] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [user, setUser] = useState<EmbedUser | null>(null);
  const [app, setApp] = useState<EmbedApp | null>(null);
  const [isAppAdmin, setIsAppAdmin] = useState<boolean>(false);
  const [authType, setAuthType] = useState<"full" | "restricted">("restricted");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkLoginAndMaybeRedirect(verifiedParentOrigin: string) {
      console.log("[Embed] checkLoginAndMaybeRedirect started", { appId, verifiedParentOrigin, currentStep: step });
      if (!appId || !verifiedParentOrigin) {
        console.warn("[Embed] Missing appId or verifiedParentOrigin", { appId, verifiedParentOrigin });
        return;
      }

      if (step !== "idle") {
        console.log("[Embed] Skipping check, already in progress or done", { step });
        return;
      }

      setStep("checking");
      setError(null);
      try {
        const checkUrl = `/api/auth/check?app_id=${encodeURIComponent(appId)}`;
        console.log("[Embed] Fetching auth check", checkUrl);
        const res = await fetch(checkUrl, {
          method: "GET",
          credentials: "include"
        });
        console.log("[Embed] Auth check response", { ok: res.ok, status: res.status });

        if (!isMounted) {
          console.log("[Embed] Component unmounted during fetch (but we will proceed if step is checking)");
        }

        if (res.ok) {
          const data = await res.json();
          console.log("[Embed] Auth check data", data);
          if (data.valid && data.user) {
            setUser(data.user);
            if (data.app) {
              setApp(data.app);
            }

            try {
              const adminUrl = `/api/app/${appId}`;
              const adminRes = await fetch(adminUrl, {
                method: "GET",
                credentials: "include"
              });
              if (adminRes.ok) {
                const adminData = await adminRes.json();
                setIsAppAdmin(adminData.isAdmin || false);
                if (adminData.isAdmin || data.user.role === "admin") {
                  setAuthType("restricted");
                }
              }
            } catch (e) {
              console.error("[Embed] Admin check failed", e);
            }

            console.log("[Embed] Setting step to authorize");
            setStep("authorize");

            // 发送高度更新消息给父页面
            setTimeout(() => {
              const content = document.getElementById("auth-content");
              if (content) {
                // 获取卡片的实际渲染高度
                const card = content.querySelector('.rounded-2xl') || content.firstElementChild;
                const height = card ? card.getBoundingClientRect().height : content.scrollHeight;
                console.log("[Embed] Reporting height", height);
                window.parent.postMessage({ type: "uniid_resize", height: height }, "*");
              }
            }, 300);
            return;
          }
        }
      } catch (err) {
        console.error("[Embed] Error during auth check", err);
      }

      console.log("[Embed] Redirecting to login");
      const redirectTo = `/embed?app_id=${encodeURIComponent(appId)}`;
      window.location.href = `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
    }

    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;
      const msgType = event.data.type;
      if (msgType !== "uniid_init" && msgType !== "uniid_open_login") return;

      console.log("[Embed] Received message", msgType, "from", event.origin);

      const originFromBrowser = event.origin;
      if (!originFromBrowser) return;

      if (parentOrigin !== originFromBrowser) {
        setParentOrigin(originFromBrowser);
      }
      void checkLoginAndMaybeRedirect(originFromBrowser);
    }

    window.addEventListener("message", handleMessage);
    return () => {
      console.log("[Embed] useEffect cleanup (unmounting)");
      isMounted = false;
      window.removeEventListener("message", handleMessage);
    };
  }, [appId, parentOrigin, step]);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (!appId || !parentOrigin) {
      setError(!parentOrigin ? "未获取到父页面来源，请刷新后重试" : "缺少 app_id 参数");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          auth_type: authType,
          parent_origin: parentOrigin
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "授权失败");
        setLoading(false);
        return;
      }
      const data = await res.json();

      if (parentOrigin) {
        window.parent.postMessage(
          {
            type: "uniid_login_success",
            token: data.token,
            user: data.user,
            app_id: data.app_id,
            auth_type: data.auth_type
          },
          parentOrigin
        );
      }

      setStep("done");
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handleCancelAuthorize() {
    setCancelled(true);
    setStep("idle");
    if (parentOrigin) {
      window.parent.postMessage(
        {
          type: "uniid_login_cancel",
          app_id: appId
        },
        parentOrigin
      );
    }
  }

  if (!appId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
        <main className="w-full max-w-md">
          <Card className="space-y-2 text-sm">
            <h1 className="text-base font-semibold text-slate-50">
              UniID 授权中心
            </h1>
            <p className="text-xs text-slate-400">
              缺少必须的查询参数：<span className="font-mono">app_id</span>。
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full min-h-screen items-center justify-center bg-slate-950 text-slate-50 overflow-hidden">
      <main id="auth-content" className="w-full h-full flex items-center justify-center">
        <Card className="w-full h-full border-none sm:border-slate-800 bg-slate-950 sm:bg-slate-900/50 shadow-none sm:shadow-2xl backdrop-blur-none sm:backdrop-blur-sm rounded-none sm:rounded-2xl overflow-hidden flex flex-col md:flex-row">
          {/* 左侧/顶部：应用信息 */}
          <div className="w-full md:w-2/5 bg-gradient-to-br from-sky-500/10 to-indigo-500/10 p-6 border-b md:border-b-0 md:border-r border-slate-800/50 flex flex-col justify-center shrink-0 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none md:rounded-br-none">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 shrink-0">
                <span className="text-sky-400 font-bold text-lg">U</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400/80">
                  UniID 授权中心
                </p>
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  账号登录授权
                </h1>
              </div>
            </div>

            {app ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    {app.name}
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium whitespace-nowrap">
                      第三方应用
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 md:line-clamp-none">
                    {app.description || "该应用暂无描述"}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-medium">域名</span>
                    <span className="text-[11px] font-mono text-slate-300 truncate max-w-[150px]">{app.domain}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-medium">应用 ID</span>
                    <span className="text-[11px] font-mono text-slate-300 truncate max-w-[150px]">{app.id}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 w-24 bg-slate-800 rounded"></div>
                <div className="h-20 bg-slate-800/50 rounded-xl"></div>
              </div>
            )}
          </div>

          {/* 右侧/底部：操作区域 */}
          <div className="flex-1 p-6 flex flex-col justify-center bg-slate-950/20 rounded-b-2xl md:rounded-r-2xl md:rounded-tl-none md:rounded-bl-none">
            {step === "checking" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-8 w-8 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400">正在安全检查，请稍候...</p>
              </div>
            )}

            {step === "authorize" && (
              <form onSubmit={handleAuthorize} className="space-y-6">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-800/50">
                    <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 shrink-0">
                      {user?.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 font-medium uppercase">当前登录账号</p>
                      <p className="text-sm font-medium text-slate-200 truncate">{user?.username}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-400 px-1">申请权限：</p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800/50">
                        <div className="h-1.5 w-1.5 rounded-full bg-sky-500"></div>
                        <p className="text-[11px] text-slate-300">访问基础公开信息（用户名、ID）</p>
                      </div>
                    </div>
                  </div>

                  {(user?.role === "admin" || isAppAdmin) && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-slate-400 px-1">授权范围</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAuthType("restricted")}
                          className={`flex-1 p-2.5 rounded-xl border text-center transition-all ${authType === "restricted"
                            ? "border-sky-500 bg-sky-500/10 text-sky-400"
                            : "border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700"
                            }`}
                        >
                          <span className="text-[11px] font-bold">限制</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthType("full")}
                          className={`flex-1 p-2.5 rounded-xl border text-center transition-all ${authType === "full"
                            ? "border-sky-500 bg-sky-500/10 text-sky-400"
                            : "border-slate-800 bg-slate-950/50 text-slate-500 hover:border-slate-700"
                            }`}
                        >
                          <span className="text-[11px] font-bold">完整</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-[11px] text-red-400 flex items-center gap-2">
                      {error}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <PrimaryButton
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]"
                  >
                    {loading ? "正在授权..." : "同意并授权"}
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={handleCancelAuthorize}
                    disabled={loading}
                    className="w-full py-2 text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    拒绝并返回
                  </button>
                </div>
              </form>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                  <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">授权成功</h3>
                  <p className="text-xs text-slate-400">正在跳转回应用...</p>
                </div>
              </div>
            )}

            {step === "idle" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                {cancelled ? (
                  <p className="text-xs text-slate-400">已取消授权</p>
                ) : (
                  <p className="text-xs text-slate-400">请在应用中继续</p>
                )}
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
          <main className="w-full max-w-md p-4">
            <Card className="space-y-2 text-sm p-6 bg-slate-900 border-slate-800">
              <h1 className="text-base font-semibold text-slate-50">
                UniID 授权中心
              </h1>
              <p className="text-xs text-slate-400">正在加载授权页面...</p>
            </Card>
          </main>
        </div>
      }
    >
      <EmbedPageContent />
    </Suspense>
  );
}
