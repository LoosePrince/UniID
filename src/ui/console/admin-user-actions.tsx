"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, KeyRound, UserCog, Pencil, Trash2 } from "lucide-react";
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

interface UserSummary {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  locale: string;
  role: "user" | "admin";
  disabled: boolean;
}

type UserActionKind = "edit" | "role" | "password" | "status" | "delete";

async function callAdmin(action: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/v1/admin/users/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error?.message ?? `${res.status}`);
  }
}

export function UserActions({ user }: { user: UserSummary }) {
  const { t } = useI18n();
  const router = useRouter();
  const [dialog, setDialog] = useState<UserActionKind | null>(null);
  const [role, setRole] = useState<"user" | "admin">(user.role === "admin" ? "user" : "admin");
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email ?? "");
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [locale, setLocale] = useState(user.locale);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const statusAction = user.disabled ? "enable" : "disable";
  const statusLabel = user.disabled ? t("admin.user.enable") : t("admin.user.disable");

  const dialogCopy = useMemo(() => {
    if (dialog === "edit") {
      return {
        title: t("admin.user.editTitle"),
        description: t("admin.user.editDescription"),
        submit: t("admin.user.saveUser")
      };
    }
    if (dialog === "role") {
      return {
        title: t("admin.user.roleTitle"),
        description: t("admin.user.roleDescription"),
        submit: t("admin.user.saveRole")
      };
    }
    if (dialog === "password") {
      return {
        title: t("admin.user.passwordTitle"),
        description: t("admin.user.passwordDescription"),
        submit: t("admin.user.confirmReset")
      };
    }
    if (dialog === "delete") {
      return {
        title: t("admin.user.deleteTitle"),
        description: t("admin.user.deleteDescription"),
        submit: t("admin.user.confirmDelete")
      };
    }
    return {
      title: user.disabled ? t("admin.user.statusEnableTitle") : t("admin.user.statusDisableTitle"),
      description: user.disabled ? t("admin.user.statusEnableDescription") : t("admin.user.statusDisableDescription"),
      submit: t("common.confirmAction", { action: statusLabel })
    };
  }, [dialog, statusLabel, t, user.disabled]);

  function openDialog(kind: UserActionKind) {
    setDialog(kind);
    setError(null);
    setPassword("");
    setRole(user.role === "admin" ? "user" : "admin");
    setUsername(user.username);
    setEmail(user.email ?? "");
    setDisplayName(user.displayName ?? "");
    setLocale(user.locale);
  }

  function closeDialog() {
    if (pending) return;
    setDialog(null);
    setError(null);
  }

  function submit() {
    if (!dialog) return;
    setError(null);

    startTransition(async () => {
      try {
        if (dialog === "edit") {
          await callAdmin("update", {
            userId: user.id,
            username: username.trim(),
            email: email.trim() || null,
            displayName: displayName.trim() || null,
            locale: locale.trim() || "zh-CN"
          });
          toast.success(t("admin.user.updated"));
        } else if (dialog === "role") {
          await callAdmin("set-role", { userId: user.id, role });
          toast.success(t("admin.user.roleUpdated"));
        } else if (dialog === "password") {
          if (password.length < 8) throw new Error(t("validation.passwordMin"));
          await callAdmin("reset-password", { userId: user.id, newPassword: password });
          toast.success(t("admin.user.passwordReset"), { description: t("admin.user.passwordResetDescription") });
        } else if (dialog === "delete") {
          await callAdmin("delete", { userId: user.id });
          toast.success(t("admin.user.deleted"));
        } else {
          await callAdmin(statusAction, { userId: user.id });
          toast.success(user.disabled ? t("admin.user.enabled") : t("admin.user.disabled"));
        }
        setDialog(null);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.operationFailed");
        setError(message);
        toast.error(t("common.operationFailed"), { description: message });
      }
    });
  }

  const passwordError =
    password.length > 0 && password.length < 8 ? t("validation.passwordMin") : undefined;

  return (
    <>
      <div className="inline-flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => openDialog("edit")}>
          <Pencil /> {t("admin.user.edit")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openDialog("role")}>
          <UserCog /> {t("admin.user.changeRole")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openDialog("password")}>
          <KeyRound /> {t("admin.user.changePassword")}
        </Button>
        <Button variant={user.disabled ? "secondary" : "danger"} size="sm" onClick={() => openDialog("status")}>
          {user.disabled ? <Shield /> : <ShieldOff />} {statusLabel}
        </Button>
        <Button variant="danger" size="sm" onClick={() => openDialog("delete")}>
          <Trash2 /> {t("common.delete")}
        </Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(value) => (value ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogCopy.title}</DialogTitle>
            <DialogDescription>{dialogCopy.description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-md border border-ink-100 bg-cream-50 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/50">
              <span className="text-ink-500 dark:text-slate-400">{t("common.targetUser")}</span>
              <span className="font-mono text-ink-900 dark:text-slate-100">@{user.username}</span>
            </div>

            {dialog === "edit" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("accountSettings.username")} htmlFor={`username-${user.id}`} required>
                  <Input
                    id={`username-${user.id}`}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={pending}
                    maxLength={64}
                    required
                  />
                </Field>
                <Field label={t("admin.user.displayName")} htmlFor={`display-${user.id}`}>
                  <Input
                    id={`display-${user.id}`}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={pending}
                    maxLength={80}
                  />
                </Field>
                <Field label={t("profile.email")} htmlFor={`email-${user.id}`}>
                  <Input
                    id={`email-${user.id}`}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label={t("profile.locale")} htmlFor={`locale-${user.id}`}>
                  <Input
                    id={`locale-${user.id}`}
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    disabled={pending}
                    maxLength={16}
                    placeholder="zh-CN"
                  />
                </Field>
              </div>
            ) : null}

            {dialog === "role" ? (
              <Field label={t("admin.user.newRole")} htmlFor={`role-${user.id}`}>
                <Select
                  id={`role-${user.id}`}
                  value={role}
                  onValueChange={(value) => setRole(value as "user" | "admin")}
                  disabled={pending}
                  options={[
                    { value: "user", label: "user" },
                    { value: "admin", label: "admin" }
                  ]}
                />
              </Field>
            ) : null}

            {dialog === "password" ? (
              <Field label={t("admin.user.newPassword")} htmlFor={`password-${user.id}`} required error={passwordError}>
                <Input
                  id={`password-${user.id}`}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                  minLength={8}
                  invalid={password.length > 0 && password.length < 8}
                  autoComplete="new-password"
                  placeholder={t("validation.passwordMin")}
                />
              </Field>
            ) : null}

            {dialog === "delete" ? (
              <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100">
                {t("admin.user.confirmDeleteBody", { username: user.username })}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100" role="alert">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={(dialog === "status" && !user.disabled) || dialog === "delete" ? "danger" : "primary"}
              onClick={submit}
              loading={pending}
              loadingText={t("common.processing")}
              disabled={(dialog === "password" && password.length < 8) || (dialog === "edit" && !username.trim())}
            >
              {dialogCopy.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
