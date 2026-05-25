"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, Share2, Trash2, Upload } from "lucide-react";
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
  Select,
  toast
} from "@/ui/primitives";

interface FileActionResponse {
  file?: { id: string; originalName?: string };
  url?: string;
  expiresAt?: number;
  revoked?: number;
  error?: { message?: string; details?: unknown };
}

interface ManagedFile {
  id: string;
  originalName: string;
  shareUrl?: string | null;
}

function apiMessage(json: FileActionResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

function absoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${window.location.origin}${pathOrUrl}`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function AppFileUploadButton({ appId }: { appId: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [visibility, setVisibility] = React.useState<"private" | "public">("private");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("请选择要上传的文件。");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("visibility", visibility);
      const res = await fetch(`/api/v1/apps/${appId}/files`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      const json = (await res.json().catch(() => ({}))) as FileActionResponse;
      if (!res.ok || !json.file?.id) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("文件已上传", { description: json.file.originalName ?? file.name });
      setOpen(false);
      setFile(null);
      setVisibility("private");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("上传失败", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button type="button" onClick={() => setOpen(true)}>
        <Upload /> 上传文件
      </Button>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
            <DialogDescription>文件会归属当前应用，可在列表中复制下载链接或生成分享链接。</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field htmlFor="file-upload" label="文件" required error={error && !file ? error : undefined}>
              <Input
                ref={inputRef}
                id="file-upload"
                type="file"
                disabled={busy}
                invalid={Boolean(error && !file)}
                onChange={(e) => {
                  setError(null);
                  setFile(e.target.files?.[0] ?? null);
                }}
              />
            </Field>
            <Field htmlFor="file-visibility" label="可见性" help="private 需要鉴权下载；public 元数据仍受页面权限约束。">
              <Select
                id="file-visibility"
                value={visibility}
                disabled={busy}
                onValueChange={(value) => setVisibility(value === "public" ? "public" : "private")}
                options={[
                  { value: "private", label: "private" },
                  { value: "public", label: "public" }
                ]}
              />
            </Field>
            {error && file ? <p className="text-xs text-danger-700">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" loading={busy} loadingText="上传中…">
              上传
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FileRowActions({ file, basePath }: { file: ManagedFile; basePath: string }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"download" | "share" | "revoke" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function fetchDownloadUrl() {
    const res = await fetch(`${basePath}/${file.id}/download-url`, { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as FileActionResponse;
    if (!res.ok || !json.url) throw new Error(apiMessage(json, `HTTP ${res.status}`));
    return json.url;
  }

  async function openFile() {
    setBusy("download");
    setError(null);
    try {
      window.open(await fetchDownloadUrl(), "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("打开失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function copyDownloadLink() {
    setBusy("download");
    setError(null);
    try {
      await copyText(await fetchDownloadUrl());
      toast.success("下载链接已复制", { description: "链接会按服务端配置自动过期。" });
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("复制失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function createShareLink() {
    setBusy("share");
    setError(null);
    try {
      const res = await fetch(`${basePath}/${file.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });
      const json = (await res.json().catch(() => ({}))) as FileActionResponse;
      if (!res.ok || !json.url) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      await copyText(absoluteUrl(json.url));
      toast.success("分享链接已创建并复制", {
        description: json.expiresAt ? `有效期至 ${new Date(json.expiresAt * 1000).toLocaleString()}` : undefined
      });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("分享失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function copyShareLink() {
    if (!file.shareUrl) return;
    try {
      await copyText(absoluteUrl(file.shareUrl));
      toast.success("分享链接已复制");
    } catch (err) {
      toast.error("复制失败", { description: String((err as Error).message ?? err) });
    }
  }

  async function revokeShareLinks() {
    setBusy("revoke");
    setError(null);
    try {
      const res = await fetch(`${basePath}/${file.id}/share`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as FileActionResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("分享已撤销", { description: `已撤销 ${json.revoked ?? 0} 个链接。` });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("撤销失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function deleteFile() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`${basePath}/${file.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as FileActionResponse;
      if (!res.ok) throw new Error(apiMessage(json, `HTTP ${res.status}`));
      toast.success("文件已删除", { description: file.originalName });
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error("删除失败", { description: message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={openFile} loading={busy === "download"} aria-label={`打开 ${file.originalName}`}>
          <ExternalLink /> 打开
        </Button>
        <Button size="sm" variant="ghost" onClick={copyDownloadLink} disabled={busy !== null} aria-label={`复制 ${file.originalName} 的下载链接`}>
          <Download /> 复制下载
        </Button>
        {file.shareUrl ? (
          <>
            <Button size="sm" variant="ghost" onClick={copyShareLink} disabled={busy !== null} aria-label={`复制 ${file.originalName} 的分享链接`}>
              <Copy /> 复制分享
            </Button>
            <Button size="sm" variant="ghost" onClick={revokeShareLinks} loading={busy === "revoke"} aria-label={`撤销 ${file.originalName} 的分享链接`}>
              撤销分享
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={createShareLink} loading={busy === "share"} aria-label={`创建 ${file.originalName} 的分享链接`}>
            <Share2 /> 分享
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={busy !== null} aria-label={`删除 ${file.originalName}`}>
          <Trash2 /> 删除
        </Button>
      </div>
      {error ? <p className="mt-1 text-right text-xs text-danger-700">{error}</p> : null}

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件</DialogTitle>
            <DialogDescription>该操作会软删除文件记录，并尝试删除存储对象。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              确认删除「{file.originalName}」？此操作不会使用浏览器原生确认框。
            </div>
            {error ? <p className="mt-3 text-xs text-danger-700">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy === "delete"} onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="danger" loading={busy === "delete"} loadingText="删除中…" onClick={deleteFile}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}