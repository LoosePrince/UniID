"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play, Save, Wand2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  CalloutDescription,
  CalloutTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from "@/ui/primitives";

export interface PolicyRuleModel {
  id: string;
  name?: string;
  description?: string;
  effect: "allow";
  actions: string[];
  subjects: string[];
  resource?: { fields?: string[] };
  using?: Record<string, unknown> | null;
  check?: Record<string, unknown> | null;
}

export interface PolicyDocumentV2Model {
  version: 2;
  rules: PolicyRuleModel[];
}

export interface PolicySummaryModel {
  id: string;
  appId: string;
  scope: string;
  target: string | null;
  description: string | null;
  document: unknown;
  normalized: PolicyDocumentV2Model;
  createdAt: number;
  updatedAt: number;
  createdById: string | null;
}

export interface DataSchemaSummaryModel {
  id: string;
  dataType: string;
  description: string | null;
  updatedAt: number;
  versions: Array<{
    id: string;
    version: number;
    jsonSchema: string;
    autoFill: string | null;
    validationRules: string | null;
    isActive: number;
    createdAt: number;
  }>;
}

type Scope = "app" | "dataType" | "record";

type ApiErrorResponse = { error?: { message?: string; details?: unknown } };

const EMPTY_POLICY: PolicyDocumentV2Model = { version: 2, rules: [] };

const TEMPLATES: Array<{ id: string; label: string; description: string; document: PolicyDocumentV2Model }> = [
  {
    id: "public-read",
    label: "公开只读",
    description: "所有人可读取，写入仍默认拒绝。",
    document: {
      version: 2,
      rules: [{ id: "public-read", effect: "allow", actions: ["read"], subjects: ["$public"], using: null, check: null }]
    }
  },
  {
    id: "owner-only",
    label: "用户私有",
    description: "只有 owner 可读写和删除。",
    document: {
      version: 2,
      rules: [
        { id: "owner-read", effect: "allow", actions: ["read"], subjects: ["$owner"], using: null, check: null },
        { id: "owner-write", effect: "allow", actions: ["create", "update", "delete", "set", "unset", "push", "increment"], subjects: ["$owner"], using: null, check: null }
      ]
    }
  },
  {
    id: "public-read-owner-write",
    label: "公开读，作者写",
    description: "内容公开可读，创建者或 owner 维护。",
    document: {
      version: 2,
      rules: [
        { id: "public-read", effect: "allow", actions: ["read"], subjects: ["$public"], using: null, check: null },
        { id: "owner-write", effect: "allow", actions: ["create", "update", "delete", "set", "unset", "push", "increment"], subjects: ["$owner"], using: null, check: null }
      ]
    }
  },
  {
    id: "admin-manage",
    label: "管理员管理",
    description: "应用管理员具备全动作权限。",
    document: {
      version: 2,
      rules: [{ id: "app-admin-manage", effect: "allow", actions: ["read", "create", "update", "delete", "set", "unset", "push", "increment"], subjects: ["$app_admin"], using: null, check: null }]
    }
  },
  {
    id: "dynamic-like",
    label: "动态点赞/投票",
    description: "用户只能维护自己的动态路径。",
    document: {
      version: 2,
      rules: [
        { id: "public-read", effect: "allow", actions: ["read"], subjects: ["$public"], using: null, check: null },
        { id: "self-like", effect: "allow", actions: ["set", "unset", "push"], subjects: ["$dynamic:likes.$user"], resource: { fields: ["data.likes.*"] }, using: null, check: null }
      ]
    }
  }
];

const ACTION_OPTIONS = ["read", "create", "update", "delete", "set", "unset", "push", "increment"];

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(source: string, label: string) {
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`${label} 必须是 JSON object`);
  }
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  if (json.error?.details) return `${json.error.message ?? fallback}: ${JSON.stringify(json.error.details)}`;
  return json.error?.message ?? fallback;
}

function findPolicy(policies: PolicySummaryModel[], scope: Scope, target: string | null) {
  return policies.find((policy) => policy.scope === scope && (policy.target ?? null) === target) ?? null;
}

function schemaFieldPaths(schema: DataSchemaSummaryModel | null) {
  const active = schema?.versions.find((version) => version.isActive === 1) ?? schema?.versions[0];
  if (!active) return [];

  try {
    const json = JSON.parse(active.jsonSchema) as Record<string, unknown>;
    const paths: string[] = [];

    function walk(node: Record<string, unknown>, prefix: string) {
      const properties = node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
        ? node.properties as Record<string, unknown>
        : {};
      for (const [key, value] of Object.entries(properties)) {
        const path = `${prefix}.${key}`;
        paths.push(path);
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const child = value as Record<string, unknown>;
          if (child.type === "object" || child.properties) walk(child, path);
        }
      }
    }

    walk(json, "data");
    return paths;
  } catch {
    return [];
  }
}

