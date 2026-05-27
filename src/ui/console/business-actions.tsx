"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Save, Wand2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from "@/ui/primitives";

type Scope = "app" | "dataType" | "record";
type BusinessKind = "mutation-rules" | "workflows";

type ApiErrorResponse = { error?: { message?: string; details?: unknown } };

export interface BusinessDocumentRow {
  id: string;
  appId: string;
  scope: string;
  target: string | null;
  description: string | null;
  isActive: boolean;
  document: unknown;
  createdAt: number;
  updatedAt: number;
  createdById: string | null;
}

export interface BusinessSchemaSummaryModel {
  id: string;
  dataType: string;
  description: string | null;
  updatedAt: number;
}

const MUTATION_TEMPLATES = [
  {
    id: "article-like-up",
    label: "点赞计数 +1",
    description: "用户设置自己的 data.likes.{userId} 后，自动维护 data.likeCount。",
    document: {
      version: 1,
      id: "article-like-count-up",
      dataType: "article",
      description: "点赞后维护 likeCount",
      on: ["data.likes.*.set"],
      when: { "before.exists": false, "after.exists": true },
      then: [{ type: "increment", path: "data.likeCount", by: 1 }]
    }
  },
  {
    id: "article-like-down",
    label: "取消点赞计数 -1",
    description: "用户 unset 自己的 data.likes.{userId} 后，自动扣减 data.likeCount。",
    document: {
      version: 1,
      id: "article-like-count-down",
      dataType: "article",
      description: "取消点赞后维护 likeCount",
      on: ["data.likes.*.unset"],
      when: { "before.exists": true, "after.exists": false },
      then: [{ type: "increment", path: "data.likeCount", by: -1 }]
    }
  },
  {
    id: "comment-count",
    label: "评论计数",
    description: "新增评论位时维护 data.commentCount。",
    document: {
      version: 1,
      id: "article-comment-count-up",
      dataType: "article",
      description: "新增评论后维护 commentCount",
      on: ["data.comments.*.set"],
      when: { "before.exists": false, "after.exists": true },
      then: [{ type: "increment", path: "data.commentCount", by: 1 }]
    }
  }
];

const WORKFLOW_TEMPLATES = [
  {
    id: "article-publishing",
    label: "文章发布流",
    description: "作者提交审核，应用管理员发布或退回。",
    document: {
      version: 1,
      id: "article-publishing",
      dataType: "article",
      stateField: "data.status",
      transitions: [
        { id: "submit-review", from: "draft", to: "reviewing", action: "submit", subjects: ["$owner"] },
        { id: "publish", from: "reviewing", to: "published", action: "publish", subjects: ["$app_admin"] },
        { id: "reject", from: "reviewing", to: "draft", action: "reject", subjects: ["$app_admin"] }
      ]
    }
  },
  {
    id: "order-flow",
    label: "订单流转",
    description: "订单从待支付到已支付、发货、完成。",
    document: {
      version: 1,
      id: "order-flow",
      dataType: "order",
      stateField: "data.status",
      transitions: [
        { id: "pay", from: "pending", to: "paid", action: "pay", subjects: ["$owner"] },
        { id: "ship", from: "paid", to: "shipped", action: "ship", subjects: ["$app_admin"] },
        { id: "complete", from: "shipped", to: "completed", action: "complete", subjects: ["$owner", "$app_admin"] }
      ]
    }
  }
];

const DEFAULT_MUTATION_TEMPLATE = MUTATION_TEMPLATES[0]!;
const DEFAULT_WORKFLOW_TEMPLATE = WORKFLOW_TEMPLATES[0]!;

const SAMPLE_COMMAND = {
  actor: {
    userId: "user_a",
    role: "user",
    appId: "app_xxx",
    authType: "full",
    appAdmin: false,
    systemAdmin: false,
    ownerId: "user_a",
    origin: "sdk"
  },
  intent: {
    kind: "update",
    appId: "app_xxx",
    dataType: "article",
    recordId: "record_xxx",
    transition: "submit",
    data: { status: "reviewing" }
  },
  changeSet: {
    before: { status: "draft", likes: {}, likeCount: 0 },
    submitted: { status: "reviewing" },
    after: { status: "reviewing", likes: {}, likeCount: 0 },
    changedPaths: ["data.status"]
  }
};

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

