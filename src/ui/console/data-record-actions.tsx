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

interface RecordActionResponse {
  record?: { id: string };
  error?: { message?: string; details?: unknown };
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonObject(source: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("请输入合法 JSON。格式示例：{ \"title\": \"Hello\" }");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("记录内容必须是 JSON object，不能是数组、字符串或空值。");
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
      parsed = parseJsonObject(data);
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
        throw new Error(apiMessage(json, `HTTP ${res.status}`));
      }
      toast.success("记录已创建", { description: json.record.id });
      setOpen(false);
      setData("{\n  \n}");
      setOwnerId("");
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("创建失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button onClick={() => setOpen(true)}>
        <Plus /> 创建记录
      </Button>
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>创建记录</DialogTitle>
            <DialogDescription>写入前会按当前 active schema 校验。</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field htmlFor="record-owner" label="Owner ID" help="可选；不填写时使用当前控制台用户。">
              <Input
                id="record-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                disabled={busy}
                placeholder="可选"
              />
            </Field>
            <Field htmlFor="record-data" label="Data JSON" required error={error}>
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
              取消
            </Button>
            <Button type="submit" loading={busy} loadingText="创建中…">
              创建
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
      parsed = parseJsonObject(data);
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
        throw new Error(apiMessage(json, `HTTP ${res.status}`));
      }
      toast.success("记录已更新", { description: recordId });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("更新失败", { description: message });
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
        throw new Error(apiMessage(json, `HTTP ${res.status}`));
      }
      toast.success("记录已删除", { description: recordId });
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("删除失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Dialog open={editOpen} onOpenChange={(next) => !busy && setEditOpen(next)}>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} aria-label="编辑记录">
          <Edit3 /> 编辑
        </Button>
        <DialogContent className="max-w-2xl">
          <form onSubmit={saveRecord}>
            <DialogHeader>
              <DialogTitle>编辑记录</DialogTitle>
              <DialogDescription className="font-mono">{recordId}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field htmlFor={`edit-record-${recordId}`} label="Data JSON" required error={error}>
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
                取消
              </Button>
              <Button type="submit" loading={busy} loadingText="保存中…">
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(next) => !busy && setDeleteOpen(next)}>
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} aria-label="删除记录">
          <Trash2 /> 删除
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除记录</DialogTitle>
            <DialogDescription>记录会被软删除，可避免误删造成直接数据丢失。</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              确认删除记录 <span className="font-mono">{recordId}</span>？
            </div>
            {error && (
              <p className="text-xs leading-5 text-danger-700" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>
              取消
            </Button>
            <Button type="button" variant="danger" loading={busy} loadingText="删除中…" onClick={deleteRecord}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}