"use client";

import * as React from "react";
import { Clock3, Eye, FileIcon, FileText, Filter, ImageIcon, Search, ShieldCheck, Share2 } from "lucide-react";
import { AppFileUploadButton, FileRowActions } from "@/ui/console/file-actions";
import { Badge, Card, CardContent, Input, Select } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

export interface AppFileListItem {
  id: string;
  originalName: string;
  ownerId: string;
  mimeType: string;
  visibility: string;
  size: number;
  createdAt: number;
  shareUrl: string | null;
}

interface FilesWorkspaceProps {
  appId: string;
  files: AppFileListItem[];
  totalSize: number;
  sharedCount: number;
  publicCount: number;
}

type FileFilter = "all" | "shared" | "public" | "private";

function typeLabelKey(mimeType: string) {
  if (mimeType.startsWith("image/")) return "appFiles.type.image";
  if (mimeType.includes("pdf")) return "appFiles.type.pdf";
  if (mimeType.includes("json")) return "appFiles.type.json";
  if (mimeType.startsWith("text/")) return "appFiles.type.text";
  if (mimeType.startsWith("video/")) return "appFiles.type.video";
  if (mimeType.startsWith("audio/")) return "appFiles.type.audio";
  return "appFiles.type.file";
}

function FileKindIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (mimeType.includes("json") || mimeType.startsWith("text/")) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

function matchesFilter(file: AppFileListItem, filter: FileFilter) {
  if (filter === "shared") return Boolean(file.shareUrl);
  if (filter === "public") return file.visibility === "public";
  if (filter === "private") return file.visibility !== "public";
  return true;
}

export function FilesWorkspace({ appId, files, totalSize, sharedCount, publicCount }: FilesWorkspaceProps) {
  const { t, formatBytes, formatDateTime, formatNumber } = useI18n();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FileFilter>("all");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFiles = files.filter((file) => {
    const haystack = [file.originalName, file.mimeType, file.ownerId, file.visibility, file.id].join(" ").toLowerCase();
    return matchesFilter(file, filter) && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{t("common.files")}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{t("appFiles.description")}</p>
        </div>
        <AppFileUploadButton appId={appId} />
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <FileMetric label={t("appFiles.metric.total")} value={formatNumber(files.length)} icon={<FileIcon className="h-4 w-4" />} />
        <FileMetric label={t("appFiles.metric.storage")} value={formatBytes(totalSize)} icon={<ShieldCheck className="h-4 w-4" />} />
        <FileMetric label={t("appFiles.metric.shared")} value={formatNumber(sharedCount)} icon={<Share2 className="h-4 w-4" />} />
        <FileMetric label={t("appFiles.metric.public")} value={formatNumber(publicCount)} icon={<Eye className="h-4 w-4" />} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder={t("appFiles.searchPlaceholder")}
              />
            </label>
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as FileFilter)}
              aria-label={t("appFiles.filterLabel")}
              options={[
                { value: "all", label: t("appFiles.filter.all") },
                { value: "shared", label: t("appFiles.filter.shared") },
                { value: "public", label: t("appFiles.filter.public") },
                { value: "private", label: t("appFiles.filter.private") }
              ]}
            />
            <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              {t("appFiles.filterCount", { shown: formatNumber(visibleFiles.length), total: formatNumber(files.length) })}
            </div>
          </div>

          {visibleFiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-200/80 px-4 py-12 text-center dark:border-slate-700">
              <p className="text-sm font-medium text-ink-700 dark:text-slate-200">
                {files.length === 0 ? t("appFiles.empty") : t("appFiles.noMatchTitle")}
              </p>
              <p className="mt-1 text-xs text-ink-500 dark:text-slate-400">
                {files.length === 0 ? t("appFiles.emptyHint") : t("appFiles.noMatchHint")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-ink-100 dark:border-slate-700">
              <div className="hidden grid-cols-[minmax(240px,1.8fr)_140px_160px_120px_160px_220px] items-center gap-3 border-b border-ink-100 bg-cream-100/70 px-4 py-2 text-xs font-medium text-ink-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 xl:grid">
                <span>{t("accountFiles.name")}</span>
                <span>{t("accountFiles.type")}</span>
                <span>{t("appFiles.visibility")}</span>
                <span className="text-right">{t("accountFiles.size")}</span>
                <span className="text-right">{t("appFiles.uploadedAt")}</span>
                <span className="text-right">{t("accountFiles.actions")}</span>
              </div>
              <div className="divide-y divide-ink-100 dark:divide-slate-700">
                {visibleFiles.map((file) => (
                  <div
                    key={file.id}
                    className="grid gap-3 bg-white/35 px-4 py-3 transition-colors hover:bg-white/70 dark:bg-slate-950/10 dark:hover:bg-slate-800/40 xl:grid-cols-[minmax(240px,1.8fr)_140px_160px_120px_160px_220px] xl:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-100 bg-cream-50 text-ink-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <FileKindIcon mimeType={file.mimeType} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink-900 dark:text-slate-100">{file.originalName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-ink-400 dark:text-slate-500">
                          <span className="font-mono">{file.id}</span>
                          <span className="font-mono">{file.ownerId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-slate-400 xl:block">
                      <span className="xl:hidden">{t("accountFiles.type")}</span>
                      <span className="font-mono">{t(typeLabelKey(file.mimeType))}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={file.visibility === "public" ? "accent" : "neutral"}>{file.visibility}</Badge>
                      {file.shareUrl ? <Badge tone="success">{t("accountFiles.shared")}</Badge> : null}
                    </div>
                    <div className="text-sm tabular-nums text-ink-700 dark:text-slate-300 xl:text-right">{formatBytes(file.size)}</div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-slate-400 xl:justify-end">
                      <Clock3 className="h-3.5 w-3.5 xl:hidden" />
                      {formatDateTime(file.createdAt)}
                    </div>
                    <FileRowActions
                      basePath={`/api/v1/apps/${appId}/files`}
                      file={{
                        id: file.id,
                        originalName: file.originalName,
                        shareUrl: file.shareUrl
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FileMetric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white/45 p-4 shadow-xs dark:border-slate-700/70 dark:bg-slate-900/35">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ink-500 dark:text-slate-400">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-cream-50 dark:bg-slate-100 dark:text-slate-950">
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-lg font-semibold tabular-nums text-ink-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
