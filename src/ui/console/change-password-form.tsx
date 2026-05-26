"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { Button, Field, Input, toast } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

export function ChangePasswordForm() {
  const { t } = useI18n();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && confirm !== newPw;
  const canSubmit = oldPw.length >= 8 && newPw.length >= 8 && confirm === newPw;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mismatch) {
      setError(t("password.mismatch"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `${t("password.updateFailed")} (${res.status})`);
        }
        toast.success(t("password.updated"));
        setOldPw("");
        setNewPw("");
        setConfirm("");
      } catch (err) {
        const message = err instanceof Error ? err.message : t("password.updateFailed");
        setError(message);
        toast.error(t("password.updateFailed"), { description: message });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <Field label={t("password.current")} htmlFor="oldPw" required>
        <Input
          id="oldPw"
          type={showPasswords ? "text" : "password"}
          value={oldPw}
          onChange={(event) => setOldPw(event.target.value)}
          disabled={pending}
          required
          minLength={8}
          autoComplete="current-password"
        />
      </Field>

      <Field label={t("password.new")} htmlFor="newPw" required help={t("password.newHelp")}>
        <Input
          id="newPw"
          type={showPasswords ? "text" : "password"}
          value={newPw}
          onChange={(event) => setNewPw(event.target.value)}
          disabled={pending}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>

      <Field label={t("password.confirm")} htmlFor="confirm" required error={mismatch ? t("password.mismatch") : undefined}>
        <Input
          id="confirm"
          type={showPasswords ? "text" : "password"}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={pending}
          required
          minLength={8}
          autoComplete="new-password"
          invalid={mismatch}
        />
      </Field>

      {error && !mismatch ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" loading={pending} loadingText={t("password.updating")} disabled={!canSubmit}>
          <Save /> {t("password.update")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowPasswords((value) => !value)} disabled={pending}>
          {showPasswords ? <EyeOff /> : <Eye />} {showPasswords ? t("password.hide") : t("password.show")}
        </Button>
        <span className="inline-flex items-center gap-1 text-xs text-ink-400 dark:text-slate-500">
          <KeyRound className="h-3.5 w-3.5" /> {t("password.keepSignedIn")}
        </span>
      </div>
    </form>
  );
}