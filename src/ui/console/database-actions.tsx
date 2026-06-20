"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Copy,
  Database,
  Eye,
  HardDrive,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Table2,
  Trash2,
  UploadCloud,
  XCircle
} from "lucide-react";
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface DatabaseKeySummary {
  id: string;
  label: string;
  prefix: string;
  createdById: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface DatabaseSummary {
  id: string;
  appId: string;
  name: string;
  filename: string;
  status: string;
  note: string | null;
  createdById: string | null;
  createdAt: number;
  updatedAt: number;
  lastAccessAt: number | null;
  deletedAt: number | null;
  keys?: DatabaseKeySummary[];
}

interface SchemaSummary {
  id: string;
  dataType: string;
  description: string | null;
  updatedAt: number;
  activeVersion: number | null;
}

interface BindingSummary {
  id: string;
  dataType: string;
  storageKind: string;
  databaseId: string | null;
  tableName: string | null;
  migratedAt: number | null;
}

interface AuditSummary {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  userId: string | null;
  createdAtLabel: string;
  after: string | null;
}

interface ApiErrorResponse {
  error?: { message?: string; details?: unknown };
}

interface DatabaseListResponse extends ApiErrorResponse {
  items?: DatabaseSummary[];
}

interface DatabaseMutationResponse extends ApiErrorResponse {
  database?: DatabaseSummary;
  secret?: string;
}

interface RotateKeyResponse extends ApiErrorResponse {
  key?: DatabaseKeySummary;
  secret?: string;
}

interface SqlResultResponse extends ApiErrorResponse {
  ok?: boolean;
  database?: { id: string; name: string };
  results?: unknown[];
}

interface StatsResponse extends ApiErrorResponse {
  stats?: { sizeBytes: number; tableCount: number; lastAccessAt: number | null };
}

interface TablesResponse extends ApiErrorResponse {
  tables?: Array<{ name: string; sql: string | null }>;
}

interface TableDetailResponse extends ApiErrorResponse {
  columns?: unknown[];
  indexes?: unknown[];
}

interface RowsResponse extends ApiErrorResponse {
  rows?: Array<Record<string, unknown>>;
  total?: number;
  limit?: number;
  offset?: number;
}

interface MigrationResponse extends ApiErrorResponse {
  binding?: BindingSummary;
  database?: { id: string; name: string };
  tableName?: string;
  records?: number;
}

interface TableInfo {
  name: string;
  sql: string | null;
}

const DEFAULT_SQL = "select sqlite_version() as version";
const EMPTY_JSON = "{\n  \n}";

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "disabled") return "warning";
  if (status === "deleted") return "danger";
  return "neutral";
}

function asPrettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonValue(source: string, fallback: unknown, label: string) {
  const trimmed = source.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function parseJsonObject(source: string, label: string) {
  const parsed = parseJsonValue(source, {}, label);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function truncate(value: string | null | undefined, length = 100) {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function databaseOptions(databases: DatabaseSummary[]) {
  return databases.map((db) => ({
    value: db.id,
    label: `${db.name} (${db.status})`,
    disabled: db.status !== "active" || Boolean(db.deletedAt)
  }));
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export function DatabasesWorkspace({
  appId,
  initialDatabases,
  schemas,
  bindings,
  audits
}: {
  appId: string;
  initialDatabases: DatabaseSummary[];
  schemas: SchemaSummary[];
  bindings: BindingSummary[];
  audits: AuditSummary[];
}) {
  const { t, formatDateTime, formatBytes, formatNumber } = useI18n();
  const router = useRouter();
  const [databases, setDatabases] = React.useState(initialDatabases);
  const [selectedId, setSelectedId] = React.useState(initialDatabases[0]?.id ?? "");
  const [secret, setSecret] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDatabases(initialDatabases);
    if (!selectedId && initialDatabases[0]) setSelectedId(initialDatabases[0].id);
  }, [initialDatabases, selectedId]);

  const selected = databases.find((db) => db.id === selectedId) ?? databases[0] ?? null;

  async function refreshList(nextSelectedId?: string) {
    const res = await fetch(`/api/v1/apps/${appId}/databases`, { credentials: "include" });
    const json = await readJson<DatabaseListResponse>(res);
    if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
    const next = json.items ?? [];
    setDatabases(next);
    if (nextSelectedId) setSelectedId(nextSelectedId);
    else if (!next.some((db) => db.id === selectedId)) setSelectedId(next[0]?.id ?? "");
    return next;
  }

  async function createDatabase(input: { name: string; note?: string; createKey: boolean; keyLabel?: string }) {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/databases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input)
      });
      const json = await readJson<DatabaseMutationResponse>(res);
      if (!res.ok || !json.database) {
        throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      }
      setSecret(json.secret ?? null);
      await refreshList(json.database.id);
      toast.success("Database created", { description: json.database.name });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.createFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function patchDatabase(databaseId: string, body: Record<string, unknown>, action = "update") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/databases/${databaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const json = await readJson<DatabaseMutationResponse>(res);
      if (!res.ok || !json.database) {
        throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      }
      await refreshList(databaseId);
      toast.success(t("common.saved"), { description: json.database.name });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.saveFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function postDatabaseAction(databaseId: string, suffix: string, action: string, success: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/databases/${databaseId}/${suffix}`, {
        method: "POST",
        credentials: "include"
      });
      const json = await readJson<DatabaseMutationResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      await refreshList(databaseId);
      toast.success(success);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function deleteDatabase(databaseId: string, permanent = false) {
    setBusy(permanent ? "permanent" : "delete");
    setError(null);
    try {
      const res = await fetch(
        permanent
          ? `/api/v1/apps/${appId}/databases/${databaseId}/permanent`
          : `/api/v1/apps/${appId}/databases/${databaseId}`,
        { method: "DELETE", credentials: "include" }
      );
      const json = await readJson<ApiErrorResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      await refreshList();
      toast.success(permanent ? "Database permanently deleted" : "Database deleted");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.deleteFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function rotateKey(databaseId: string, keyId?: string, label?: string) {
    setBusy("rotate-key");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/databases/${databaseId}/rotate-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyId, label: label?.trim() || undefined })
      });
      const json = await readJson<RotateKeyResponse>(res);
      if (!res.ok || !json.secret) {
        throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      }
      setSecret(json.secret);
      await refreshList(databaseId);
      toast.success("Database key rotated", { description: json.key?.prefix });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function revokeKey(databaseId: string, keyId: string) {
    setBusy("revoke-key");
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/databases/${databaseId}/revoke-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ keyId })
      });
      const json = await readJson<ApiErrorResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: String(res.status) })));
      await refreshList(databaseId);
      toast.success("Database key revoked");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.operationFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function copy(value: string, label = t("common.copied")) {
    await navigator.clipboard.writeText(value);
    toast.success(label);
  }

  return (
    <div className="space-y-5">
      {secret ? (
        <Callout tone="warning">
          <CalloutTitle>New database key secret</CalloutTitle>
          <CalloutDescription>完整 key 只显示这一次，后续只能轮换生成新 key。</CalloutDescription>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-warning-500/20 bg-white/70 px-3 py-2 font-mono text-xs dark:bg-slate-900/40">
              {secret}
            </code>
            <Button size="sm" variant="outline" onClick={() => copy(secret)}>
              <Copy /> {t("common.copy")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
              <XCircle /> {t("common.close")}
            </Button>
          </div>
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="danger">
          <CalloutTitle>{t("common.operationFailed")}</CalloutTitle>
          <CalloutDescription>{error}</CalloutDescription>
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <CreateDatabasePanel onCreate={createDatabase} busy={busy === "create"} />
          <DatabaseList
            databases={databases}
            selectedId={selected?.id ?? ""}
            onSelect={setSelectedId}
            formatDateTime={formatDateTime}
          />
        </div>

        <div className="min-w-0">
          {selected ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="overview">
                  <HardDrive className="mr-2 h-4 w-4" /> Overview
                </TabsTrigger>
                <TabsTrigger value="sql">
                  <Code2 className="mr-2 h-4 w-4" /> SQL
                </TabsTrigger>
                <TabsTrigger value="tables">
                  <Table2 className="mr-2 h-4 w-4" /> Tables
                </TabsTrigger>
                <TabsTrigger value="migrate">
                  <UploadCloud className="mr-2 h-4 w-4" /> Migrate
                </TabsTrigger>
                <TabsTrigger value="audit">
                  <Eye className="mr-2 h-4 w-4" /> Audit
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <DatabaseOverview
                  appId={appId}
                  database={selected}
                  busy={busy}
                  onPatch={patchDatabase}
                  onDelete={deleteDatabase}
                  onRestore={(databaseId) => postDatabaseAction(databaseId, "restore", "restore", "Database restored")}
                  onRotateKey={rotateKey}
                  onRevokeKey={revokeKey}
                  formatDateTime={formatDateTime}
                  formatBytes={formatBytes}
                />
              </TabsContent>

              <TabsContent value="sql">
                <SqlConsole appId={appId} database={selected} />
              </TabsContent>

              <TabsContent value="tables">
                <TablesBrowser appId={appId} database={selected} formatNumber={formatNumber} />
              </TabsContent>

              <TabsContent value="migrate">
                <MigrationPanel
                  appId={appId}
                  database={selected}
                  databases={databases}
                  schemas={schemas}
                  bindings={bindings}
                  onMigrated={() => router.refresh()}
                />
              </TabsContent>

              <TabsContent value="audit">
                <AuditPanel audits={audits} />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-14 text-center text-sm text-ink-500">
                Create a database to unlock SQL console, table browser, keys, and migration tools.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateDatabasePanel({
  onCreate,
  busy
}: {
  onCreate: (input: { name: string; note?: string; createKey: boolean; keyLabel?: string }) => Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [keyLabel, setKeyLabel] = React.useState("default");
  const [createKey, setCreateKey] = React.useState("true");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onCreate({
      name: name.trim(),
      note: note.trim() || undefined,
      createKey: createKey === "true",
      keyLabel: keyLabel.trim() || undefined
    });
    setName("");
    setNote("");
    setKeyLabel("default");
    setCreateKey("true");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create database</CardTitle>
        <CardDescription>每个数据库对应一个独立 SQLite 文件。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field htmlFor="database-name" label="Name" required>
            <Input id="database-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field htmlFor="database-note" label="Note">
            <Input id="database-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field htmlFor="database-create-key" label="Initial key">
              <Select
                id="database-create-key"
                value={createKey}
                onValueChange={setCreateKey}
                options={[
                  { value: "true", label: "Generate" },
                  { value: "false", label: "Skip" }
                ]}
              />
            </Field>
            <Field htmlFor="database-key-label" label="Key label">
              <Input
                id="database-key-label"
                maxLength={80}
                value={keyLabel}
                onChange={(e) => setKeyLabel(e.target.value)}
                disabled={createKey !== "true"}
              />
            </Field>
          </div>
          <Button type="submit" loading={busy} loadingText="Creating..." disabled={!name.trim()}>
            <Plus /> Create
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DatabaseList({
  databases,
  selectedId,
  onSelect,
  formatDateTime
}: {
  databases: DatabaseSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  formatDateTime: (value: number | string | Date) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Databases</CardTitle>
        <CardDescription>{databases.length} SQLite assets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {databases.length === 0 ? (
          <div className="rounded-md border border-ink-100 px-3 py-8 text-center text-sm text-ink-500 dark:border-slate-700">
            No databases yet.
          </div>
        ) : null}
        {databases.map((db) => (
          <button
            key={db.id}
            type="button"
            onClick={() => onSelect(db.id)}
            className={
              "w-full rounded-lg border px-3 py-3 text-left transition-colors " +
              (selectedId === db.id
                ? "border-accent-300 bg-accent-50/70 dark:border-accent-300/40 dark:bg-accent-900/30"
                : "border-ink-200/70 bg-white/50 hover:bg-white/80 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:bg-slate-800/50")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{db.name}</span>
              <Badge tone={statusTone(db.status)}>{db.status}</Badge>
            </div>
            <div className="mt-1 truncate font-mono text-2xs text-ink-400">{db.filename}</div>
            <div className="mt-2 text-2xs text-ink-500">Updated {formatDateTime(db.updatedAt)}</div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function DatabaseOverview({
  appId,
  database,
  busy,
  onPatch,
  onDelete,
  onRestore,
  onRotateKey,
  onRevokeKey,
  formatDateTime,
  formatBytes
}: {
  appId: string;
  database: DatabaseSummary;
  busy: string | null;
  onPatch: (databaseId: string, body: Record<string, unknown>, action?: string) => Promise<void>;
  onDelete: (databaseId: string, permanent?: boolean) => Promise<void>;
  onRestore: (databaseId: string) => Promise<void>;
  onRotateKey: (databaseId: string, keyId?: string, label?: string) => Promise<void>;
  onRevokeKey: (databaseId: string, keyId: string) => Promise<void>;
  formatDateTime: (value: number | string | Date) => string;
  formatBytes: (value: number, options?: { decimals?: number }) => string;
}) {
  const [stats, setStats] = React.useState<StatsResponse["stats"] | null>(null);
  const [statsError, setStatsError] = React.useState<string | null>(null);
  const [statsBusy, setStatsBusy] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [name, setName] = React.useState(database.name);
  const [note, setNote] = React.useState(database.note ?? "");
  const [status, setStatus] = React.useState(database.status === "disabled" ? "disabled" : "active");
  const [keyLabel, setKeyLabel] = React.useState("default");

  React.useEffect(() => {
    setName(database.name);
    setNote(database.note ?? "");
    setStatus(database.status === "disabled" ? "disabled" : "active");
  }, [database.id, database.name, database.note, database.status]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      setStatsBusy(true);
      setStatsError(null);
      try {
        const res = await fetch(`/api/v1/apps/${appId}/databases/${database.id}/stats`, { credentials: "include" });
        const json = await readJson<StatsResponse>(res);
        if (!res.ok) throw new Error(apiMessage(json, `Status ${res.status}`));
        if (!cancelled) setStats(json.stats ?? null);
      } catch (err) {
        if (!cancelled) setStatsError(String((err as Error).message ?? err));
      } finally {
        if (!cancelled) setStatsBusy(false);
      }
    }
    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [appId, database.id]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onPatch(database.id, {
      name: name.trim(),
      note: note.trim() || null,
      status
    });
    setEditOpen(false);
  }

  const sampleKey = database.keys?.find((key) => !key.revokedAt);
  const curl = `curl -X POST ${typeof window === "undefined" ? "" : window.location.origin}/api/query \\\n  -H "Authorization: Bearer <lsq_database_key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"sql":"select sqlite_version() as version","mode":"read"}'`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard icon={HardDrive} label="File size" value={statsBusy ? "Loading..." : stats ? formatBytes(stats.sizeBytes) : "—"} />
        <MetricCard icon={Table2} label="Tables" value={stats ? String(stats.tableCount) : "—"} />
        <MetricCard
          icon={Database}
          label="Last access"
          value={database.lastAccessAt ? formatDateTime(database.lastAccessAt) : "Never"}
        />
      </div>

      {statsError ? (
        <Callout tone="danger">
          <CalloutTitle>Stats unavailable</CalloutTitle>
          <CalloutDescription>{statsError}</CalloutDescription>
        </Callout>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{database.name}</CardTitle>
              <CardDescription className="font-mono">{database.id}</CardDescription>
            </div>
            <Badge tone={statusTone(database.status)}>{database.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
            <InfoLine label="Filename" value={database.filename} mono />
            <InfoLine label="Created" value={formatDateTime(database.createdAt)} />
            <InfoLine label="Updated" value={formatDateTime(database.updatedAt)} />
            <InfoLine label="Deleted" value={database.deletedAt ? formatDateTime(database.deletedAt) : "—"} />
          </div>
          {database.note ? <p className="text-sm text-ink-600 dark:text-slate-300">{database.note}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Save /> Edit
            </Button>
            {database.status === "deleted" || database.deletedAt ? (
              <Button variant="outline" size="sm" loading={busy === "restore"} onClick={() => onRestore(database.id)}>
                <RotateCcw /> Restore
              </Button>
            ) : (
              <Button variant="danger" size="sm" loading={busy === "delete"} onClick={() => onDelete(database.id)}>
                <Trash2 /> Soft delete
              </Button>
            )}
            <Button variant="danger" size="sm" loading={busy === "permanent"} onClick={() => onDelete(database.id, true)}>
              <XCircle /> Permanent delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Database keys</CardTitle>
          <CardDescription>外部接口使用 `Authorization: Bearer lsq_...` 访问对应数据库。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={keyLabel} maxLength={80} onChange={(e) => setKeyLabel(e.target.value)} aria-label="New key label" />
            <Button size="sm" loading={busy === "rotate-key"} onClick={() => onRotateKey(database.id, undefined, keyLabel)}>
              <KeyRound /> Create / rotate key
            </Button>
          </div>
          {(database.keys ?? []).length === 0 ? (
            <div className="rounded-md border border-ink-100 px-3 py-8 text-center text-sm text-ink-500 dark:border-slate-700">
              No keys yet.
            </div>
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(database.keys ?? []).map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>{key.label}</TableCell>
                      <TableCell className="font-mono text-xs">{key.prefix}...</TableCell>
                      <TableCell className="text-xs">{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"}</TableCell>
                      <TableCell>
                        <Badge tone={key.revokedAt ? "danger" : "success"}>{key.revokedAt ? "revoked" : "active"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="xs"
                            variant="outline"
                            loading={busy === "rotate-key"}
                            onClick={() => onRotateKey(database.id, key.id, key.label)}
                          >
                            <RefreshCw /> Rotate
                          </Button>
                          <Button
                            size="xs"
                            variant="danger"
                            disabled={Boolean(key.revokedAt)}
                            loading={busy === "revoke-key"}
                            onClick={() => onRevokeKey(database.id, key.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
          <pre className="overflow-x-auto rounded-md border border-ink-100 bg-cream-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
            {curl}
          </pre>
          {!sampleKey ? (
            <Callout tone="warning">
              <CalloutTitle>No active key</CalloutTitle>
              <CalloutDescription>Create or rotate a key before using `/api/query` or `/api/transaction`.</CalloutDescription>
            </Callout>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={save}>
            <DialogHeader>
              <DialogTitle>Edit database</DialogTitle>
              <DialogDescription>{database.id}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field htmlFor="edit-database-name" label="Name" required>
                <Input id="edit-database-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field htmlFor="edit-database-note" label="Note">
                <Input id="edit-database-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Field htmlFor="edit-database-status" label="Status">
                <Select
                  id="edit-database-status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "active", label: "active" },
                    { value: "disabled", label: "disabled" }
                  ]}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy === "update"} disabled={!name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 text-cream-50 dark:bg-slate-100 dark:text-slate-950">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-2xs uppercase tracking-wide text-ink-400">{label}</div>
          <div className="truncate text-sm font-medium">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className={mono ? "mt-1 break-all font-mono text-ink-700 dark:text-slate-300" : "mt-1 text-ink-700 dark:text-slate-300"}>
        {value}
      </div>
    </div>
  );
}

function SqlConsole({ appId, database }: { appId: string; database: DatabaseSummary }) {
  const [sql, setSql] = React.useState(DEFAULT_SQL);
  const [params, setParams] = React.useState("[]");
  const [mode, setMode] = React.useState("read");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const parsedParams = parseJsonValue(params, [], "Params");
      const res = await fetch(`/api/v1/apps/${appId}/databases/${database.id}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sql, params: parsedParams, mode })
      });
      const json = await readJson<SqlResultResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, `Status ${res.status}`));
      setResult(asPrettyJson(json));
      toast.success("SQL executed");
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("SQL failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SQL console</CardTitle>
        <CardDescription>管理员控制台 SQL 会被审计；外部 key 仍受安全 SQL 策略限制。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Field htmlFor="sql-mode" label="Mode">
            <Select
              id="sql-mode"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "read", label: "read" },
                { value: "write", label: "write" },
                { value: "auto", label: "auto" }
              ]}
            />
          </Field>
          <Field htmlFor="sql-input" label="SQL" required error={error}>
            <Textarea
              id="sql-input"
              className="min-h-[180px] font-mono text-xs"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
              invalid={Boolean(error)}
            />
          </Field>
          <Field htmlFor="sql-params" label="Params JSON">
            <Textarea
              id="sql-params"
              className="min-h-[100px] font-mono text-xs"
              value={params}
              onChange={(e) => setParams(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Button type="submit" loading={busy} disabled={!sql.trim()}>
            <Code2 /> Execute
          </Button>
        </form>
        {result ? (
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-md border border-ink-100 bg-cream-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
            {result}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TablesBrowser({
  appId,
  database,
  formatNumber
}: {
  appId: string;
  database: DatabaseSummary;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  const [tables, setTables] = React.useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = React.useState("");
  const [columns, setColumns] = React.useState<unknown[]>([]);
  const [indexes, setIndexes] = React.useState<unknown[]>([]);
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rowEditor, setRowEditor] = React.useState<{ mode: "create" | "edit"; rowid?: number; data: string } | null>(null);
  const limit = 50;

  const loadTables = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/databases/${database.id}/tables`, { credentials: "include" });
      const json = await readJson<TablesResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, `Status ${res.status}`));
      const nextTables = json.tables ?? [];
      setTables(nextTables);
      setSelectedTable((current) => (nextTables.some((table) => table.name === current) ? current : nextTables[0]?.name ?? ""));
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }, [appId, database.id]);

  const loadTableDetail = React.useCallback(
    async (table: string) => {
      if (!table) {
        setColumns([]);
        setIndexes([]);
        setRows([]);
        setTotal(0);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const [detailRes, rowsRes] = await Promise.all([
          fetch(`/api/v1/apps/${appId}/databases/${database.id}/tables/${encodeURIComponent(table)}`, { credentials: "include" }),
          fetch(
            `/api/v1/apps/${appId}/databases/${database.id}/tables/${encodeURIComponent(table)}/rows?limit=${limit}&offset=${offset}`,
            { credentials: "include" }
          )
        ]);
        const detail = await readJson<TableDetailResponse>(detailRes);
        const rowsJson = await readJson<RowsResponse>(rowsRes);
        if (!detailRes.ok) throw new Error(apiMessage(detail, `Status ${detailRes.status}`));
        if (!rowsRes.ok) throw new Error(apiMessage(rowsJson, `Status ${rowsRes.status}`));
        setColumns(detail.columns ?? []);
        setIndexes(detail.indexes ?? []);
        setRows(rowsJson.rows ?? []);
        setTotal(rowsJson.total ?? 0);
      } catch (err) {
        setError(String((err as Error).message ?? err));
      } finally {
        setBusy(false);
      }
    },
    [appId, database.id, offset]
  );

  React.useEffect(() => {
    void loadTables();
  }, [loadTables]);

  React.useEffect(() => {
    void loadTableDetail(selectedTable);
  }, [selectedTable, loadTableDetail]);

  async function saveRow(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rowEditor || !selectedTable) return;
    setBusy(true);
    setError(null);
    try {
      const data = parseJsonObject(rowEditor.data, "Row");
      const url =
        rowEditor.mode === "create"
          ? `/api/v1/apps/${appId}/databases/${database.id}/tables/${encodeURIComponent(selectedTable)}/rows`
          : `/api/v1/apps/${appId}/databases/${database.id}/tables/${encodeURIComponent(selectedTable)}/rows/${rowEditor.rowid}`;
      const res = await fetch(url, {
        method: rowEditor.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data })
      });
      const json = await readJson<ApiErrorResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, `Status ${res.status}`));
      setRowEditor(null);
      toast.success(rowEditor.mode === "create" ? "Row inserted" : "Row updated");
      await loadTableDetail(selectedTable);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("Row save failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(rowid: number) {
    if (!selectedTable) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/apps/${appId}/databases/${database.id}/tables/${encodeURIComponent(selectedTable)}/rows/${rowid}`,
        { method: "DELETE", credentials: "include" }
      );
      const json = await readJson<ApiErrorResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, `Status ${res.status}`));
      toast.success("Row deleted");
      await loadTableDetail(selectedTable);
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("Row delete failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Table browser</CardTitle>
              <CardDescription>查看表结构、索引和分页行数据。</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => loadTables()} loading={busy}>
              <RefreshCw /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Callout tone="danger">
              <CalloutTitle>Table operation failed</CalloutTitle>
              <CalloutDescription>{error}</CalloutDescription>
            </Callout>
          ) : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              {tables.length === 0 ? (
                <div className="rounded-md border border-ink-100 px-3 py-8 text-center text-sm text-ink-500 dark:border-slate-700">
                  No tables. Use SQL console to create one.
                </div>
              ) : null}
              {tables.map((table) => (
                <button
                  key={table.name}
                  type="button"
                  onClick={() => {
                    setOffset(0);
                    setSelectedTable(table.name);
                  }}
                  className={
                    "w-full rounded-md border px-3 py-2 text-left text-sm " +
                    (selectedTable === table.name
                      ? "border-accent-300 bg-accent-50 dark:border-accent-300/40 dark:bg-accent-900/30"
                      : "border-ink-200/70 bg-white/50 hover:bg-white/80 dark:border-slate-700 dark:bg-slate-900/30")
                  }
                >
                  <div className="font-mono">{table.name}</div>
                  <div className="mt-1 truncate text-2xs text-ink-400">{truncate(table.sql, 90)}</div>
                </button>
              ))}
            </div>

            <div className="min-w-0 space-y-4">
              {selectedTable ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-mono text-sm font-semibold">{selectedTable}</h3>
                      <p className="text-xs text-ink-500">{formatNumber(total)} rows</p>
                    </div>
                    <Button size="sm" onClick={() => setRowEditor({ mode: "create", data: EMPTY_JSON })}>
                      <Plus /> Insert row
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <JsonPanel title="Columns" value={columns} />
                    <JsonPanel title="Indexes" value={indexes} />
                  </div>
                  <RowsTable rows={rows} onEdit={setRowEditor} onDelete={deleteRow} />
                  <div className="flex items-center justify-between gap-3">
                    <Button size="sm" variant="outline" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                      Previous
                    </Button>
                    <span className="text-xs text-ink-500">
                      {formatNumber(offset + 1)} - {formatNumber(Math.min(offset + limit, total))} / {formatNumber(total)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={offset + limit >= total}
                      onClick={() => setOffset(offset + limit)}
                    >
                      Next
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(rowEditor)} onOpenChange={(next) => !next && setRowEditor(null)}>
        <DialogContent className="max-w-2xl">
          {rowEditor ? (
            <form onSubmit={saveRow}>
              <DialogHeader>
                <DialogTitle>{rowEditor.mode === "create" ? "Insert row" : "Edit row"}</DialogTitle>
                <DialogDescription className="font-mono">{selectedTable}</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <Field htmlFor="row-json" label="Row JSON" required error={error}>
                  <Textarea
                    id="row-json"
                    className="min-h-[320px] font-mono text-xs"
                    value={rowEditor.data}
                    onChange={(e) => setRowEditor({ ...rowEditor, data: e.target.value })}
                    spellCheck={false}
                    invalid={Boolean(error)}
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRowEditor(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border border-ink-100 bg-cream-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="mb-2 text-xs font-medium text-ink-600 dark:text-slate-300">{title}</div>
      <pre className="max-h-[220px] overflow-auto text-xs">{asPrettyJson(value)}</pre>
    </div>
  );
}

function RowsTable({
  rows,
  onEdit,
  onDelete
}: {
  rows: Array<Record<string, unknown>>;
  onEdit: (editor: { mode: "edit"; rowid?: number; data: string }) => void;
  onDelete: (rowid: number) => void;
}) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);
  if (rows.length === 0) {
    return <div className="rounded-md border border-ink-100 px-3 py-8 text-center text-sm text-ink-500 dark:border-slate-700">No rows.</div>;
  }
  return (
    <TableShell>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} className="font-mono">
                {column}
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const rowid = typeof row._rowid_ === "number" ? row._rowid_ : Number(row._rowid_);
            return (
              <TableRow key={Number.isFinite(rowid) ? rowid : index}>
                {columns.map((column) => (
                  <TableCell key={column} className="max-w-[220px] truncate font-mono text-xs">
                    {typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? "")}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onEdit({ mode: "edit", rowid, data: asPrettyJson(withoutRowid(row)) })}
                    >
                      Edit
                    </Button>
                    <Button size="xs" variant="danger" disabled={!Number.isFinite(rowid)} onClick={() => onDelete(rowid)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableShell>
  );
}

function withoutRowid(row: Record<string, unknown>) {
  const copy = { ...row };
  delete copy._rowid_;
  return copy;
}

function MigrationPanel({
  appId,
  database,
  databases,
  schemas,
  bindings,
  onMigrated
}: {
  appId: string;
  database: DatabaseSummary;
  databases: DatabaseSummary[];
  schemas: SchemaSummary[];
  bindings: BindingSummary[];
  onMigrated: () => void;
}) {
  const [dataType, setDataType] = React.useState(schemas[0]?.dataType ?? "");
  const [databaseId, setDatabaseId] = React.useState(database.id);
  const [tableName, setTableName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<MigrationResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDatabaseId(database.id);
  }, [database.id]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/data/${dataType}/migrate-to-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          databaseId,
          tableName: tableName.trim() || undefined
        })
      });
      const json = await readJson<MigrationResponse>(res);
      if (!res.ok) throw new Error(apiMessage(json, `Status ${res.status}`));
      setResult(json);
      toast.success("Data migrated", { description: `${json.records ?? 0} records` });
      onMigrated();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("Migration failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const bindingByType = new Map(bindings.map((binding) => [binding.dataType, binding]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Migrate Data API records</CardTitle>
        <CardDescription>
          导入后会写入 `external_sql` binding，原 Data API 对该 dataType 禁止继续读写主库，避免双写冲突。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field htmlFor="migrate-data-type" label="dataType" required>
            <Select
              id="migrate-data-type"
              value={dataType}
              onValueChange={setDataType}
              options={schemas.map((schema) => ({
                value: schema.dataType,
                label: `${schema.dataType}${schema.activeVersion ? ` v${schema.activeVersion}` : ""}`
              }))}
            />
          </Field>
          <Field htmlFor="migrate-database" label="Target database" required>
            <Select id="migrate-database" value={databaseId} onValueChange={setDatabaseId} options={databaseOptions(databases)} />
          </Field>
          <Field htmlFor="migrate-table" label="Table name">
            <Input id="migrate-table" value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder={dataType} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" loading={busy} disabled={!dataType || !databaseId}>
              <UploadCloud /> Migrate
            </Button>
          </div>
        </form>

        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>dataType</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schemas.map((schema) => {
                const binding = bindingByType.get(schema.dataType);
                return (
                  <TableRow key={schema.id}>
                    <TableCell className="font-mono text-xs">{schema.dataType}</TableCell>
                    <TableCell>
                      <Badge tone={binding?.storageKind === "external_sql" ? "warning" : "neutral"}>
                        {binding?.storageKind ?? "main"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {binding?.databaseId ? `${binding.databaseId} / ${binding.tableName ?? "—"}` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableShell>

        {error ? (
          <Callout tone="danger">
            <CalloutTitle>Migration failed</CalloutTitle>
            <CalloutDescription>{error}</CalloutDescription>
          </Callout>
        ) : null}
        {result ? <JsonPanel title="Migration result" value={result} /> : null}
      </CardContent>
    </Card>
  );
}

function AuditPanel({ audits }: { audits: AuditSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Database audit logs</CardTitle>
        <CardDescription>最近的数据库、key 和迁移动作。</CardDescription>
      </CardHeader>
      <CardContent>
        {audits.length === 0 ? (
          <div className="py-12 text-center text-sm text-ink-500">No audit logs yet.</div>
        ) : (
          <div className="space-y-2">
            {audits.map((log) => (
              <div key={log.id} className="rounded-md border border-ink-100 bg-white/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/30">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{log.action}</Badge>
                      <span className="font-mono text-xs text-ink-500">{log.resourceType}</span>
                    </div>
                    <div className="mt-1 truncate font-mono text-2xs text-ink-400">{log.resourceId ?? "—"}</div>
                  </div>
                  <div className="shrink-0 text-xs text-ink-500">{log.createdAtLabel}</div>
                </div>
                {log.after ? (
                  <pre className="mt-2 max-h-24 overflow-auto rounded bg-cream-50 p-2 text-2xs dark:bg-slate-950/40">
                    {truncate(log.after, 600)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
