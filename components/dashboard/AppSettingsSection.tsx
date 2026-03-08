"use client";

import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { useEffect, useState } from "react";

type AppItem = {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  status: string;
};

type SchemaItem = {
  id: string;
  dataType: string;
  version: number;
  isActive: number;
  schema: string;
  validationRules: string | null;
  defaultPermissions: string | null;
};

export function AppSettingsSection() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 编辑应用信息
  const [editingAppInfo, setEditingAppInfo] = useState<AppItem | null>(null);
  const [appInfoForm, setAppInfoForm] = useState({ name: "", description: "" });

  // 编辑 Schema
  const [editingSchema, setEditingSchema] = useState<Partial<SchemaItem> | null>(null);
  const [schemaForm, setSchemaForm] = useState({
    dataType: "",
    schema: "",
    validationRules: "",
    defaultPermissions: "",
  });

  async function loadManagedApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/apps/managed");
      if (!res.ok) throw new Error("加载失败");
      const list = await res.json();
      setApps(list);
      if (list.length > 0 && !selectedApp) setSelectedApp(list[0]);
    } catch (err: any) {
      setError("加载应用列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadSchemas(appId: string) {
    try {
      const res = await fetch(`/api/app/${appId}/schemas`);
      if (res.ok) {
        const data = await res.json();
        setSchemas(data);
      }
    } catch (err) {
      console.error("加载 Schema 失败", err);
    }
  }

  useEffect(() => {
    void loadManagedApps();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      void loadSchemas(selectedApp.id);
    }
  }, [selectedApp]);

  async function saveAppInfo() {
    if (!selectedApp) return;
    try {
      const res = await fetch(`/api/app/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appInfoForm),
      });
      if (!res.ok) throw new Error("保存失败");
      setEditingAppInfo(null);
      await loadManagedApps();
      setSelectedApp({ ...selectedApp, ...appInfoForm });
    } catch (err: any) {
      setError(err.message ?? "保存失败");
    }
  }

  async function saveSchema() {
    if (!selectedApp) return;
    try {
      const res = await fetch(`/api/schema/${selectedApp.id}/${schemaForm.dataType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: schemaForm.schema,
          validationRules: schemaForm.validationRules || null,
          defaultPermissions: schemaForm.defaultPermissions || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }
      setEditingSchema(null);
      await loadSchemas(selectedApp.id);
    } catch (err: any) {
      setError(err.message ?? "保存失败");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">应用设置 (应用管理员)</h2>
          <p className="text-xs text-slate-500">管理你所负责的应用信息、DataSchema 及验证规则。</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => setError(null)}>关闭</button>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-xs">
          <p className="px-2 py-1 font-semibold text-slate-400">选择应用</p>
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => setSelectedApp(app)}
              className={`w-full rounded px-2 py-1.5 text-left transition ${selectedApp?.id === app.id
                ? "bg-sky-600 text-white"
                : "text-slate-300 hover:bg-slate-800"
                }`}
            >
              {app.name}
            </button>
          ))}
          {apps.length === 0 && !loading && (
            <p className="px-2 py-4 text-center text-slate-500">暂无管理的应用</p>
          )}
        </div>

        <div className="space-y-4">
          {selectedApp ? (
            <>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
                <h3 className="mb-3 text-sm font-medium text-slate-100">基本信息</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-slate-500">应用名称</p>
                    <p className="font-medium text-slate-200">{selectedApp.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-500">域名</p>
                    <p className="font-mono text-slate-200">{selectedApp.domain}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-slate-500">描述</p>
                    <p className="text-slate-200">{selectedApp.description || "无描述"}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <SecondaryButton
                    className="text-[10px]"
                    onClick={() => {
                      setEditingAppInfo(selectedApp);
                      setAppInfoForm({ name: selectedApp.name, description: selectedApp.description || "" });
                    }}
                  >
                    修改信息
                  </SecondaryButton>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-100">DataSchema 管理</h3>
                  <PrimaryButton
                    className="h-7 w-auto px-3 text-[10px]"
                    onClick={() => {
                      setEditingSchema({});
                      setSchemaForm({ dataType: "", schema: "{}", validationRules: "", defaultPermissions: "" });
                    }}
                  >
                    新增 Schema
                  </PrimaryButton>
                </div>
                <div className="space-y-2">
                  {schemas.length === 0 ? (
                    <p className="py-4 text-center text-slate-500">暂无数据模式配置</p>
                  ) : (
                    schemas.map((schema) => (
                      <div
                        key={schema.id}
                        className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/50 p-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200">{schema.dataType}</span>
                            <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-slate-400">
                              v{schema.version}
                            </span>
                            {schema.isActive === 1 && (
                              <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] text-green-400">
                                活跃
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <SecondaryButton
                            className="h-6 px-2 text-[9px]"
                            onClick={() => {
                              setEditingSchema(schema);
                              setSchemaForm({
                                dataType: schema.dataType,
                                schema: typeof schema.schema === 'string' ? schema.schema : JSON.stringify(schema.schema, null, 2),
                                validationRules: schema.validationRules || "",
                                defaultPermissions: typeof schema.defaultPermissions === 'string' ? schema.defaultPermissions : JSON.stringify(schema.defaultPermissions || {}, null, 2),
                              });
                            }}
                          >
                            编辑
                          </SecondaryButton>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-800 text-slate-500">
              请在左侧选择一个应用进行管理
            </div>
          )}
        </div>
      </div>

      {/* 修改应用信息弹窗 */}
      {editingAppInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-medium text-slate-100">修改应用信息</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">应用名称</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  value={appInfoForm.name}
                  onChange={(e) => setAppInfoForm({ ...appInfoForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">描述</label>
                <textarea
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  rows={3}
                  value={appInfoForm.description}
                  onChange={(e) => setAppInfoForm({ ...appInfoForm, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setEditingAppInfo(null)} className="w-full">取消</SecondaryButton>
              <PrimaryButton className="w-full" onClick={saveAppInfo}>保存</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* 编辑 Schema 弹窗 */}
      {editingSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-slate-100">
              {editingSchema.id ? "编辑 Schema" : "新增 Schema"}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">数据类型 (dataType)</label>
                <input
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none disabled:opacity-50"
                  value={schemaForm.dataType}
                  onChange={(e) => setSchemaForm({ ...schemaForm, dataType: e.target.value })}
                  disabled={!!editingSchema.id}
                  placeholder="例如: post, user_profile"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">JSON Schema</label>
                <textarea
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-sky-400 focus:border-sky-500 focus:outline-none"
                  rows={8}
                  value={schemaForm.schema}
                  onChange={(e) => setSchemaForm({ ...schemaForm, schema: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">默认权限 (JSON)</label>
                <textarea
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-sky-400 focus:border-sky-500 focus:outline-none"
                  rows={4}
                  value={schemaForm.defaultPermissions}
                  onChange={(e) => setSchemaForm({ ...schemaForm, defaultPermissions: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">验证规则 (JavaScript 字符串)</label>
                <textarea
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-green-400 focus:border-sky-500 focus:outline-none"
                  rows={4}
                  value={schemaForm.validationRules}
                  onChange={(e) => setSchemaForm({ ...schemaForm, validationRules: e.target.value })}
                  placeholder="// return true or error string"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton onClick={() => setEditingSchema(null)} className="w-full">取消</SecondaryButton>
              <PrimaryButton className="w-full" onClick={saveSchema}>保存新版本</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
