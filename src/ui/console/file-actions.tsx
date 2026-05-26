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
import { useI18n } from "@/ui/i18n";

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
  const { t } = useI18n();
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
      setError(t("fileActions.selectFile"));
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
      if (!res.ok || !json.file?.id) {
        throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      }
      toast.success(t("fileActions.uploadSuccess"), { description: json.file.originalName ?? file.name });
      setOpen(false);
      setFile(null);
      setVisibility("private");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("fileActions.uploadFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button type="button" onClick={() => setOpen(true)}>
        <Upload /> {t("fileActions.uploadTitle")}
      </Button>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("fileActions.uploadTitle")}</DialogTitle>
            <DialogDescription>{t("fileActions.uploadDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field
              htmlFor="file-upload"
              label={t("fileActions.file")}
              required
              error={error && !file ? error : undefined}
            >
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
            <Field htmlFor="file-visibility" label={t("fileActions.visibility")} help={t("fileActions.visibilityHelp")}>
              <Select
                id="file-visibility"
                value={visibility}
                disabled={busy}
                onValueChange={(value) => setVisibility(value === "public" ? "public" : "private")}
                options={[
                  { value: "private", label: t("visibility.private") },
                  { value: "public", label: t("visibility.public") }
                ]}
              />
            </Field>
            {error && file ? <p className="text-xs text-danger-700 dark:text-danger-200">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy} loadingText={t("fileActions.uploading")}>
              {t("fileActions.upload")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FileRowActions({ file, basePath }: { file: ManagedFile; basePath: string }) {
  const { t, formatDateTime } = useI18n();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"download" | "share" | "revoke" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function fetchDownloadUrl() {
    const res = await fetch(`${basePath}/${file.id}/download-url`, { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as FileActionResponse;
    if (!res.ok || !json.url) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
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
      toast.error(t("fileActions.openFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function copyDownloadLink() {
    setBusy("download");
    setError(null);
    try {
      await copyText(await fetchDownloadUrl());
      toast.success(t("fileActions.copyDownloadSuccess"), { description: t("fileActions.copyDownloadDescription") });
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("fileActions.copyFailed"), { description: message });
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
      if (!res.ok || !json.url) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      await copyText(absoluteUrl(json.url));
      toast.success(t("fileActions.shareCreateSuccess"), {
        description: json.expiresAt
          ? t("fileActions.shareExpiresAt", { time: formatDateTime(json.expiresAt) })
          : undefined
      });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("fileActions.shareCreateFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  async function copyShareLink() {
    if (!file.shareUrl) return;
    try {
      await copyText(absoluteUrl(file.shareUrl));
      toast.success(t("fileActions.shareCopySuccess"));
    } catch (err) {
      toast.error(t("fileActions.copyFailed"), { description: String((err as Error).message ?? err) });
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("fileActions.shareRevoked"), {
        description: t("fileActions.shareRevokedDescription", { count: json.revoked ?? 0 })
      });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("fileActions.copyFailed"), { description: message });
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
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("fileActions.deleteSuccess"), { description: file.originalName });
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("fileActions.deleteFailed"), { description: message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={openFile}
          loading={busy === "download"}
          aria-label={`${t("fileActions.open")} ${file.originalName}`}
        >
          <ExternalLink /> {t("fileActions.open")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={copyDownloadLink}
          disabled={busy !== null}
          aria-label={`${t("fileActions.copyDownload")} ${file.originalName}`}
        >
          <Download /> {t("fileActions.copyDownload")}
        </Button>
        {file.shareUrl ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyShareLink}
              disabled={busy !== null}
              aria-label={`${t("fileActions.copyShare")} ${file.originalName}`}
            >
              <Copy /> {t("fileActions.copyShare")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={revokeShareLinks}
              loading={busy === "revoke"}
              aria-label={`${t("fileActions.shareRevoke")} ${file.originalName}`}
            >
              {t("fileActions.shareRevoke")}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={createShareLink}
            loading={busy === "share"}
            aria-label={`${t("fileActions.share")} ${file.originalName}`}
          >
            <Share2 /> {t("fileActions.share")}
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => setDeleteOpen(true)}
          disabled={busy !== null}
          aria-label={`${t("fileActions.delete")} ${file.originalName}`}
        >
          <Trash2 /> {t("fileActions.delete")}
        </Button>
      </div>
      {error ? <p className="mt-1 text-right text-xs text-danger-700 dark:text-danger-200">{error}</p> : null}

      <Dialog open={deleteOpen} onOpenChange={(next) => busy !== "delete" && setDeleteOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fileActions.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("fileActions.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100">
              {t("fileActions.deleteConfirm", { name: file.originalName })}
            </div>
            {error ? <p className="mt-3 text-xs text-danger-700 dark:text-danger-200">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy === "delete"} onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={busy === "delete"}
              loadingText={t("fileActions.deleting")}
              onClick={deleteFile}
            >
              {t("fileActions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
