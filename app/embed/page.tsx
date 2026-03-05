"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Step = "idle" | "checking" | "authorize" | "done";

interface EmbedUser {
  id: string;
  username: string;
  role: string;
}

export default function EmbedPage() {
  const searchParams = useSearchParams();
  const appId = searchParams.get("app_id") ?? "";
  // 从 URL 参数中恢复 parentOrigin（登录后返回时使用）
  const parentOriginFromUrl = searchParams.get("parent_origin");

  const [step, setStep] = useState<Step>("idle");
  const [user, setUser] = useState<EmbedUser | null>(null);
  const [isAppAdmin, setIsAppAdmin] = useState<boolean>(false);
  const [parentOrigin, setParentOrigin] = useState<string | null>(parentOriginFromUrl);
  const [authType, setAuthType] = useState<"full" | "restricted">("restricted");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 如果从登录页面返回（URL中有parent_origin参数），自动开始检查登录状态
    if (parentOriginFromUrl && appId) {
      void checkLoginAndMaybeRedirect();
    }

    async function checkLoginAndMaybeRedirect() {
      if (!appId) return;
      setStep("checking");
      setError(null);
      try {
        const res = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include"
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            setUser({
              id: data.user.id,
              username: data.user.username,
              role: data.user.role
            });
            // 查询用户是否是该应用的管理员
            const adminRes = await fetch(`/api/app/${appId}/admin-check`, {
              method: "GET",
              credentials: "include"
            });
            if (adminRes.ok) {
              const adminData = await adminRes.json();
              setIsAppAdmin(adminData.isAdmin || false);
              // 如果是应用管理员，默认使用 restricted 授权
              if (adminData.isAdmin || data.user.role === "admin") {
                setAuthType("restricted");
              }
            }
            setStep("authorize");
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }

      // 将 parentOrigin 传递给登录页面，以便登录后返回时能恢复
      const redirectTo = `/embed?app_id=${encodeURIComponent(appId)}&parent_origin=${encodeURIComponent(parentOrigin || '')}`;
      window.location.href = `/login?redirectTo=${encodeURIComponent(
        redirectTo
      )}`;
    }

    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;

      // 如果没有从 URL 获取到 parentOrigin，则从 message 中获取
      if (!parentOrigin && !parentOriginFromUrl) {
        setParentOrigin(event.origin);
      } else if (event.origin !== (parentOrigin || parentOriginFromUrl)) {
        return;
      }

      if (event.data.type === "uniid_open_login") {
        void checkLoginAndMaybeRedirect();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [appId, parentOrigin, parentOriginFromUrl]);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (!appId) {
      setError("缺少 app_id 参数");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          app_id: appId,
          auth_type: authType
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

  if (!appId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
        <div className="rounded-lg bg-slate-900 px-6 py-4 text-sm">
          <p>缺少必须的查询参数：app_id。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-lg bg-slate-900 px-6 py-5 text-sm shadow-xl shadow-slate-900/60">
        <h1 className="mb-1 text-base font-semibold">
          UniID 授权中心
        </h1>
        <p className="mb-4 text-xs text-slate-400">
          站点 <span className="font-mono text-sky-300">{appId}</span>{" "}
          正在请求访问你的账户数据。
        </p>

        {step === "checking" && (
          <div className="space-y-2 text-xs text-slate-300">
            <p>正在检查登录状态，请稍候...</p>
          </div>
        )}

        {step === "authorize" && (
          <form onSubmit={handleAuthorize} className="space-y-3">
            <p className="text-xs text-slate-300">
              第二步：授权站点访问你的数据。
            </p>
            {user && (
              <p className="text-xs text-slate-400">
                当前登录用户：{" "}
                <span className="font-mono text-sky-300">
                  {user.username}
                </span>
              </p>
            )}
            {(user?.role === "admin" || isAppAdmin) && (
              <div className="space-y-1">
                <p className="text-xs text-slate-300">授权类型</p>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="radio"
                    name="authType"
                    value="full"
                    checked={authType === "full"}
                    onChange={() => setAuthType("full")}
                  />
                  完整授权（账户级权限）
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="radio"
                    name="authType"
                    value="restricted"
                    checked={authType === "restricted"}
                    onChange={() => setAuthType("restricted")}
                  />
                  限制授权（仅数据级权限）
                </label>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? "授权中..." : "同意并授权"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-2 text-xs text-slate-300">
            <p>授权已完成，可以关闭此窗口。</p>
          </div>
        )}

        {step === "idle" && (
          <div className="space-y-2 text-xs text-slate-300">
            <p>请从集成了 UniID SDK 的站点中点击“登录 / 授权”按钮。</p>
          </div>
        )}
      </div>
    </div>
  );
}

