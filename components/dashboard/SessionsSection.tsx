"use client";

import { useEffect, useState } from "react";
import { SecondaryButton } from "@/components/ui/button";

type SessionItem = {
  id: string;
  createdAt: number;
  lastActivity: number | null;
  expiresAt: number;
  userAgent: string | null;
  is_current: boolean;
  is_active: boolean;
};

function formatTimestamp(ts: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString("zh-CN");
  } catch {
    return "—";
  }
}

export function SessionsSection() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionAllLoading, setActionAllLoading] = useState(false);

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "GET",
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "加载会话列表失败");
        return;
      }
      const data = (await res.json()) as { sessions: SessionItem[] };
      setSessions(data.sessions ?? []);
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function revokeSession(id: string) {
    setActioningId(id);
    setError(null);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ session_id: id })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "注销会话失败");
        return;
      }
      await loadSessions();
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setActioningId(null);
    }
  }

  async function revokeAllOthers() {
    setActionAllLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ all: true })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "注销其它设备失败");
        return;
      }
      await loadSessions();
    } catch (err) {
      console.error(err);
      setError("网络错误，请稍后重试");
    } finally {
      setActionAllLoading(false);
    }
  }

  const hasOtherSessions =
    sessions.filter((s) => !s.is_current && s.is_active).length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            登录会话管理
          </h2>
          <p className="text-xs text-slate-500">
            查看当前账户的各终端登录状态，并可注销异常或不再使用的会话。
          </p>
        </div>
        <SecondaryButton
          onClick={revokeAllOthers}
          disabled={actionAllLoading || !hasOtherSessions}
          className="border-red-500/60 text-red-300 hover:border-red-400 hover:text-red-200"
        >
          {actionAllLoading ? "处理中..." : "注销所有其它设备"}
        </SecondaryButton>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
        {loading && <p>正在加载会话列表...</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-slate-500">当前没有记录到任何登录会话。</p>
        )}
        {!loading &&
          sessions.map((session) => {
            const isCurrent = session.is_current;
            const isActive = session.is_active;
            const ua =
              session.userAgent && session.userAgent.length > 60
                ? session.userAgent.slice(0, 57) + "..."
                : session.userAgent;

            return (
              <div
                key={session.id}
                className="flex flex-col gap-1 border-b border-slate-800 pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-200">
                      {formatTimestamp(session.createdAt)}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        当前设备
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "bg-sky-600/20 text-sky-300"
                          : "bg-slate-700/40 text-slate-400"
                      }`}
                    >
                      {isActive ? "活跃" : "已过期"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    最近活动：{formatTimestamp(session.lastActivity)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    设备信息：{ua ?? "未知设备"}
                  </p>
                </div>
                {!isCurrent && (
                  <div className="pt-1 sm:pt-0">
                    <SecondaryButton
                      onClick={() => revokeSession(session.id)}
                      disabled={actioningId === session.id}
                      className="border-red-500/60 text-red-300 hover:border-red-400 hover:text-red-200"
                    >
                      {actioningId === session.id ? "注销中..." : "注销会话"}
                    </SecondaryButton>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}

