"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Textarea,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface RecordActionResponse {
  record?: { id: string };
  error?: { message?: string; details?: unknown };
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(source: string, t: (key: string, values?: Record<string, string>) => string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(t("data.jsonRecordExample"));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("data.jsonRecordMustBeObject"));
  }
  return parsed as Record<string, unknown>;
}

function apiMessage(json: RecordActionResponse, fallback: string) {
  if (!json.error) return fallback;
  const details = json.error.details;
  if (details && typeof details === "object" && "errors" in details) {
    return `${json.error.message ?? fallback}: ${JSON.stringify(details.errors)}`;
  }
  return json.error.message ?? fallback;
}

export function CreateRecordButton({ appId, dataType }: { appId: string; dataType: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState("{\n  \n}");
  const [ownerId, setOwnerId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(data, t);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/data/${dataType}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: parsed, ownerId: ownerId.trim() || undefined })
      });
      const json = (await res.json().catch(() => ({}))) as RecordActionResponse;
      if (!res.ok || !json.record?.id) {
        throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      }
      toast.success(t("data.recordCreated"), { description: json.record.id });
      setOpen(false);
      setData("{\n  \n}");
      setOwnerId("");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.createFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <Plus /> {t("data.createRecord")}
      </Button>
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t("data.createRecordTitle")}</DialogTitle>
            <DialogDescription>{t("data.createRecordDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field htmlFor="record-owner" label={t("common.owner")} help={t("data.ownerHelp")}>
              <Input
                id="record-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={busy}
                placeholder={t("common.optional")}
              />
            </Field>
            <Field htmlFor="record-data" label={t("data.dataJson")} required error={error}>
              <Textarea
                id="record-data"
                className="min-h-[320px] font-mono text-xs"
                spellCheck={false}
                invalid={Boolean(error)}
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={busy}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy} loadingText={t("common.creating")}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecordRowActions({
  appId,
  dataType,
  recordId,
  initialData
}: {
  appId: string;
  dataType: string;
  recordId: string;
  initialData: unknown;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [data, setData] = React.useState(formatJson(initialData));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!editOpen) setData(formatJson(initialData));
  }, [editOpen, initialData]);

  async function saveRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(data, t);
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/data/${dataType}/records/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: parsed })
      });
      const json = (await res.json().catch(() => ({}))) as RecordActionResponse;
      if (!res.ok || !json.record?.id) {
        throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      }
      toast.success(t("data.recordUpdated"), { description: recordId });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.updateFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/data/${dataType}/records/${recordId}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as RecordActionResponse;
      if (!res.ok) {
        throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      }
      toast.success(t("data.recordDeleted"), { description: recordId });
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.deleteFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          if (busy) return;
          setEditOpen(next);
          if (next) setError(null);
        }}
      >
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} aria-label={t("data.editRecord")}>
          <Edit3 /> {t("common.edit")}
        </Button>
        <DialogContent className="max-w-2xl">
          <form onSubmit={saveRecord}>
            <DialogHeader>
              <DialogTitle>{t("data.editRecordTitle")}</DialogTitle>
              <DialogDescription className="font-mono">{recordId}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field htmlFor={`edit-record-${recordId}`} label={t("data.dataJson")} required error={error}>
                <Textarea
                  id={`edit-record-${recordId}`}
                  className="min-h-[360px] font-mono text-xs"
                  spellCheck={false}
                  invalid={Boolean(error)}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  disabled={busy}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={busy} loadingText={t("common.saving")}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (busy) return;
          setDeleteOpen(next);
          if (next) setError(null);
        }}
      >
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} aria-label={t("data.deleteRecordTitle")}>
          <Trash2 /> {t("common.delete")}
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("data.deleteRecordTitle")}</DialogTitle>
            <DialogDescription>{t("data.deleteRecordDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100">
              {t("data.confirmDeleteRecord", { id: recordId })}
            </div>
            {error && (
              <p className="text-xs leading-5 text-danger-700 dark:text-danger-200" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" loading={busy} loadingText={t("common.deleting")} onClick={deleteRecord}>
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
