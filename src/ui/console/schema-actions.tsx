"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database, GitBranch, Plus } from "lucide-react";
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
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from "@/ui/primitives";
import {
  AutoFillBuilder,
  type AutoFillRuleModel,
  SchemaBuilder,
  type SchemaFieldModel,
  autoFillObjectToRules,
  autoFillRulesToObject,
  createSchemaField,
  jsonSchemaToFields,
  parseJsonRecord,
  schemaFieldsToJsonSchema,
  validateSchemaFields
} from "./schema-builder";

export interface SchemaVersionSummary {
  id: string;
  version: number;
  jsonSchema: string;
  autoFill: string | null;
  validationRules: string | null;
  isActive: number;
  createdAt: number;
}

export interface DataSchemaSummary {
  id: string;
  dataType: string;
  description: string | null;
  updatedAt: number;
  versions: SchemaVersionSummary[];
}

interface ApiErrorResponse {
  error?: { message?: string; details?: unknown };
}

type EditorMode = "builder" | "advanced";
type SaveIntent = "draft" | "active";

type SchemaStats = {
  fieldCount: number;
  requiredCount: number;
  nestedCount: number;
};

const DEFAULT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: true
} satisfies Record<string, unknown>;

const DEFAULT_SCHEMA_TEXT = JSON.stringify(DEFAULT_SCHEMA, null, 2);
const EMPTY_FIELDS: SchemaFieldModel[] = [];

function formatStoredJson(source: string | null | undefined, fallback = "") {
  if (!source) return fallback;
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
}

function parseJsonObject(source: string, label: string) {
  try {
    return parseJsonRecord(source);
  } catch (err) {
    const message = String((err as Error).message ?? err);
    if (message.includes("JSON")) throw new Error(`${label} 必须是合法 JSON object。`);
    throw new Error(`${label} 必须是 JSON object。`);
  }
}

