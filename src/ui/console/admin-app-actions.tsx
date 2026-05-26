"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, PauseCircle, PlayCircle } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

type AppStatus = "active" | "suspended" | "archived";

interface AppSummary {
  id: string;
  name: string;
  status: AppStatus;
}

async function setStatus(appId: string, status: AppStatus) {
  const res = await fetch("/api/v1/admin/apps/set-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ appId, status })
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `${res.status}`);
  }
}

const statusMeta: Record<
  AppStatus,
  { labelKey: string; titleKey: string; descriptionKey: string }
> = {
  active: {
    labelKey: "common.enable",
    titleKey: "admin.app.enableTitle",
    descriptionKey: "admin.app.enableDescription"
  },
  suspended: {
    labelKey: "common.pause",
    titleKey: "admin.app.suspendTitle",
    descriptionKey: "admin.app.suspendDescription"
  },
  archived: {
    labelKey: "admin.app.archiveTitle",
    titleKey: "admin.app.archiveTitle",
    descriptionKey: "admin.app.archiveDescription"
  }
};

export function AppStatusActions({ app }: { app: AppSummary }) {
  const { t } = useI18n();
  const router = useRouter();
  const [target, setTarget] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = useMemo(() => {
    if (!target) return null;
    const meta = statusMeta[target];
    return {
      label: t(meta.labelKey),
      title: t(meta.titleKey),
      description: t(meta.descriptionKey)
    };
  }, [target, t]);

  function open(targetStatus: AppStatus) {
    setTarget(targetStatus);
    setError(null);
  }

  function close() {
    if (pending) return;
    setTarget(null);
    setError(null);
  }

  function submit() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      try {
        await setStatus(app.id, target);
        toast.success(t("admin.app.statusChanged", { status: t(statusMeta[target].labelKey) }));
        setTarget(null);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.operationFailed");
        setError(message);
        toast.error(t("common.operationFailed"), { description: message });
      }
    });
  }

  return (
    <>
      <div className="inline-flex flex-wrap justify-end gap-1">
        {app.status === "active" ? (
          <Button variant="ghost" size="sm" onClick={() => open("suspended")}>
            <PauseCircle /> {t("common.pause")}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => open("active")}>
            <PlayCircle /> {t("common.enable")}
          </Button>
        )}
        {app.status !== "archived" ? (
          <Button variant="ghost" size="sm" onClick={() => open("archived")}>
            <Archive /> {t("admin.app.archiveTitle")}
          </Button>
        ) : null}
      </div>

      <Dialog open={target !== null} onOpenChange={(value) => (value ? null : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-md border border-ink-100 bg-cream-50 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/50">
              <span className="text-ink-500 dark:text-slate-400">{t("common.targetApp")}</span>
              <span className="font-medium text-ink-900 dark:text-slate-100">{app.name}</span>
            </div>
            {error ? (
              <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100" role="alert">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={target === "suspended" ? "danger" : "primary"}
              onClick={submit}
              loading={pending}
              loadingText={t("common.processing")}
            >
              {copy ? t("common.confirmAction", { action: copy.label }) : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
