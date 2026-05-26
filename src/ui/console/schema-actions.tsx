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
import { useI18n } from "@/ui/i18n";
import type { TranslationValues } from "@/shared/i18n/config";

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

function parseJsonObject(
  source: string,
  label: string,
  translate: (key: string, values?: TranslationValues) => string
) {
  try {
    return parseJsonRecord(source);
  } catch (err) {
    const message = String((err as Error).message ?? err);
    if (message.includes("JSON")) throw new Error(translate("common.jsonInvalidLabel", { label }));
    throw new Error(translate("common.jsonMustBeObjectLabel", { label }));
  }
}

function parseOptionalJsonObject(
  source: string,
  label: string,
  translate: (key: string, values?: TranslationValues) => string
) {
  const trimmed = source.trim();
  if (!trimmed) return undefined;
  const parsed = parseJsonObject(trimmed, label, translate);
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
  const { t } = useI18n();

  return (
    <div className="container-page space-y-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("common.schemas")}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
            {t("schema.panelDescription")}
          </p>
        </div>
        <SchemaEditorDialog appId={appId} mode="create" />
      </header>

      {schemas.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm font-medium text-ink-800 dark:text-slate-200">{t("schema.emptyTitle")}</p>
            <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">
              {t("schema.emptyDescription")}
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
  const { t, formatDateTime } = useI18n();
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
                <Badge tone="success">{t("common.active")} v{activeVersion.version}</Badge>
              ) : (
                <Badge tone="warning">{t("schema.inactive")}</Badge>
              )}
              <Badge tone="neutral">{t("schema.versionCount", { count: schema.versions.length })}</Badge>
            </div>
            <CardDescription className="max-w-3xl">
              {schema.description || t("schema.noDescription")}
            </CardDescription>
            <p className="text-xs text-ink-400 dark:text-slate-500">
              {t("schema.updatedAt", { time: formatDateTime(schema.updatedAt) })}
            </p>
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
                <Database /> {t("schema.browseData")}
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
                <TableHead>{t("schema.version")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("schema.structure")}</TableHead>
                <TableHead>{t("schema.config")}</TableHead>
                <TableHead>{t("schema.createdAt")}</TableHead>
                <TableHead className="text-right">{t("schema.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schema.versions.map((version) => (
                <TableRow key={version.id} className="align-top">
                  <TableCell className="font-mono text-xs text-ink-700 dark:text-slate-200">v{version.version}</TableCell>
                  <TableCell>
                    {version.isActive === 1 ? (
                      <Badge tone="success">{t("common.active")}</Badge>
                    ) : (
                      <Badge>draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="min-w-52">
                    <VersionStructureSummary version={version} />
                  </TableCell>
                  <TableCell className="min-w-56">
                    <VersionPreview version={version} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-ink-500 dark:text-slate-400">
                    {formatDateTime(version.createdAt)}
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
  const { t } = useI18n();
  const stats = versionStats(version);
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <Badge tone="neutral">{stats.fieldCount} {t("schema.fieldCount")}</Badge>
      <Badge tone={stats.requiredCount > 0 ? "accent" : "neutral"}>
        {stats.requiredCount} {t("schema.requiredCount")}
      </Badge>
      {stats.nestedCount > 0 ? (
        <Badge tone="neutral">{stats.nestedCount} {t("schema.nestedCount")}</Badge>
      ) : null}
    </div>
  );
}

function VersionPreview({ version }: { version: SchemaVersionSummary }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge tone="neutral">JSON Schema</Badge>
      {version.autoFill ? <Badge tone="accent">{t("schema.tabAutoFill")}</Badge> : null}
      {version.validationRules ? <Badge tone="warning">{t("schema.tabValidation")}</Badge> : null}
      <SchemaVersionDetailDialog version={version} />
    </div>
  );
}

function SchemaVersionDetailDialog({ version }: { version: SchemaVersionSummary }) {
  const { t, formatDateTime } = useI18n();
  const schema = parseStoredRecord(version.jsonSchema);
  const autoFill = parseStoredRecord(version.autoFill);
  const stats = schema ? countSchemaStats(schema) : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="xs">{t("schema.viewDetails")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("common.schemas")} v{version.version}</DialogTitle>
          <DialogDescription>
            {t("schema.versionCreatedAt", {
              time: formatDateTime(version.createdAt),
              status: version.isActive === 1 ? t("schema.versionActive") : t("schema.versionDraft")
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[74vh] overflow-y-auto">
          <Tabs defaultValue="summary">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="summary">{t("schema.tabSummary")}</TabsTrigger>
              <TabsTrigger value="schema">JSON Schema</TabsTrigger>
              <TabsTrigger value="autofill">{t("schema.tabAutoFill")}</TabsTrigger>
              <TabsTrigger value="rules">{t("schema.tabValidation")}</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              {schema && stats ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard label={t("schema.fieldCount")} value={stats.fieldCount} />
                    <MetricCard label={t("schema.requiredCount")} value={stats.requiredCount} />
                    <MetricCard label={t("schema.nestedCount")} value={stats.nestedCount} />
                  </div>
                  <FieldTree schema={schema} />
                </div>
              ) : (
                <Callout tone="warning">
                  <CalloutTitle>{t("schema.parseSummaryFailed")}</CalloutTitle>
                  <CalloutDescription>{t("schema.parseSummaryHint")}</CalloutDescription>
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
                  <CalloutTitle>{t("schema.noAutoFill")}</CalloutTitle>
                  <CalloutDescription>{t("schema.noAutoFillHint")}</CalloutDescription>
                </Callout>
              )}
            </TabsContent>
            <TabsContent value="rules">
              {version.validationRules ? (
                <CodeBlock title="validationRules" language="text" value={version.validationRules} maxHeight="28rem" />
              ) : (
                <Callout tone="info">
                  <CalloutTitle>{t("schema.noValidation")}</CalloutTitle>
                  <CalloutDescription>{t("schema.noValidationHint")}</CalloutDescription>
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
  const { t } = useI18n();
  const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? schema.properties as Record<string, unknown>
    : {};
  const required = Array.isArray(schema.required) ? schema.required.map(String) : [];

  if (Object.keys(properties).length === 0) {
    return (
      <Callout tone="info">
        <CalloutTitle>{t("schema.noRootFields")}</CalloutTitle>
        <CalloutDescription>{t("schema.noRootFieldsHint")}</CalloutDescription>
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
  const { t } = useI18n();
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
        {required ? <Badge tone="accent">{t("schemaBuilder.required")}</Badge> : null}
        {typeof record.format === "string" ? <Badge tone="neutral">{record.format}</Badge> : null}
        {Array.isArray(record.enum) ? (
          <Badge tone="neutral">{record.enum.length} {t("schemaBuilder.enumOptions")}</Badge>
        ) : null}
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
  const { t } = useI18n();
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
      const parsedSchema = parseJsonObject(jsonSchema, "JSON Schema", t);
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
      parsedSchema = editorMode === "builder"
        ? schemaFieldsToJsonSchema(builderFields)
        : parseJsonObject(jsonSchema, "JSON Schema", t);
      parsedAutoFill = autoFillSource === "json"
        ? parseOptionalJsonObject(autoFillJson, "AutoFill", t)
        : autoFillRulesToObject(autoFillRules);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return;
    }

    const normalizedDataType = dataType.trim();
    if (!/^[a-z][a-z0-9_-]*$/.test(normalizedDataType)) {
      setError(t("schema.dataTypeInvalid"));
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(mode === "create" ? t("schema.created") : t("schema.versionCreated"), {
        description: t("schema.createdDescription", {
          dataType: normalizedDataType,
          suffix: intent === "active" ? t("schema.createdActiveSuffix") : t("schema.createdDraftSuffix")
        })
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.saveFailed"), { description: message });
    } finally {
      setBusyIntent(null);
    }
  }

  const title = mode === "create"
    ? t("schema.createTitle")
    : t("schema.newVersionTitle", { dataType: schema?.dataType ?? t("common.schemas") });
  const submitDisabled = busy || !dataType.trim();

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {mode === "create" ? <Plus /> : <GitBranch />}
          {mode === "create"
            ? t("schema.createButton")
            : size === "sm"
              ? t("schema.fromVersionCreate")
              : t("schema.editNewVersion")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("schema.editorDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[74vh] space-y-5 overflow-y-auto">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <Field htmlFor={`${formId}-data-type`} label={t("schema.dataType")} required help={t("schema.dataTypeHelp")}>
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
            <Field label={t("schema.saveIntent")}>
              <div className="rounded-xl border border-ink-200/70 bg-white/50 px-3 py-2 text-xs leading-5 text-ink-500 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400">
                {t("schema.saveIntentHelp")}
              </div>
            </Field>
            <Field htmlFor={`${formId}-description`} label={t("schema.schemaDescription")} className="lg:col-span-2">
              <Input
                id={`${formId}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={busy}
                maxLength={500}
                placeholder={t("schema.schemaDescriptionPlaceholder")}
              />
            </Field>
          </div>

          {error ? (
            <Callout tone="danger" icon={AlertTriangle}>
              <CalloutTitle>{t("schema.fixBeforeSave")}</CalloutTitle>
              <CalloutDescription>{error}</CalloutDescription>
            </Callout>
          ) : null}

          {compatibilityNote ? (
            <Callout tone="warning" icon={AlertTriangle}>
              <CalloutTitle>{t("schema.advancedMode")}</CalloutTitle>
              <CalloutDescription>{compatibilityNote}</CalloutDescription>
            </Callout>
          ) : null}

          <Tabs value={editorMode} onValueChange={(value) => {
            if (value === "advanced") enterAdvancedFromBuilder();
            if (value === "builder") tryEnterBuilder();
          }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="builder">{t("schema.tabBuilder")}</TabsTrigger>
                <TabsTrigger value="advanced">{t("schema.tabAdvanced")}</TabsTrigger>
              </TabsList>
              <p className="text-xs text-ink-500 dark:text-slate-400">{t("schema.builderHint")}</p>
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
              <TabsTrigger value="rules">{t("schema.tabAutoFill")}</TabsTrigger>
              <TabsTrigger value="json">{t("schema.autoFillJson")}</TabsTrigger>
              <TabsTrigger value="validation">{t("schema.validationRules")}</TabsTrigger>
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
              <Field htmlFor={`${formId}-auto-fill`} label={t("schema.autoFillJson")} help={t("schema.autoFillHelp")}>
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
              <Field
                htmlFor={`${formId}-validation-rules`}
                label={t("schema.validationRules")}
                help={t("schema.validationHelp")}
              >
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
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={busyIntent === "draft"}
            loadingText={t("common.saving")}
            disabled={submitDisabled}
            onClick={() => submit("draft")}
          >
            {t("schema.saveDraft")}
          </Button>
          <Button
            type="button"
            loading={busyIntent === "active"}
            loadingText={t("schema.activating")}
            disabled={submitDisabled}
            onClick={() => submit("active")}
          >
            {t("schema.createAndActivate")}
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
  const { t } = useI18n();
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("schema.versionActivated"), { description: `${dataType} v${version.version}` });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      toast.error(t("schema.activateFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={active ? "secondary" : "outline"}
      loading={busy}
      loadingText={t("schema.activating")}
      disabled={active}
      onClick={activate}
      aria-label={
        active
          ? `v${version.version} ${t("schema.activated")}`
          : `${t("schema.activate")} v${version.version}`
      }
      title={active ? undefined : t("schema.activateTitle")}
    >
      <CheckCircle2 /> {active ? t("schema.activated") : t("schema.activate")}
    </Button>
  );
}