function parseOptionalJsonObject(source: string, label: string) {
  const trimmed = source.trim();
  if (!trimmed) return undefined;
  const parsed = parseJsonObject(trimmed, label);
  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function describeDetails(details: unknown) {
  if (!details) return undefined;
  if (Array.isArray(details)) {
    return details
      .map((item) => {
        if (item && typeof item === "object" && "message" in item) return String(item.message);
        return JSON.stringify(item);
      })
      .join("；");
  }
  if (typeof details === "object") return JSON.stringify(details);
  return String(details);
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  const details = describeDetails(json.error?.details);
  if (json.error?.message && details) return `${json.error.message}: ${details}`;
  return json.error?.message ?? details ?? fallback;
}

function formatTime(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleString();
}

function activeVersionOf(schema: DataSchemaSummary) {
  return schema.versions.find((version) => version.isActive === 1) ?? null;
}

function parseStoredRecord(source: string | null | undefined) {
  if (!source) return undefined;
  try {
    return parseJsonRecord(source);
  } catch {
    return undefined;
  }
}

function countSchemaStats(schema: Record<string, unknown>): SchemaStats {
  const visited = new Set<Record<string, unknown>>();

  function walk(node: Record<string, unknown>): SchemaStats {
    if (visited.has(node)) return { fieldCount: 0, requiredCount: 0, nestedCount: 0 };
    visited.add(node);

    const properties = node.properties && typeof node.properties === "object" && !Array.isArray(node.properties)
      ? node.properties as Record<string, unknown>
      : {};
    const required = Array.isArray(node.required) ? node.required.length : 0;
    let stats: SchemaStats = {
      fieldCount: Object.keys(properties).length,
      requiredCount: required,
      nestedCount: 0
    };

    for (const value of Object.values(properties)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const child = value as Record<string, unknown>;
      if (child.type === "object" || child.properties) {
        stats.nestedCount += 1;
        const nested = walk(child);
        stats = {
          fieldCount: stats.fieldCount + nested.fieldCount,
          requiredCount: stats.requiredCount + nested.requiredCount,
          nestedCount: stats.nestedCount + nested.nestedCount
        };
      }
      if (child.type === "array" && child.items && typeof child.items === "object" && !Array.isArray(child.items)) {
        const nested = walk(child.items as Record<string, unknown>);
        stats = {
          fieldCount: stats.fieldCount + nested.fieldCount,
          requiredCount: stats.requiredCount + nested.requiredCount,
          nestedCount: stats.nestedCount + nested.nestedCount
        };
      }
    }
    return stats;
  }

  return walk(schema);
}

function versionStats(version: SchemaVersionSummary) {
  const schema = parseStoredRecord(version.jsonSchema);
  return schema ? countSchemaStats(schema) : { fieldCount: 0, requiredCount: 0, nestedCount: 0 };
}

function formatJsonValue(value: Record<string, unknown> | undefined, fallback = "{}") {
  return value ? JSON.stringify(value, null, 2) : fallback;
}

export function SchemaManagementPanel({ appId, schemas }: { appId: string; schemas: DataSchemaSummary[] }) {
  return (
    <div className="container-page space-y-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Schemas</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
            管理 dataType 写入约束、版本切换和数据浏览入口。
          </p>
        </div>
        <SchemaEditorDialog appId={appId} mode="create" />
      </header>

      {schemas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm font-medium text-ink-800 dark:text-slate-200">尚未定义任何 Schema</p>
            <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">
              创建第一个 Schema 后，就可以写入受校验的记录。
            </p>
            <div className="mt-5 flex justify-center">
              <SchemaEditorDialog appId={appId} mode="create" variant="outline" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schemas.map((schema) => (
            <SchemaCard key={schema.id} appId={appId} schema={schema} />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaCard({ appId, schema }: { appId: string; schema: DataSchemaSummary }) {
  const activeVersion = activeVersionOf(schema);
  const seedVersion = activeVersion ?? schema.versions[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-mono text-sm">{schema.dataType}</CardTitle>
              {activeVersion ? (
                <Badge tone="success">active v{activeVersion.version}</Badge>
              ) : (
                <Badge tone="warning">未激活</Badge>
              )}
              <Badge tone="neutral">{schema.versions.length} 个版本</Badge>
            </div>
            <CardDescription className="max-w-3xl">
              {schema.description || "未填写 schema 级描述。"}
            </CardDescription>
            <p className="text-xs text-ink-400 dark:text-slate-500">更新于 {formatTime(schema.updatedAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {seedVersion ? (
              <SchemaEditorDialog
                appId={appId}
                mode="version"
                schema={schema}
                seedVersion={seedVersion}
                variant="outline"
              />
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <Link href={`/console/apps/${appId}/data/${encodeURIComponent(schema.dataType)}`}>
                <Database /> 浏览数据
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>版本</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>结构</TableHead>
                <TableHead>配置</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schema.versions.map((version) => (
                <TableRow key={version.id} className="align-top">
                  <TableCell className="font-mono text-xs text-ink-700 dark:text-slate-200">v{version.version}</TableCell>
                  <TableCell>
                    {version.isActive === 1 ? <Badge tone="success">active</Badge> : <Badge>draft</Badge>}
                  </TableCell>
                  <TableCell className="min-w-52">
                    <VersionStructureSummary version={version} />
                  </TableCell>
                  <TableCell className="min-w-56">
                    <VersionPreview version={version} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-ink-500 dark:text-slate-400">
                    {formatTime(version.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <SchemaEditorDialog
                        appId={appId}
                        mode="version"
                        schema={schema}
                        seedVersion={version}
                        variant="ghost"
                        size="sm"
                      />
                      <ActivateSchemaVersionButton appId={appId} dataType={schema.dataType} version={version} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function VersionStructureSummary({ version }: { version: SchemaVersionSummary }) {
  const stats = versionStats(version);
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <Badge tone="neutral">{stats.fieldCount} fields</Badge>
      <Badge tone={stats.requiredCount > 0 ? "accent" : "neutral"}>{stats.requiredCount} required</Badge>
      {stats.nestedCount > 0 ? <Badge tone="neutral">{stats.nestedCount} nested</Badge> : null}
    </div>
  );
}

function VersionPreview({ version }: { version: SchemaVersionSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge tone="neutral">JSON Schema</Badge>
      {version.autoFill ? <Badge tone="accent">AutoFill</Badge> : null}
      {version.validationRules ? <Badge tone="warning">Rules</Badge> : null}
      <SchemaVersionDetailDialog version={version} />
    </div>
  );
}

function SchemaVersionDetailDialog({ version }: { version: SchemaVersionSummary }) {
  const schema = parseStoredRecord(version.jsonSchema);
  const autoFill = parseStoredRecord(version.autoFill);
  const stats = schema ? countSchemaStats(schema) : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="xs">查看详情</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Schema v{version.version}</DialogTitle>
          <DialogDescription>
            创建于 {formatTime(version.createdAt)}，{version.isActive === 1 ? "当前为 active 版本。" : "当前为 draft 版本。"}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[74vh] overflow-y-auto">
          <Tabs defaultValue="summary">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="summary">结构摘要</TabsTrigger>
              <TabsTrigger value="schema">JSON Schema</TabsTrigger>
              <TabsTrigger value="autofill">AutoFill</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              {schema && stats ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard label="字段数" value={stats.fieldCount} />
                    <MetricCard label="必填字段" value={stats.requiredCount} />
                    <MetricCard label="嵌套结构" value={stats.nestedCount} />
                  </div>
                  <FieldTree schema={schema} />
                </div>
              ) : (
                <Callout tone="warning">
                  <CalloutTitle>无法解析结构摘要</CalloutTitle>
                  <CalloutDescription>该版本内容不是标准 JSON object，请查看原始 JSON。</CalloutDescription>
                </Callout>
              )}
            </TabsContent>
            <TabsContent value="schema">
              <CodeBlock title="jsonSchema" language="json" value={formatStoredJson(version.jsonSchema)} maxHeight="34rem" />
            </TabsContent>
            <TabsContent value="autofill">
              {version.autoFill ? (
                <CodeBlock title="autoFill" language="json" value={formatJsonValue(autoFill, formatStoredJson(version.autoFill))} maxHeight="28rem" />
              ) : (
                <Callout tone="info">
                  <CalloutTitle>未配置 AutoFill</CalloutTitle>
                  <CalloutDescription>该版本不会在写入前自动补充服务端字段。</CalloutDescription>
                </Callout>
              )}
            </TabsContent>
            <TabsContent value="rules">
              {version.validationRules ? (
                <CodeBlock title="validationRules" language="text" value={version.validationRules} maxHeight="28rem" />
              ) : (
                <Callout tone="info">
                  <CalloutTitle>未配置 Validation Rules</CalloutTitle>
                  <CalloutDescription>该版本只使用 JSON Schema 和 AutoFill。</CalloutDescription>
                </Callout>
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white/60 p-4 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60">
      <p className="text-xs text-ink-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function FieldTree({ schema }: { schema: Record<string, unknown> }) {
  const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {};
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];

  if (Object.keys(properties).length === 0) {
    return (
      <Callout tone="info">
        <CalloutTitle>根结构未定义字段</CalloutTitle>
        <CalloutDescription>该 Schema 可能允许自由字段，或仍处于初始状态。</CalloutDescription>
      </Callout>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(properties).map(([name, child]) => (
        <FieldTreeNode key={name} name={name} schema={child} required={required.includes(name)} depth={0} />
      ))}
    </div>
  );
}

function FieldTreeNode({
  name,
  schema,
  required,
  depth
}: {
  name: string;
  schema: unknown;
  required: boolean;
  depth: number;
}) {
  const record = schema && typeof schema === "object" && !Array.isArray(schema) ? schema as Record<string, unknown> : {};
  const type = Array.isArray(record.enum) ? "enum" : typeof record.type === "string" ? record.type : "unknown";
  const childProperties = record.properties && typeof record.properties === "object" && !Array.isArray(record.properties)
    ? record.properties as Record<string, unknown>
    : {};
  const childRequired = Array.isArray(record.required) ? record.required.map(String) : [];
  const itemSchema = record.items && typeof record.items === "object" && !Array.isArray(record.items) ? record.items as Record<string, unknown> : null;

  return (
    <div className="rounded-xl border border-ink-200/70 bg-white/60 p-3 text-sm shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60" style={{ marginLeft: depth ? 14 : 0 }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium text-ink-800 dark:text-slate-100">{name}</span>
        <Badge tone="neutral">{type}</Badge>
        {required ? <Badge tone="accent">required</Badge> : null}
        {typeof record.format === "string" ? <Badge tone="neutral">{record.format}</Badge> : null}
        {Array.isArray(record.enum) ? <Badge tone="neutral">{record.enum.length} options</Badge> : null}
      </div>
      {typeof record.description === "string" ? (
        <p className="mt-2 text-xs leading-5 text-ink-500 dark:text-slate-400">{record.description}</p>
      ) : null}
      {Object.keys(childProperties).length > 0 ? (
        <div className="mt-3 space-y-2">
          {Object.entries(childProperties).map(([childName, child]) => (
            <FieldTreeNode
              key={childName}
              name={childName}
              schema={child}
              required={childRequired.includes(childName)}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
      {itemSchema ? (
        <div className="mt-3">
          <FieldTreeNode name="items" schema={itemSchema} required={false} depth={depth + 1} />
        </div>
      ) : null}
    </div>
  );
}

function SchemaEditorDialog({
  appId,
  mode,
  schema,
  seedVersion,
  variant = mode === "create" ? "primary" : "outline",
  size = "md"
}: {
  appId: string;
  mode: "create" | "version";
  schema?: DataSchemaSummary;
  seedVersion?: SchemaVersionSummary;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [dataType, setDataType] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [editorMode, setEditorMode] = React.useState<EditorMode>("builder");
  const [builderFields, setBuilderFields] = React.useState<SchemaFieldModel[]>(EMPTY_FIELDS);
  const [jsonSchema, setJsonSchema] = React.useState(DEFAULT_SCHEMA_TEXT);
  const [autoFillRules, setAutoFillRules] = React.useState<AutoFillRuleModel[]>([]);
  const [autoFillJson, setAutoFillJson] = React.useState("");
  const [autoFillSource, setAutoFillSource] = React.useState<"rules" | "json">("rules");
  const [validationRules, setValidationRules] = React.useState("");
  const [busyIntent, setBusyIntent] = React.useState<SaveIntent | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [compatibilityNote, setCompatibilityNote] = React.useState<string | null>(null);
  const formId = React.useId();
  const busy = Boolean(busyIntent);

  React.useEffect(() => {
    if (!open) return;
    const nextSchemaText = formatStoredJson(seedVersion?.jsonSchema, DEFAULT_SCHEMA_TEXT);
    const parsedSchema = parseStoredRecord(seedVersion?.jsonSchema) ?? DEFAULT_SCHEMA;
    const parsedAutoFill = parseStoredRecord(seedVersion?.autoFill);
    const visual = jsonSchemaToFields(parsedSchema);

    setDataType(schema?.dataType ?? "");
    setDescription(schema?.description ?? "");
    setJsonSchema(nextSchemaText);
    setValidationRules(seedVersion?.validationRules ?? "");
    setAutoFillRules(autoFillObjectToRules(parsedAutoFill));
    setAutoFillJson(formatJsonValue(parsedAutoFill, ""));
    setAutoFillSource("rules");
    setError(null);

    if (visual.ok) {
      setBuilderFields(visual.fields);
      setEditorMode("builder");
      setCompatibilityNote(null);
    } else {
      setBuilderFields([createSchemaField({ name: "field1" })]);
      setEditorMode("advanced");
      setCompatibilityNote(visual.reason);
    }
  }, [open, schema?.dataType, schema?.description, seedVersion?.autoFill, seedVersion?.jsonSchema, seedVersion?.validationRules]);

  const generatedSchemaText = React.useMemo(
    () => JSON.stringify(schemaFieldsToJsonSchema(builderFields), null, 2),
    [builderFields]
  );

  function enterAdvancedFromBuilder() {
    setJsonSchema(generatedSchemaText);
    setEditorMode("advanced");
    setCompatibilityNote(null);
  }

  function tryEnterBuilder() {
    setError(null);
    try {
      const parsedSchema = parseJsonObject(jsonSchema, "JSON Schema");
      const visual = jsonSchemaToFields(parsedSchema);
      if (!visual.ok) {
        setCompatibilityNote(visual.reason);
        return;
      }
      setBuilderFields(visual.fields);
      setEditorMode("builder");
      setCompatibilityNote(null);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    }
  }

  async function submit(intent: SaveIntent) {
    setError(null);

    let parsedSchema: Record<string, unknown>;
    let parsedAutoFill: Record<string, unknown> | undefined;
    try {
      if (editorMode === "builder") validateSchemaFields(builderFields);
      parsedSchema = editorMode === "builder" ? schemaFieldsToJsonSchema(builderFields) : parseJsonObject(jsonSchema, "JSON Schema");
      parsedAutoFill = autoFillSource === "json"
        ? parseOptionalJsonObject(autoFillJson, "AutoFill")
        : autoFillRulesToObject(autoFillRules);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return;
    }

    const normalizedDataType = dataType.trim();
    if (!/^[a-z][a-z0-9_-]*$/.test(normalizedDataType)) {
      setError("dataType 只能以小写字母开头，并包含小写字母、数字、_ 或 -。");
      return;
    }

    setBusyIntent(intent);
    try {
      const res = await fetch(`/api/v1/apps/${encodeURIComponent(appId)}/schemas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataType: normalizedDataType,
          description: description.trim() || undefined,
          jsonSchema: parsedSchema,
          autoFill: parsedAutoFill,
          validationRules: validationRules.trim() || undefined,
          setActive: intent === "active"
        })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success(mode === "create" ? "Schema 已创建" : "Schema 新版本已创建", {
        description: `${normalizedDataType}${intent === "active" ? " 已设为 active" : " 已保存为 draft"}`
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setBusyIntent(null);
    }
  }

  const title = mode === "create" ? "创建 Schema" : `创建 ${schema?.dataType ?? "Schema"} 新版本`;
  const submitDisabled = busy || !dataType.trim();

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {mode === "create" ? <Plus /> : <GitBranch />}
          {mode === "create" ? "创建 Schema" : size === "sm" ? "从此版本创建" : "编辑 / 新版本"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Schema 采用版本化管理；编辑会创建新版本，不会覆盖历史版本。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[74vh] space-y-5 overflow-y-auto">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <Field htmlFor={`${formId}-data-type`} label="dataType" required help="只能包含小写字母、数字、_、-。">
              <Input
                id={`${formId}-data-type`}
                value={dataType}
                onChange={(event) => setDataType(event.target.value)}
                disabled={busy || mode === "version"}
                required
                pattern="[a-z][a-z0-9_-]*"
                placeholder="posts"
              />
            </Field>
            <Field label="保存动作">
              <div className="rounded-xl border border-ink-200/70 bg-white/50 px-3 py-2 text-xs leading-5 text-ink-500 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400">
                可保存草稿，也可创建后立即激活。
              </div>
            </Field>
            <Field htmlFor={`${formId}-description`} label="Schema 级描述" className="lg:col-span-2">
              <Input
                id={`${formId}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={busy}
                maxLength={500}
                placeholder="记录用途、字段约定或迁移说明"
              />
            </Field>
          </div>

          {error ? (
            <Callout tone="danger" icon={AlertTriangle}>
              <CalloutTitle>保存前需要处理</CalloutTitle>
              <CalloutDescription>{error}</CalloutDescription>
            </Callout>
          ) : null}

          {compatibilityNote ? (
            <Callout tone="warning" icon={AlertTriangle}>
              <CalloutTitle>已切换到高级 JSON 模式</CalloutTitle>
              <CalloutDescription>{compatibilityNote}</CalloutDescription>
            </Callout>
          ) : null}

          <Tabs value={editorMode} onValueChange={(value) => {
            if (value === "advanced") enterAdvancedFromBuilder();
            if (value === "builder") tryEnterBuilder();
          }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="builder">可视化 Builder</TabsTrigger>
                <TabsTrigger value="advanced">高级 JSON</TabsTrigger>
              </TabsList>
              <p className="text-xs text-ink-500 dark:text-slate-400">复杂 schema 可留在高级 JSON 模式，保存协议不变。</p>
            </div>
            <TabsContent value="builder">
              <SchemaBuilder fields={builderFields} onChange={setBuilderFields} disabled={busy} />
            </TabsContent>
            <TabsContent value="advanced">
              <Field htmlFor={`${formId}-json-schema`} label="JSON Schema" required error={editorMode === "advanced" ? error : undefined}>
                <Textarea
                  id={`${formId}-json-schema`}
                  className="min-h-[360px] font-mono text-xs"
                  value={jsonSchema}
                  onChange={(event) => setJsonSchema(event.target.value)}
                  disabled={busy}
                  invalid={Boolean(error)}
                  spellCheck={false}
                />
              </Field>
            </TabsContent>
          </Tabs>

          <Tabs defaultValue="rules">
            <TabsList>
              <TabsTrigger value="rules">AutoFill Builder</TabsTrigger>
              <TabsTrigger value="json">AutoFill JSON</TabsTrigger>
              <TabsTrigger value="validation">Validation Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="rules">
              <AutoFillBuilder
                rules={autoFillRules}
                onChange={(nextRules) => {
                  setAutoFillSource("rules");
                  setAutoFillRules(nextRules);
                  try {
                    setAutoFillJson(formatJsonValue(autoFillRulesToObject(nextRules), ""));
                  } catch {
                    setAutoFillJson("");
                  }
                }}
                disabled={busy}
              />
            </TabsContent>
            <TabsContent value="json">
              <Field htmlFor={`${formId}-auto-fill`} label="AutoFill JSON" help="可选；留空表示不启用。">
                <Textarea
                  id={`${formId}-auto-fill`}
                  className="min-h-44 font-mono text-xs"
                  value={autoFillJson}
                  onChange={(event) => {
                    setAutoFillSource("json");
                    setAutoFillJson(event.target.value);
                  }}
                  disabled={busy}
                  spellCheck={false}
                  placeholder="{ }"
                />
              </Field>
            </TabsContent>
            <TabsContent value="validation">
              <Field htmlFor={`${formId}-validation-rules`} label="Validation Rules" help="可选；保留自定义规则文本。">
                <Textarea
                  id={`${formId}-validation-rules`}
                  className="min-h-44 font-mono text-xs"
                  value={validationRules}
                  onChange={(event) => setValidationRules(event.target.value)}
                  disabled={busy}
                  spellCheck={false}
                  placeholder="// optional"
                />
              </Field>
            </TabsContent>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button type="button" variant="outline" loading={busyIntent === "draft"} loadingText="保存中…" disabled={submitDisabled} onClick={() => submit("draft")}>
            保存草稿
          </Button>
          <Button type="button" loading={busyIntent === "active"} loadingText="激活中…" disabled={submitDisabled} onClick={() => submit("active")}>
            创建并激活
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivateSchemaVersionButton({
  appId,
  dataType,
  version
}: {
  appId: string;
  dataType: string;
  version: SchemaVersionSummary;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const active = version.isActive === 1;

  async function activate() {
    if (active || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/apps/${encodeURIComponent(appId)}/schemas/${encodeURIComponent(dataType)}/activate`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ versionId: version.id })
        }
      );
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("Schema 版本已激活", { description: `${dataType} v${version.version}` });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      toast.error("激活失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={active ? "secondary" : "outline"}
      loading={busy}
      loadingText="激活中…"
      disabled={active}
      onClick={activate}
      aria-label={active ? `v${version.version} 已激活` : `激活 v${version.version}`}
      title={active ? undefined : "激活会切换线上写入约束"}
    >
      <CheckCircle2 /> {active ? "已激活" : "激活"}
    </Button>
  );
}