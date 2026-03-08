"use client";

import { AuthorizationsSection } from "@/components/dashboard/AuthorizationsSection";
import { ChangePasswordSection } from "@/components/dashboard/ChangePasswordSection";
import { SessionsSection } from "@/components/dashboard/SessionsSection";
import { AdminAppsSection } from "@/components/dashboard/AdminAppsSection";
import { AdminUsersSection } from "@/components/dashboard/AdminUsersSection";
import { AdminConfigSection } from "@/components/dashboard/AdminConfigSection";
import { AppSettingsSection } from "@/components/dashboard/AppSettingsSection";
import { useEffect, useState } from "react";

type TabKey = "security" | "sessions" | "authorizations" | "admin-apps" | "admin-users" | "admin-config" | "app-settings";

interface Tab {
  key: TabKey;
  label: string;
  description: string;
  role?: "admin" | "app-admin";
}

const tabs: Tab[] = [
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
  },
  {
    key: "app-settings",
    label: "应用设置",
    description: "管理你所负责的应用信息、DataSchema 及验证规则。",
    role: "app-admin"
  },
  {
    key: "admin-apps",
    label: "应用管理",
    description: "管理系统中的所有应用及其所有者。",
    role: "admin"
  },
  {
    key: "admin-users",
    label: "账户管理",
    description: "管理系统中的所有用户账户及其状态。",
    role: "admin"
  },
  {
    key: "admin-config",
    label: "全局设置",
    description: "管理 UniID 系统的全局运行参数。",
    role: "admin"
  }
];

export function DashboardTabs() {
  const [active, setActive] = useState<TabKey>("authorizations");
  const [userRole, setUserRole] = useState<string>("user");
  const [isAppAdmin, setIsAppAdmin] = useState<boolean>(false);

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await fetch("/api/auth/check");
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.user.role);
          
          // 检查是否有可管理的应用（应用管理员或 UniID 管理员）
          const managedRes = await fetch("/api/apps/managed");
          if (managedRes.ok) {
            const list = await managedRes.json();
            setIsAppAdmin(Array.isArray(list) && list.length > 0);
          }
        }
      } catch (err) {
        console.error("检查角色失败", err);
      }
    }
    void checkRole();
  }, []);

  const visibleTabs = tabs.filter(tab => {
    if (!tab.role) return true;
    if (tab.role === "admin") return userRole === "admin";
    if (tab.role === "app-admin") return userRole === "admin" || isAppAdmin;
    return false;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {visibleTabs.map((tab) => (
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
      {active === "admin-apps" && <AdminAppsSection />}
      {active === "admin-users" && <AdminUsersSection />}
      {active === "admin-config" && <AdminConfigSection />}
      {active === "app-settings" && <AppSettingsSection />}
    </section>
  );
}

