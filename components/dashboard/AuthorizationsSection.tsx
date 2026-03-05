"use client";

import { useEffect, useState } from "react";
import { SecondaryButton } from "@/components/ui/button";

type AuthorizationItem = {
  id: string;
  appId: string;
  appName: string;
  domain: string | null;
  authType: string;
  grantedAt: number;
  expiresAt: number | null;
};

function formatTimestamp(ts: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString("zh-CN");
  } catch {
    return "—";
  }
}

export function AuthorizationsSection() {
  const [items, setItems] = useState<AuthorizationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function loadAuthorizations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/authorizations", {
        method: "GET",
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "加载授权列表失败");
        return;
      }
      const data = (await res.json()) as {
        authorizations: AuthorizationItem[];
      };
      setItems(data.authorizations ?? []);
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuthorizations();
  }, []);

  async function revokeAuthorization(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch("/api/auth/authorizations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ authorization_id: id })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "撤销授权失败");
        return;
      }
      await loadAuthorizations();
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            应用授权管理
          </h2>
          <p className="text-xs text-slate-500">
            查看当前账户已授权的应用，并可随时撤销不再信任的站点访问权限。
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
        {loading && <p>正在加载应用授权...</p>}
        {!loading && items.length === 0 && (
          <p className="text-slate-500">
            暂未对任何应用授予访问权限。通过集成了 UniID SDK 的站点完成登录后，将在此看到授权记录。
          </p>
        )}
        {!loading &&
          items.map((item) => {
            const authLabel =
              item.authType === "full" ? "账户级（full）" : "数据级（restricted）";
            return (
              <div
                key={item.id}
                className="flex flex-col gap-1 border-b border-slate-800 pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-100">
                      {item.appName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {item.appId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    域名：{item.domain ?? "未配置"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-sky-600/20 px-2 py-0.5 text-sky-300">
                      {authLabel}
                    </span>
                    <span className="text-slate-400">
                      授权时间：{formatTimestamp(item.grantedAt)}
                    </span>
                    {item.expiresAt && (
                      <span className="text-slate-500">
                        过期时间：{formatTimestamp(item.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-1 sm:pt-0">
                  <SecondaryButton
                    onClick={() => revokeAuthorization(item.id)}
                    disabled={revokingId === item.id}
                    className="border-red-500/60 text-red-300 hover:border-red-400 hover:text-red-200"
                  >
                    {revokingId === item.id ? "撤销中..." : "撤销授权"}
                  </SecondaryButton>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

