"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Database, GitBranch, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Select,
  Textarea,
  toast
} from "@/ui/primitives";

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

const DEFAULT_SCHEMA_TEXT = JSON.stringify(
  {
    type: "object",
    properties: {},
    additionalProperties: true
  },
  null,
  2
);

function formatStoredJson(source: string | null | undefined, fallback = "") {
  if (!source) return fallback;
  try {
    return JSON.stringify(JSON.parse(source), null, 2);
  } catch {
    return source;
  }
}

function parseJsonObject(source: string, label: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(`${label} 必须是合法 JSON object。`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object。`);
  }
  return parsed as Record<string, unknown>;
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

export function SchemaManagementPanel({ appId, schemas }: { appId: string; schemas: DataSchemaSummary[] }) {
  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Schemas</h1>
          <p className="text-sm text-ink-500 mt-1">
            管理 dataType 写入约束、版本切换和数据浏览入口。
          </p>
        </div>
        <SchemaEditorDialog appId={appId} mode="create" />
      </header>

      {schemas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm font-medium text-ink-800">尚未定义任何 Schema</p>
            <p className="mt-1 text-xs text-ink-500">
              创建第一个 Schema 后，就可以在 Data 页面写入受校验的记录。
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
              {schema.description || "未填写描述。"}
            </CardDescription>
            <p className="text-xs text-ink-400">更新于 {formatTime(schema.updatedAt)}</p>
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
              <Link href={`/console/apps/${appId}/data/${schema.dataType}`}>
                <Database /> 浏览数据
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-xs text-ink-500">
            <tr>
              <th className="px-5 py-2 text-left font-medium">版本</th>
              <th className="px-5 py-2 text-left font-medium">状态</th>
              <th className="px-5 py-2 text-left font-medium">配置</th>
              <th className="px-5 py-2 text-left font-medium">创建时间</th>
              <th className="px-5 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {schema.versions.map((version) => (
              <tr key={version.id} className="border-t border-ink-100 align-top hover:bg-cream-50/60">
                <td className="px-5 py-4 font-mono text-xs text-ink-700">v{version.version}</td>
                <td className="px-5 py-4">
                  {version.isActive === 1 ? <Badge tone="success">active</Badge> : <Badge>draft</Badge>}
                </td>
                <td className="px-5 py-4 min-w-[320px]">
                  <VersionPreview version={version} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-xs text-ink-500">
                  {formatTime(version.createdAt)}
                </td>
                <td className="px-5 py-4">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function VersionPreview({ version }: { version: SchemaVersionSummary }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral">JSON Schema</Badge>
        {version.autoFill ? <Badge tone="accent">autoFill</Badge> : null}
        {version.validationRules ? <Badge tone="warning">validationRules</Badge> : null}
      </div>
      <details className="group rounded-md border border-ink-100 bg-white">
        <summary className="cursor-pointer select-none px-3 py-2 text-ink-600 outline-none transition-colors hover:bg-cream-50 focus-visible:ring-2 focus-visible:ring-accent-400/30">
          查看版本内容
        </summary>
        <div className="space-y-3 border-t border-ink-100 p-3">
          <VersionBlock title="jsonSchema" value={formatStoredJson(version.jsonSchema)} />
          {version.autoFill ? <VersionBlock title="autoFill" value={formatStoredJson(version.autoFill)} /> : null}
          {version.validationRules ? <VersionBlock title="validationRules" value={version.validationRules} /> : null}
        </div>
      </details>
    </div>
  );
}

function VersionBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="mb-1 font-mono text-2xs uppercase tracking-wide text-ink-400">{title}</p>
      <pre className="max-h-56 overflow-auto rounded-sm bg-cream-50 p-3 text-xs leading-5 text-ink-700">
        {value}
      </pre>
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
  const [jsonSchema, setJsonSchema] = React.useState(DEFAULT_SCHEMA_TEXT);
  const [autoFill, setAutoFill] = React.useState("");
  const [validationRules, setValidationRules] = React.useState("");
  const [setActive, setSetActive] = React.useState("true");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    setDataType(schema?.dataType ?? "");
    setDescription(schema?.description ?? "");
    setJsonSchema(formatStoredJson(seedVersion?.jsonSchema, DEFAULT_SCHEMA_TEXT));
    setAutoFill(formatStoredJson(seedVersion?.autoFill, ""));
    setValidationRules(seedVersion?.validationRules ?? "");
    setSetActive("true");
    setError(null);
  }, [open, schema?.dataType, schema?.description, seedVersion?.autoFill, seedVersion?.jsonSchema, seedVersion?.validationRules]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    let parsedSchema: Record<string, unknown>;
    let parsedAutoFill: Record<string, unknown> | undefined;
    try {
      parsedSchema = parseJsonObject(jsonSchema, "JSON Schema");
      parsedAutoFill = parseOptionalJsonObject(autoFill, "AutoFill");
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return;
    }

    const normalizedDataType = dataType.trim();
    if (!/^[a-z][a-z0-9_-]*$/.test(normalizedDataType)) {
      setError("dataType 只能以小写字母开头，并包含小写字母、数字、_ 或 -。");
      return;
    }

    setBusy(true);
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
          setActive: setActive === "true"
        })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success(mode === "create" ? "Schema 已创建" : "Schema 新版本已创建", {
        description: `${normalizedDataType}${setActive === "true" ? " 已设为 active" : " 已保存为 draft"}`
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "create" ? "创建 Schema" : `创建 ${schema?.dataType ?? "Schema"} 新版本`;
  const submitText = mode === "create" ? "创建" : "创建新版本";

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {mode === "create" ? <Plus /> : <GitBranch />}
          {mode === "create" ? "创建 Schema" : size === "sm" ? "从此版本创建" : "编辑 / 新版本"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Schema 采用版本化管理；编辑会创建新版本，不会覆盖历史版本。
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid max-h-[70vh] gap-4 overflow-y-auto lg:grid-cols-2">
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
            <Field htmlFor={`${formId}-active`} label="保存后状态" required>
              <Select
                id={`${formId}-active`}
                value={setActive}
                onChange={(event) => setSetActive(event.target.value)}
                disabled={busy}
              >
                <option value="true">设为 active</option>
                <option value="false">仅保存为 draft</option>
              </Select>
            </Field>
            <Field htmlFor={`${formId}-description`} label="描述" className="lg:col-span-2">
              <Input
                id={`${formId}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={busy}
                maxLength={500}
                placeholder="记录用途、字段约定或迁移说明"
              />
            </Field>
            <Field htmlFor={`${formId}-json-schema`} label="JSON Schema" required error={error} className="lg:col-span-2">
              <Textarea
                id={`${formId}-json-schema`}
                className="min-h-[280px] font-mono text-xs"
                value={jsonSchema}
                onChange={(event) => setJsonSchema(event.target.value)}
                disabled={busy}
                invalid={Boolean(error)}
                spellCheck={false}
              />
            </Field>
            <Field htmlFor={`${formId}-auto-fill`} label="AutoFill JSON" help="可选；留空表示不启用。">
              <Textarea
                id={`${formId}-auto-fill`}
                className="min-h-36 font-mono text-xs"
                value={autoFill}
                onChange={(event) => setAutoFill(event.target.value)}
                disabled={busy}
                spellCheck={false}
                placeholder="{ }"
              />
            </Field>
            <Field htmlFor={`${formId}-validation-rules`} label="Validation Rules" help="可选；保留自定义规则文本。">
              <Textarea
                id={`${formId}-validation-rules`}
                className="min-h-36 font-mono text-xs"
                value={validationRules}
                onChange={(event) => setValidationRules(event.target.value)}
                disabled={busy}
                spellCheck={false}
                placeholder="// optional"
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button type="submit" loading={busy} loadingText="保存中…" disabled={!dataType.trim()}>
              {submitText}
            </Button>
          </DialogFooter>
        </form>
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
    >
      <CheckCircle2 /> {active ? "已激活" : "激活"}
    </Button>
  );
}