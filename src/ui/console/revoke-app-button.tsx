"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

export function RevokeAppButton({
  userId,
  appId,
  appName
}: {
  userId: string;
  appId: string;
  appName: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/account/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ app_id: appId, _u: userId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(t("authorizations.revokeFailed"), { description: data?.error?.message });
        setBusy(false);
        return;
      }
      toast.success(t("authorizations.revokeSuccess", { appName }));
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(t("authorizations.networkError"));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" className="text-danger-600 hover:text-danger-700 hover:bg-danger-50">
          <Trash2 className="h-3 w-3" /> {t("authorizations.revoke")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("authorizations.revokeTitle", { appName })}</DialogTitle>
          <DialogDescription>{t("authorizations.revokeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-ink-700">{t("authorizations.revokeBody", { appName })}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            <Trash2 /> {t("authorizations.revokeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
