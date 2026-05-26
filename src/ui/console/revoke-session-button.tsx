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

export function RevokeSessionButton({
  sessionId,
  kind,
  label,
  variant = "ghost"
}: {
  sessionId: string;
  kind: "user" | "app";
  label?: string;
  variant?: "ghost" | "danger" | "outline";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    setError(null);
    startTransition(async () => {
      try {
        const url = `/api/v1/auth/sessions?sessionId=${encodeURIComponent(sessionId)}&kind=${kind}`;
        const res = await fetch(url, { method: "DELETE", credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `${t("sessions.revokeSessionFailed")} (${res.status})`);
        }
        toast.success(t("sessions.revokeSessionSuccess"));
        setOpen(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("sessions.revokeSessionFailed");
        setError(message);
        toast.error(t("sessions.revokeSessionFailed"), { description: message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="xs" className={variant === "ghost" ? "text-danger-600 hover:bg-danger-50" : undefined}>
          <Trash2 className="h-3 w-3" /> {label ?? t("common.revoke")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sessions.revokeSessionTitle")}</DialogTitle>
          <DialogDescription>{t("sessions.revokeSessionDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-slate-300">{t("sessions.revokeSessionConfirm")}</p>
          {error ? (
            <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>{t("common.cancel")}</Button>
          <Button variant="danger" onClick={revoke} loading={pending} loadingText={t("sessions.revoking")}>
            <Trash2 /> {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}