"use client";

import { useEffect, useState } from "react";
import { SecondaryButton, PrimaryButton } from "@/components/ui/button";

type ConfigMap = Record<string, string>;

export function AdminConfigSection() {
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function loadConfigs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (!res.ok) throw new Error("加载配置失败");
      const data = await res.json();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfigs();
  }, []);

  async function updateConfig(key: string, value: string) {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("保存失败");
      await loadConfigs();
    } catch (err: any) {
      setError(err.message ?? "保存失败");
    } finally {
      setSaving(null);
    }
  }

  const registrationEnabled = configs["registration_enabled"] !== "false";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">全局设置 (管理员)</h2>
          <p className="text-xs text-slate-500">管理 UniID 系统的全局运行参数。</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => setError(null)}>关闭</button>
        </p>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
        {loading ? (
          <p>正在加载配置...</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 last:border-0 last:pb-0">
              <div className="space-y-1">
                <p className="font-medium text-slate-100">开放用户注册</p>
                <p className="text-[11px] text-slate-500">
                  关闭后，新用户将无法通过注册页面创建账户。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] ${registrationEnabled ? 'text-green-400' : 'text-red-400'}`}>
                  {registrationEnabled ? '已开启' : '已关闭'}
                </span>
                <SecondaryButton
                  disabled={saving === "registration_enabled"}
                  onClick={() => updateConfig("registration_enabled", registrationEnabled ? "false" : "true")}
                  className="h-7 px-3 text-[10px]"
                >
                  {saving === "registration_enabled" ? "处理中..." : (registrationEnabled ? "立即关闭" : "立即开启")}
                </SecondaryButton>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-4 last:border-0 last:pb-0">
              <div className="space-y-1">
                <p className="font-medium text-slate-100">系统维护模式</p>
                <p className="text-[11px] text-slate-500">
                  开启后，除管理员外所有用户将无法登录和使用 API。 (功能预留)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500">已关闭</span>
                <SecondaryButton disabled className="h-7 px-3 text-[10px] opacity-50">
                  开启
                </SecondaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
