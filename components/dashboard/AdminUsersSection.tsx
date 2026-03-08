"use client";

import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { useEffect, useState } from "react";

type UserItem = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: number;
  deleted: number;
};

export function AdminUsersSection() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    role: "",
    password: "",
  });
  const [showAddUser, setShowAddUser] = useState(false);
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "user",
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ userId: string; newDeleted: number } | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("加载用户失败");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function toggleUserStatus(userId: string, newDeleted: number) {
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleted: newDeleted === 1 }),
      });
      if (!res.ok) throw new Error("操作失败");
      setConfirmToggle(null);
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message ?? "操作失败");
    }
  }

  async function saveUserEdit() {
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editForm.email || null,
          role: editForm.role,
          password: editForm.password || undefined,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setFeedback(err.message ?? "保存失败");
    }
  }

  async function submitAddUser() {
    setFeedback(null);
    if (!addForm.username.trim() || !addForm.password) {
      setFeedback("请填写用户名和密码");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: addForm.username.trim(),
          password: addForm.password,
          email: addForm.email.trim() || undefined,
          role: addForm.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error === "USERNAME_TAKEN" ? "用户名已被使用" : "创建失败");
      }
      setShowAddUser(false);
      setAddForm({ username: "", password: "", email: "", role: "user" });
      await loadUsers();
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
          <h2 className="text-sm font-semibold text-slate-100">账户管理 (管理员)</h2>
          <p className="text-xs text-slate-500">管理系统中的所有用户账户及其状态。</p>
        </div>
        <PrimaryButton
          className="w-auto px-4 py-1.5 text-xs"
          onClick={() => {
            setShowAddUser(true);
            setAddForm({ username: "", password: "", email: "", role: "user" });
          }}
        >
          添加账户
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
          <p>正在加载用户列表...</p>
        ) : users.length === 0 ? (
          <p className="text-slate-500">暂无用户。</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 border-b border-slate-800 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">{user.username}</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {user.id}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                      {user.role}
                    </span>
                    {user.deleted === 1 && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                        已禁用
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500">邮箱: {user.email || "未设置"}</p>
                  <p className="text-slate-500">
                    注册时间: {new Date(user.createdAt * 1000).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {user.role !== "admin" && (
                    confirmToggle?.userId === user.id ? (
                      <>
                        <span className="text-[10px] text-slate-400">
                          确定要{confirmToggle.newDeleted === 1 ? "禁用" : "启用"}此用户吗？
                        </span>
                        <SecondaryButton className="text-[10px]" onClick={() => setConfirmToggle(null)}>取消</SecondaryButton>
                        <SecondaryButton
                          className={`text-[10px] ${confirmToggle.newDeleted === 1 ? "border-red-500/50 text-red-400 hover:bg-red-500/10" : "border-green-500/50 text-green-400 hover:bg-green-500/10"}`}
                          onClick={() => toggleUserStatus(user.id, confirmToggle.newDeleted)}
                        >
                          确定
                        </SecondaryButton>
                      </>
                    ) : (
                      <>
                        <SecondaryButton
                          className="text-[10px]"
                          onClick={() => {
                            setEditingUser(user);
                            setEditForm({ email: user.email || "", role: user.role, password: "" });
                          }}
                        >
                          编辑
                        </SecondaryButton>
                        <SecondaryButton
                          className={`text-[10px] ${user.deleted === 1
                            ? "border-green-500/50 text-green-400 hover:bg-green-500/10"
                            : "border-red-500/50 text-red-400 hover:bg-red-500/10"
                            }`}
                          onClick={() => setConfirmToggle({
                            userId: user.id,
                            newDeleted: user.deleted === 1 ? 0 : 1,
                          })}
                        >
                          {user.deleted === 1 ? "启用" : "禁用"}
                        </SecondaryButton>
                      </>
                    )
                  )}
                  {user.role === "admin" && (
                    <span className="text-[10px] text-slate-500">管理员账户不可在此修改或禁用</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-medium text-slate-100">编辑用户: {editingUser.username}</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">邮箱</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">角色</label>
                <select
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="user">普通用户 (user)</option>
                  <option value="admin">系统管理员 (admin)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">重置密码 (留空不修改)</label>
                <input
                  type="password"
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="新密码"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setEditingUser(null)}>取消</SecondaryButton>
              <PrimaryButton className="w-auto px-6" onClick={saveUserEdit}>保存</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-medium text-slate-100">添加账户</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">用户名</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  placeholder="3–32 个字符"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">密码</label>
                <input
                  type="password"
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="至少 6 位"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">邮箱（选填）</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider">角色</label>
                <select
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                >
                  <option value="user">普通用户 (user)</option>
                  <option value="admin">系统管理员 (admin)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setShowAddUser(false)}>取消</SecondaryButton>
              <PrimaryButton className="w-auto px-6" onClick={submitAddUser} disabled={submitting}>
                {submitting ? "创建中..." : "创建"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