export function PolicyManagementPanel({ appId, policies, schemas }: { appId: string; policies: PolicySummaryModel[]; schemas: DataSchemaSummaryModel[] }) {
  const router = useRouter();
  const [scope, setScope] = React.useState<Scope>("app");
  const [target, setTarget] = React.useState("");
  const [recordDataType, setRecordDataType] = React.useState(schemas[0]?.dataType ?? "");
  const [description, setDescription] = React.useState("");
  const [documentText, setDocumentText] = React.useState(formatJson(EMPTY_POLICY));
  const [selectedTemplate, setSelectedTemplate] = React.useState(TEMPLATES[0]?.id ?? "public-read");
  const [busy, setBusy] = React.useState(false);
  const [explainResult, setExplainResult] = React.useState<unknown>(null);
  const [migrationPreview, setMigrationPreview] = React.useState<unknown>(null);

  const currentTarget = scope === "app" ? null : target || null;
  const currentPolicy = findPolicy(policies, scope, currentTarget);
  const schemaTarget = scope === "record" ? recordDataType : target;
  const selectedSchema = scope === "app" ? null : schemas.find((schema) => schema.dataType === schemaTarget) ?? null;
  const fields = schemaFieldPaths(selectedSchema);

  React.useEffect(() => {
    const policy = findPolicy(policies, scope, currentTarget);
    setDescription(policy?.description ?? "");
    setDocumentText(formatJson(policy?.normalized ?? EMPTY_POLICY));
  }, [policies, scope, currentTarget]);

  function selectScope(nextScope: Scope) {
    setScope(nextScope);
    if (nextScope === "app") setTarget("");
    if (nextScope === "dataType" && !target && schemas[0]) setTarget(schemas[0].dataType);
    if (nextScope === "record" && !recordDataType && schemas[0]) setRecordDataType(schemas[0].dataType);
  }

  function applyTemplate() {
    const template = TEMPLATES.find((item) => item.id === selectedTemplate);
    if (!template) return;
    setDocumentText(formatJson(template.document));
    if (!description) setDescription(template.description);
  }

  async function savePolicy() {
    let document: Record<string, unknown>;
    try {
      document = parseJsonObject(documentText, "PolicyDocument");
    } catch (err) {
      toast.error(String((err as Error).message));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/policies`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, target: currentTarget, description, document })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiMessage(json, "保存失败"));
      toast.success("Policy 已保存");
      router.refresh();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function previewMigration() {
    let document: Record<string, unknown> | undefined;
    if (documentText.trim()) {
      try {
        document = parseJsonObject(documentText, "PolicyDocument");
      } catch (err) {
        toast.error(String((err as Error).message));
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/policies/preview-migration`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, target: currentTarget, document })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiMessage(json, "预览失败"));
      setMigrationPreview(json);
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function runExplain(formData: FormData) {
    let currentValue: Record<string, unknown>;
    let dataValue: Record<string, unknown>;
    try {
      currentValue = parseJsonObject(String(formData.get("currentValue") || "{}"), "oldData");
      dataValue = parseJsonObject(String(formData.get("dataValue") || "{}"), "newData");
    } catch (err) {
      toast.error(String((err as Error).message));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/policies/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          target: currentTarget,
          dataType: scope === "record" ? recordDataType || undefined : undefined,
          action: String(formData.get("action") || "read"),
          fieldPath: String(formData.get("fieldPath") || "") || undefined,
          actor: {
            userId: String(formData.get("userId") || "") || null,
            ownerId: String(formData.get("ownerId") || "") || null,
            role: String(formData.get("role") || "user"),
            authType: String(formData.get("authType") || "restricted"),
            appAdmin: formData.get("appAdmin") === "on",
            systemAdmin: formData.get("systemAdmin") === "on",
            origin: "system"
          },
          currentValue,
          dataValue
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiMessage(json, "模拟失败"));
      setExplainResult(json);
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page space-y-6 py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Policies</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500 dark:text-slate-400">
            管理 app / dataType / record 三层策略，保存时统一写入 v2，运行时仍兼容旧版 default + fields。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={previewMigration} loading={busy}>
            <Wand2 /> 预览迁移
          </Button>
          <Button onClick={savePolicy} loading={busy}>
            <Save /> 保存策略
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <PolicyMetric label="Policy 文档" value={String(policies.length)} />
        <PolicyMetric label="DataType" value={String(schemas.length)} />
        <PolicyMetric label="当前规则" value={String((currentPolicy?.normalized.rules ?? EMPTY_POLICY.rules).length)} />
      </section>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">策略编辑</TabsTrigger>
          <TabsTrigger value="fields">字段权限</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>作用域</CardTitle>
              <CardDescription>按 app → dataType → record 顺序组合。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Scope">
                <Select value={scope} onValueChange={(value) => selectScope(value as Scope)} options={[
                  { value: "app", label: "app default" },
                  { value: "dataType", label: "dataType default" },
                  { value: "record", label: "record override" }
                ]} />
              </Field>
              {scope === "dataType" ? (
                <Field label="DataType">
                  <Select value={target} onValueChange={setTarget} options={schemas.map((schema) => ({ value: schema.dataType, label: schema.dataType }))} />
                </Field>
              ) : scope === "record" ? (
                <>
                  <Field label="Record ID" help="record override 通常来自记录 __permissions，这里用于直接管理 PolicyDocument 表。">
                    <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="record id" />
                  </Field>
                  <Field label="DataType for simulator" help="record scope 模拟时用于补齐 app → dataType → record 组合链。">
                    <Select value={recordDataType} onValueChange={setRecordDataType} options={schemas.map((schema) => ({ value: schema.dataType, label: schema.dataType }))} />
                  </Field>
                </>
              ) : null}
              <Field label="Description">
                <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="策略说明" />
              </Field>
              <Field label="模板">
                <div className="flex gap-2">
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate} options={TEMPLATES.map((template) => ({ value: template.id, label: template.label }))} />
                  <Button variant="secondary" onClick={applyTemplate}>应用</Button>
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>JSON 高级模式</CardTitle>
              <CardDescription>直接编辑 PolicyDocument v2。旧版文档可通过“预览迁移”查看归一化结果。</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={documentText} onChange={(event) => setDocumentText(event.target.value)} className="min-h-[520px] font-mono text-xs" spellCheck={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>字段清单</CardTitle>
              <CardDescription>来自当前 active schema。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {fields.length === 0 ? <p className="text-sm text-ink-500">选择 dataType 后显示字段路径。</p> : fields.map((field) => <Badge key={field} tone="neutral" className="mr-1 mt-1 font-mono">{field}</Badge>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>字段规则速写</CardTitle>
              <CardDescription>把字段路径填入 resource.fields，即可限定某条 rule 的作用范围。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-ink-600 dark:text-slate-300">
              <p>示例：公开读取标题和摘要，其他字段继续默认拒绝。</p>
              <pre className="overflow-auto rounded-xl border border-ink-200/70 bg-cream-100/70 p-4 text-xs dark:border-slate-700 dark:bg-slate-900/60">{formatJson({ id: "public-read-title", effect: "allow", actions: ["read"], subjects: ["$public"], resource: { fields: ["data.title", "data.summary"] }, using: null, check: null })}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="mt-4 grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Policy Simulator</CardTitle>
              <CardDescription>选择身份、动作和数据，查看 allow/deny 与 trace。</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={runExplain} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Action"><Select name="action" defaultValue="read" options={ACTION_OPTIONS.map((value) => ({ value, label: value }))} /></Field>
                  <Field label="Field Path"><Input name="fieldPath" placeholder="data.title" /></Field>
                  <Field label="User ID"><Input name="userId" placeholder="user id" /></Field>
                  <Field label="Owner ID"><Input name="ownerId" placeholder="owner id" /></Field>
                  <Field label="Role"><Input name="role" defaultValue="user" /></Field>
                  <Field label="Auth Type"><Select name="authType" defaultValue="restricted" options={[{ value: "restricted", label: "restricted" }, { value: "full", label: "full" }]} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm"><input name="appAdmin" type="checkbox" /> appAdmin</label>
                <label className="flex items-center gap-2 text-sm"><input name="systemAdmin" type="checkbox" /> systemAdmin</label>
                <Field label="oldData / currentValue"><Textarea name="currentValue" defaultValue="{}" className="font-mono text-xs" /></Field>
                <Field label="newData / dataValue"><Textarea name="dataValue" defaultValue="{}" className="font-mono text-xs" /></Field>
                <Button type="submit" loading={busy}><Play /> 运行模拟</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Explain Trace</CardTitle>
              <CardDescription>展示最终决策和规则匹配过程。</CardDescription>
            </CardHeader>
            <CardContent>
              {explainResult ? (
                <pre className="max-h-[680px] overflow-auto rounded-xl border border-ink-200/70 bg-cream-100/70 p-4 text-xs dark:border-slate-700 dark:bg-slate-900/60">{formatJson(explainResult)}</pre>
              ) : (
                <p className="text-sm text-ink-500">运行模拟后显示结果。</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {migrationPreview ? (
        <Callout tone="info">
          <CheckCircle2 />
          <CalloutTitle>迁移预览</CalloutTitle>
          <CalloutDescription>
            <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-white/60 p-3 text-xs dark:bg-slate-950/40">{formatJson(migrationPreview)}</pre>
          </CalloutDescription>
        </Callout>
      ) : null}
    </div>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xs uppercase tracking-wider text-ink-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}