"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface SessionTarget {
  id: string;
  kind: "user" | "app";
}

export function RevokeOtherSessionsButton({ sessions }: { sessions: SessionTarget[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revokeAll() {
    setError(null);
    startTransition(async () => {
      const failures: string[] = [];
      for (const session of sessions) {
        const url = `/api/v1/auth/sessions?sessionId=${encodeURIComponent(session.id)}&kind=${session.kind}`;
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failures.push(data?.error?.message ?? `${session.id}: ${res.status}`);
        }
      }

      if (failures.length > 0) {
        const message = failures.slice(0, 2).join("；");
        setError(message);
        toast.error(t("sessions.revokeOthersFailedPartial"), { description: message });
        return;
      }

      toast.success(t("sessions.revokeOthersSuccess"));
      setOpen(false);
      router.refresh();
    });
  }

  if (sessions.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Trash2 /> {t("sessions.revokeNone")}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 /> {t("sessions.revokeOthers")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sessions.revokeOthersTitle")}</DialogTitle>
          <DialogDescription>{t("sessions.revokeOthersDescription", { count: sessions.length })}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-slate-300">{t("sessions.revokeOthersHint")}</p>
          {error ? (
            <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{t("common.cancel")}</Button>
          <Button variant="danger" onClick={revokeAll} loading={pending} loadingText={t("sessions.revoking")}>
            <Trash2 /> {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}