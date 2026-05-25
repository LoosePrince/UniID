"use client";

/**
 * UniID Embed 授权页（米色版）
 *
 * 协议（与 SDK 严格同步，不变）：
 *   parent → iframe : { type: "uniid_authorize_request", appId }
 *   iframe → parent : { type: "uniid_ready", appId }              // 子端就绪
 *   iframe → parent : { type: "uniid_login_success", token, ... }
 *   iframe → parent : { type: "uniid_login_cancel", appId }
 *   iframe → parent : { type: "uniid_resize", height }
 *
 * 可信链：parent_origin 仅取自浏览器生成的 event.origin，不信任 URL/event.data。
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Globe, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button, Spinner } from "@/ui/primitives";

type Step = "boot" | "checking" | "needs_login" | "ready_to_authorize" | "authorizing" | "done" | "cancelled" | "error";

interface UserShape {
  id: string;
  username: string;
  role: string;
  displayName?: string | null;
}
interface AppShape {
  id: string;
  name: string;
  description: string | null;
  primaryDomain: string;
}

function EmbedView() {
  const params = useSearchParams();
  const appId = params.get("app_id") ?? "";

  const [parentOrigin, setParentOrigin] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("boot");
  const [user, setUser] = useState<UserShape | null>(null);
  const [app, setApp] = useState<AppShape | null>(null);
  const [authType, setAuthType] = useState<"full" | "restricted">("restricted");
  const [error, setError] = useState<string | null>(null);
  const [showAuthTypeChoice, setShowAuthTypeChoice] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Auto resize broadcast to parent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = contentRef.current;
    if (!el) return;
    const report = () => {
      const card = el.querySelector("[data-card]") as HTMLElement | null;
      const height = card ? card.getBoundingClientRect().height : el.scrollHeight;
      window.parent.postMessage({ type: "uniid_resize", height }, "*");
    };
    report();
    const ro = new ResizeObserver(() => requestAnimationFrame(report));
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  // Initial auth check + listen for SDK handshake.
  useEffect(() => {
    if (!appId) return;
    let cancelled = false;

    async function check() {
      setStep("checking");
      setError(null);
      try {
        const res = await fetch(`/api/v1/auth/check?app_id=${encodeURIComponent(appId)}`, {
          credentials: "include"
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (data?.app) setApp(data.app);

        if (res.ok && data?.valid && data?.user) {
          setUser(data.user);
          // 系统管理员或应用管理员可以选完整授权
          const showChoice = data.user.role === "admin";
          // 也可以再请求应用成员列表得知是不是 app admin（M5+ 加），这里简化
          setShowAuthTypeChoice(showChoice);
          setStep("ready_to_authorize");
        } else {
          setStep("needs_login");
        }
      } catch {
        if (!cancelled) setStep("error");
      }
    }

    function onMessage(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "uniid_authorize_request" && typeof ev.origin === "string") {
        setParentOrigin(ev.origin);
      }
    }
    window.addEventListener("message", onMessage);
    check();
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [appId]);

  // 当进入 ready_to_authorize 时，广播 ready
  useEffect(() => {
    if (step === "ready_to_authorize") {
      window.parent.postMessage({ type: "uniid_ready", appId }, "*");
    }
  }, [step, appId]);

  function goLogin() {
    const back = `/embed?app_id=${encodeURIComponent(appId)}`;
    window.location.href = `/login?redirectTo=${encodeURIComponent(back)}`;
  }

  async function onAuthorize() {
    if (!parentOrigin) {
      setError("未能确认父页面来源，请刷新重试");
      return;
    }
    setStep("authorizing");
    try {
      const res = await fetch("/api/v1/auth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          app_id: appId,
          auth_type: authType,
          parent_origin: parentOrigin
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "授权失败");
        setStep("ready_to_authorize");
        return;
      }
      window.parent.postMessage(
        {
          type: "uniid_login_success",
          token: data.token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          user: data.user,
          app_id: data.app_id,
          auth_type: data.auth_type
        },
        parentOrigin
      );
      setStep("done");
    } catch {
      setError("网络错误");
      setStep("ready_to_authorize");
    }
  }

  function onCancel() {
    if (parentOrigin) {
      window.parent.postMessage({ type: "uniid_login_cancel", app_id: appId }, parentOrigin);
    }
    setStep("cancelled");
  }

  if (!appId) {
    return (
      <div className="h-full bg-cream-50 flex items-center justify-center p-4">
        <div data-card className="bg-white border border-ink-100 rounded-lg p-6 max-w-sm text-center shadow-sm">
          <Lock className="h-5 w-5 mx-auto text-ink-400" />
          <p className="text-sm mt-3 text-ink-700">缺少必须参数 <code className="font-mono text-2xs">app_id</code></p>
        </div>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="min-h-full bg-cream-50 flex items-center justify-center p-0 md:p-4">
      <div
        data-card
        className="w-full md:max-w-3xl bg-white md:rounded-lg md:border md:border-ink-100 md:shadow-md overflow-hidden flex flex-col md:flex-row min-h-full md:min-h-0"
      >
        {/* Left: app info */}
        <aside className="md:w-2/5 bg-cream-100 border-b md:border-b-0 md:border-r border-ink-100 p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-md bg-ink-900 text-cream-50 flex items-center justify-center font-bold text-xs">U</span>
            <span className="text-2xs uppercase tracking-wider font-medium text-ink-500">UniID 授权</span>
          </div>
          {app ? (
            <div className="space-y-3">
              <h1 className="text-xl font-semibold text-ink-900 tracking-tight">{app.name}</h1>
              <p className="text-sm text-ink-600 leading-relaxed line-clamp-4">
                {app.description || "该应用未提供描述。"}
              </p>
              <div className="pt-3 border-t border-ink-200/60 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-ink-500">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="font-mono text-ink-700">{app.primaryDomain}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>由 UniID 验证签发</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-2/3 bg-ink-100 rounded" />
              <div className="h-3 bg-ink-100 rounded" />
              <div className="h-3 w-3/4 bg-ink-100 rounded" />
            </div>
          )}
        </aside>

        {/* Right: actions */}
        <section className="flex-1 p-6 flex flex-col justify-center min-h-[260px]">
          {step === "checking" && (
            <div className="flex flex-col items-center justify-center gap-3 text-ink-500 py-12">
              <Spinner />
              <p className="text-xs">正在校验登录态…</p>
            </div>
          )}

          {step === "needs_login" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-md font-semibold text-ink-900">登录以继续</h2>
                <p className="text-xs text-ink-500 mt-1">该应用请求访问你的 UniID 账户。</p>
              </div>
              <Button onClick={goLogin} className="w-full" size="lg">
                登录 UniID
              </Button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-xs text-ink-400 hover:text-ink-600 transition-colors"
              >
                拒绝并返回
              </button>
            </div>
          )}

          {step === "ready_to_authorize" && user && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                onAuthorize();
              }}
            >
              <div className="flex items-center gap-3 p-3 rounded-md bg-cream-100 border border-ink-100">
                <div className="h-9 w-9 rounded-full bg-ink-900 text-cream-50 flex items-center justify-center text-sm font-semibold">
                  {(user.displayName ?? user.username).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-2xs uppercase tracking-wider text-ink-400 font-medium">当前账号</p>
                  <p className="text-sm font-medium text-ink-900 truncate">{user.displayName ?? user.username}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-ink-600">该应用将获得：</p>
                <ul className="space-y-1.5 text-xs text-ink-700">
                  <li className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5 text-ink-400" />
                    访问你的用户名与 ID
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ink-400" />
                    在你的授权范围内读写数据与文件
                  </li>
                </ul>
              </div>

              {showAuthTypeChoice && (
                <div className="space-y-2">
                  <p className="text-2xs uppercase tracking-wider font-medium text-ink-400">授权范围</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["restricted", "full"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAuthType(t)}
                        className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                          authType === t
                            ? "border-ink-900 bg-ink-900 text-cream-50"
                            : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
                        }`}
                      >
                        {t === "restricted" ? "限制（推荐）" : "完整"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-danger-600 bg-danger-50 border border-danger-100 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Button type="submit" size="lg" className="w-full" disabled={!parentOrigin}>
                  同意并授权
                </Button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full text-xs text-ink-400 hover:text-ink-600 transition-colors py-1"
                >
                  拒绝并返回
                </button>
              </div>

              {!parentOrigin && (
                <p className="text-2xs text-ink-400 text-center">等待父页面建立连接…</p>
              )}
            </form>
          )}

          {step === "authorizing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-500">
              <Spinner />
              <p className="text-xs">正在签发授权…</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="h-10 w-10 rounded-full bg-success-50 border border-success-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success-500" />
              </div>
              <p className="text-sm font-medium text-ink-900">授权完成</p>
              <p className="text-xs text-ink-500">返回应用即可继续。</p>
            </div>
          )}

          {step === "cancelled" && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm text-ink-700">已取消</p>
              <p className="text-xs text-ink-500">你可以关闭此窗口。</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm text-danger-700">出错了</p>
              <p className="text-xs text-ink-500">请刷新重试。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-cream-50">
          <Spinner />
        </div>
      }
    >
      <EmbedView />
    </Suspense>
  );
}
