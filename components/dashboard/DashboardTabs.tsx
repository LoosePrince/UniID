"use client";

import { AuthorizationsSection } from "@/components/dashboard/AuthorizationsSection";
import { ChangePasswordSection } from "@/components/dashboard/ChangePasswordSection";
import { SessionsSection } from "@/components/dashboard/SessionsSection";
import { useState } from "react";

type TabKey = "security" | "sessions" | "authorizations";

const tabs: { key: TabKey; label: string; description: string }[] = [
  {
    key: "authorizations",
    label: "应用授权",
    description: "管理已授权应用的访问权限。"
  },
  {
    key: "security",
    label: "密码与安全",
    description: "修改账户密码，提升账号安全性。"
  },
  {
    key: "sessions",
    label: "登录会话",
    description: "查看并管理各终端登录会话。"
  }
];

export function DashboardTabs() {
  const [active, setActive] = useState<TabKey>("authorizations");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`rounded-full px-3 py-1 font-medium transition ${active === tab.key
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          {tabs.find((t) => t.key === active)?.description}
        </p>
      </div>

      {active === "security" && <ChangePasswordSection />}
      {active === "sessions" && <SessionsSection />}
      {active === "authorizations" && <AuthorizationsSection />}
    </section>
  );
}

