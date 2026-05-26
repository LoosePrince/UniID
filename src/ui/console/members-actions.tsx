"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
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
  Field,
  Input,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface ApiErrorResponse {
  error?: { message?: string };
}

function apiMessage(json: ApiErrorResponse, fallback: string) {
  return json.error?.message ?? fallback;
}

export function AddMemberForm({ appId }: { appId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: normalizedUsername })
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      setUsername("");
      toast.success(t("members.addSuccess"), { description: normalizedUsername });
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.addFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        htmlFor="member-username"
        label={t("members.username")}
        required
        error={error}
        help={t("members.usernameHelp")}
      >
        <Input
          id="member-username"
          required
          placeholder="alice"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
          invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" loading={busy} loadingText={t("common.adding")} disabled={!username.trim()}>
        <UserPlus /> {t("members.add")}
      </Button>
    </form>
  );
}

export function RemoveMemberButton({
  appId,
  userId,
  username
}: {
  appId: string;
  userId: string;
  username?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label = username ? `@${username}` : userId;

  async function removeMember() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/apps/${appId}/members/${userId}`, {
        method: "DELETE",
        credentials: "include"
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorResponse;
      if (!res.ok) throw new Error(apiMessage(json, t("http.status", { status: res.status })));
      toast.success(t("members.removeSuccess"), { description: label });
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("common.removeFailed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {t("common.remove")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("members.removeTitle")}</DialogTitle>
          <DialogDescription>{t("members.removeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100">
            {t("common.confirmRemove", { label })}
          </div>
          {error ? (
            <p className="text-xs leading-5 text-danger-700 dark:text-danger-200" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={removeMember} loading={busy} loadingText={t("common.removing")}>
            <Trash2 /> {t("common.confirmAction", { action: t("common.remove") })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
