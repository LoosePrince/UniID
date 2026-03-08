"use client";

import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { useEffect, useState } from "react";

type AppItem = {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  ownerId: string;
  status: string;
  createdAt: number;
  owner: {
    id: string;
    username: string;
  };
  admins: {
    user: {
      id: string;
      username: string;
    };
  }[];
};

type UserOption = { id: string; username: string };

export function AdminAppsSection() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);
  const [adminIdsInput, setAdminIdsInput] = useState("");
  const [showAddApp, setShowAddApp] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", domain: "", description: "", ownerId: "" });
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function loadApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/apps");
      if (!res.ok) throw new Error("加载应用失败");
      const data = await res.json();
      setApps(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApps();
  }, []);

  useEffect(() => {
    if (showAddApp && userOptions.length > 0 && !addForm.ownerId) {
      setAddForm((prev) => ({ ...prev, ownerId: userOptions[0].id }));
    }
  }, [showAddApp, userOptions, addForm.ownerId]);

  async function deleteApp(appId: string) {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/apps/${appId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      setConfirmDeleteId(null);
      await loadApps();
    } catch (err: any) {
      setFeedback(err.message ?? "删除失败");
    }
  }

  async function updateAdmins() {
    if (!editingApp) return;
    const adminIds = adminIdsInput.split(",").map(id => id.trim()).filter(id => id);
    try {
      const res = await fetch(`/api/admin/apps/${editingApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminIds }),
      });
      if (!res.ok) throw new Error("更新失败");
      setEditingApp(null);
      await loadApps();
    } catch (err: any) {
      setFeedback(err.message ?? "更新失败");
    }
  }

  async function loadUserOptions() {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const list = await res.json();
      setUserOptions(list.map((u: { id: string; username: string }) => ({ id: u.id, username: u.username })));
    } catch {
      // ignore
    }
  }

  async function submitAddApp() {
    setFeedback(null);
    if (!addForm.name.trim() || !addForm.domain.trim() || !addForm.ownerId) {
      setFeedback("请填写应用名称、域名并选择所有者");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          domain: addForm.domain.trim(),
          description: addForm.description.trim() || undefined,
          ownerId: addForm.ownerId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error === "DOMAIN_TAKEN" ? "该域名已被使用" : "创建失败");
      }
      setShowAddApp(false);
      setAddForm({ name: "", domain: "", description: "", ownerId: "" });
      await loadApps();
    } catch (err: any) {
      setFeedback(err.message ?? "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">应用管理 (管理员)</h2>
          <p className="text-xs text-slate-500">管理系统中的所有应用及其所有者。</p>
        </div>
        <PrimaryButton
          className="w-auto px-4 py-1.5 text-xs"
          onClick={() => {
            setShowAddApp(true);
            setAddForm({ name: "", domain: "", description: "", ownerId: userOptions[0]?.id ?? "" });
            void loadUserOptions();
          }}
        >
          添加应用
        </PrimaryButton>
      </div>

      {(error || feedback) && (
        <p className="text-sm text-red-400">
          {error ?? feedback}
          <button type="button" className="ml-2 underline" onClick={() => { setError(null); setFeedback(null); }}>关闭</button>
        </p>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
        {loading ? (
          <p>正在加载应用列表...</p>
        ) : apps.length === 0 ? (
          <p className="text-slate-500">暂无应用。</p>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="flex flex-col gap-2 border-b border-slate-800 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">{app.name}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {app.id}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${app.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-slate-500">域名: {app.domain}</p>
                  <p className="text-slate-500">所有者: {app.owner.username} ({app.owner.id})</p>
                  <p className="text-slate-500">管理员: {app.admins.map(a => a.user.username).join(", ") || "无"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {confirmDeleteId === app.id ? (
                    <>
                      <span className="text-[10px] text-slate-400">确定要删除（软删除）此应用吗？</span>
                      <SecondaryButton className="text-[10px]" onClick={() => setConfirmDeleteId(null)}>取消</SecondaryButton>
                      <SecondaryButton className="text-[10px] border-red-500/50 text-red-400 hover:bg-red-500/10" onClick={() => deleteApp(app.id)}>确定删除</SecondaryButton>
                    </>
                  ) : (
                    <>
                      <SecondaryButton
                        className="text-[10px]"
                        onClick={() => {
                          setEditingApp(app);
                          setAdminIdsInput(app.admins.map(a => a.user.id).join(", "));
                        }}
                      >
                        编辑管理员
                      </SecondaryButton>
                      <SecondaryButton
                        className="text-[10px] border-red-500/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => setConfirmDeleteId(app.id)}
                      >
                        删除
                      </SecondaryButton>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-medium text-slate-100">编辑应用管理员</h3>
            <p className="text-xs text-slate-400">应用: {editingApp.name}</p>
            <div className="space-y-2">
              <label className="text-xs text-slate-300">管理员 ID (逗号分隔)</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                value={adminIdsInput}
                onChange={(e) => setAdminIdsInput(e.target.value)}
                placeholder="user_id1, user_id2"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setEditingApp(null)}>取消</SecondaryButton>
              <PrimaryButton className="w-auto px-6" onClick={updateAdmins}>保存</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {showAddApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-medium text-slate-100">添加应用</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">应用名称</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="例如：我的站点"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">域名</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.domain}
                  onChange={(e) => setAddForm({ ...addForm, domain: e.target.value })}
                  placeholder="例如：example.com 或 localhost:3000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">描述（选填）</label>
                <textarea
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  rows={2}
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="应用说明"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">所有者</label>
                <select
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.ownerId}
                  onChange={(e) => setAddForm({ ...addForm, ownerId: e.target.value })}
                >
                  <option value="">请选择用户</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setShowAddApp(false)}>取消</SecondaryButton>
              <PrimaryButton className="w-auto px-6" onClick={submitAddApp} disabled={submitting}>
                {submitting ? "创建中..." : "创建"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