function normalizeRows(rows: BusinessDocumentRow[]) {
  return rows.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive)
  }));
}

function firstDataType(schemas: BusinessSchemaSummaryModel[]) {
  return schemas[0]?.dataType ?? "article";
}

function documentId(document: unknown, fallback: string) {
  if (document && typeof document === "object" && "id" in document) {
    return String((document as { id?: unknown }).id ?? fallback);
  }
  return fallback;
}

export function BusinessRulesPanel({
  appId,
  mutationRules,
  workflows,
  schemas
}: {
  appId: string;
  mutationRules: BusinessDocumentRow[];
  workflows: BusinessDocumentRow[];
  schemas: BusinessSchemaSummaryModel[];
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<BusinessKind>("mutation-rules");
  const [scope, setScope] = React.useState<Scope>("dataType");
  const [target, setTarget] = React.useState(firstDataType(schemas));
  const [description, setDescription] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [documentText, setDocumentText] = React.useState(formatJson(DEFAULT_MUTATION_TEMPLATE.document));
  const [templateId, setTemplateId] = React.useState(DEFAULT_MUTATION_TEMPLATE.id);
  const [commandText, setCommandText] = React.useState(formatJson(SAMPLE_COMMAND));
  const [previewResult, setPreviewResult] = React.useState<unknown>(null);
  const [busy, setBusy] = React.useState(false);

  const rows = normalizeRows(kind === "mutation-rules" ? mutationRules : workflows);
  const templates = kind === "mutation-rules" ? MUTATION_TEMPLATES : WORKFLOW_TEMPLATES;
  const currentTarget = scope === "app" ? null : target || null;

  React.useEffect(() => {
    const nextTemplate = kind === "mutation-rules" ? DEFAULT_MUTATION_TEMPLATE : DEFAULT_WORKFLOW_TEMPLATE;
    setTemplateId(nextTemplate.id);
    setDocumentText(formatJson(nextTemplate.document));
    setDescription(nextTemplate.description);
    setPreviewResult(null);
  }, [kind]);

  function applyTemplate() {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setDocumentText(formatJson(template.document));
    setDescription(template.description);
    const dataType = typeof template.document.dataType === "string" ? template.document.dataType : firstDataType(schemas);
    if (scope !== "app") setTarget(dataType);
  }

  function loadRow(row: BusinessDocumentRow) {
    setKind(row.document && typeof row.document === "object" && "transitions" in row.document ? "workflows" : "mutation-rules");
    setScope(row.scope as Scope);
    setTarget(row.target ?? firstDataType(schemas));
    setDescription(row.description ?? "");
    setIsActive(row.isActive);
    setDocumentText(formatJson(row.document));
    setPreviewResult(null);
  }

  async function saveDocument() {
    let document: Record<string, unknown>;
    try {
      document = parseJsonObject(documentText, kind === "mutation-rules" ? "MutationRuleDocument" : "WorkflowDocument");
    } catch (err) {
      toast.error(String((err as Error).message));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/${kind}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, target: currentTarget, description, isActive, document })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiMessage(json, "保存失败"));
      toast.success(kind === "mutation-rules" ? "Mutation Rule 已保存" : "Workflow 已保存");
      router.refresh();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function previewDocument() {
    let document: Record<string, unknown>;
    let command: Record<string, unknown>;
    try {
      document = parseJsonObject(documentText, kind === "mutation-rules" ? "MutationRuleDocument" : "WorkflowDocument");
      command = parseJsonObject(commandText, "CommandContext");
    } catch (err) {
      toast.error(String((err as Error).message));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/${kind}/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documents: [document], command })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiMessage(json, "Preview 失败"));
      setPreviewResult(json.data ?? json);
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  function scopeOptions() {
    return [
      { value: "app", label: "App 默认" },
      { value: "dataType", label: "DataType" },
      { value: "record", label: "Record Override" }
    ];
  }

  return (
    <div className="container-page py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Business</h1>
          <Badge tone="accent">Rules & Flow</Badge>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-ink-500 dark:text-slate-400">
          这里管理业务分层中不属于 Policy 的部分：Mutation Rule 负责同记录派生字段，Workflow 负责状态机和业务动作。Policy 仍只负责授权判断。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Business Rules</CardTitle>
            <CardDescription>使用模板快速生成文档，也可以直接编辑 JSON。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={kind} onValueChange={(value) => setKind(value as BusinessKind)}>
              <TabsList>
                <TabsTrigger value="mutation-rules">Mutation Rules</TabsTrigger>
                <TabsTrigger value="workflows">Workflows</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Scope">
                <Select value={scope} options={scopeOptions()} onValueChange={(value) => setScope(value as Scope)} />
              </Field>
              <Field label="Target" help={scope === "app" ? "App scope 不需要 target" : "DataType 或 Record ID"}>
                {scope === "dataType" && schemas.length > 0 ? (
                  <Select
                    value={target}
                    options={schemas.map((schema) => ({ value: schema.dataType, label: schema.dataType }))}
                    onValueChange={setTarget}
                  />
                ) : (
                  <Input value={scope === "app" ? "" : target} onChange={(event) => setTarget(event.target.value)} disabled={scope === "app"} />
                )}
              </Field>
              <Field label="状态">
                <Select
                  value={isActive ? "active" : "disabled"}
                  options={[{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]}
                  onValueChange={(value) => setIsActive(value === "active")}
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Field label="模板">
                <Select
                  value={templateId}
                  options={templates.map((template) => ({ value: template.id, label: template.label }))}
                  onValueChange={setTemplateId}
                />
              </Field>
              <div className="flex items-end">
                <Button variant="secondary" onClick={applyTemplate} className="w-full md:w-auto">
                  <Wand2 />
                  应用模板
                </Button>
              </div>
            </div>

            <Field label="Description">
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>

            <Field label={kind === "mutation-rules" ? "MutationRuleDocument" : "WorkflowDocument"}>
              <Textarea
                value={documentText}
                onChange={(event) => setDocumentText(event.target.value)}
                className="min-h-[360px] font-mono text-xs"
                spellCheck={false}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveDocument} loading={busy}>
                <Save />
                保存
              </Button>
              <Button variant="secondary" onClick={previewDocument} loading={busy}>
                <Play />
                Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>已配置文档</CardTitle>
              <CardDescription>点击任意文档可载入编辑区。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500 dark:border-slate-700 dark:text-slate-400">
                  暂无配置
                </div>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => loadRow(row)}
                    className="w-full rounded-lg border border-ink-200/70 bg-white/60 px-3 py-2 text-left transition hover:border-accent-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-accent-400/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs text-ink-800 dark:text-slate-100">
                        {documentId(row.document, row.id)}
                      </span>
                      <Badge tone={row.isActive ? "success" : "neutral"}>{row.isActive ? "active" : "disabled"}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-2xs text-ink-500 dark:text-slate-400">
                      <span>{row.scope}</span>
                      <span>/</span>
                      <span>{row.target ?? "app"}</span>
                    </div>
                    {row.description ? <p className="mt-1 truncate text-xs text-ink-500 dark:text-slate-400">{row.description}</p> : null}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flow Simulator</CardTitle>
              <CardDescription>用 CommandContext 预览当前文档对变更的影响。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="CommandContext">
                <Textarea
                  value={commandText}
                  onChange={(event) => setCommandText(event.target.value)}
                  className="min-h-[260px] font-mono text-xs"
                  spellCheck={false}
                />
              </Field>
              {previewResult ? (
                <pre className="max-h-[320px] overflow-auto rounded-lg border border-ink-200/70 bg-cream-50/80 p-3 text-xs text-ink-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                  {formatJson(previewResult)}
                </pre>
              ) : (
                <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500 dark:border-slate-700 dark:text-slate-400">
                  点击 Preview 后显示结果
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}