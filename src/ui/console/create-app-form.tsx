"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button, Field, Input, Select, Textarea, toast } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface CreateAppResponse {
  app?: { id: string; name: string };
  error?: { message?: string };
}

interface CreateAppUserOption {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
}

export function CreateAppForm({ users, currentUserId }: { users: CreateAppUserOption[]; currentUserId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [primaryDomain, setPrimaryDomain] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [ownerId, setOwnerId] = React.useState(currentUserId);
  const [adminIdsText, setAdminIdsText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const adminIds = React.useMemo(
    () => adminIdsText.split(/[\s,，]+/).map((id) => id.trim()).filter(Boolean),
    [adminIdsText]
  );
  const canSubmit = name.trim().length > 0 && primaryDomain.trim().length > 0 && ownerId.length > 0 && !busy;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          primaryDomain: primaryDomain.trim().toLowerCase(),
          description: description.trim() || undefined,
          ownerId,
          adminIds
        })
      });
      const json = (await res.json().catch(() => ({}))) as CreateAppResponse;
      if (!res.ok || !json.app?.id) {
        throw new Error(json.error?.message ?? t("http.status", { status: res.status }));
      }

      toast.success(t("createApp.success"), { description: json.app.name });
      router.push(`/console/apps/${json.app.id}`);
      router.refresh();
    } catch (err) {
      const message = String((err as Error).message ?? err);
      setError(message);
      toast.error(t("createApp.failed"), { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field htmlFor="new-app-name" label={t("createApp.name")} required help={t("createApp.nameHelp")}>
        <Input
          id="new-app-name"
          autoComplete="off"
          maxLength={64}
          placeholder="My UniID App"
          value={name}
          invalid={Boolean(error) && name.trim().length === 0}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field htmlFor="new-app-domain" label={t("createApp.domain")} required help={t("createApp.domainHelp")}>
        <Input
          id="new-app-domain"
          autoCapitalize="none"
          autoComplete="off"
          inputMode="url"
          maxLength={253}
          placeholder="example.com"
          value={primaryDomain}
          invalid={Boolean(error) && primaryDomain.trim().length === 0}
          onChange={(e) => setPrimaryDomain(e.target.value)}
        />
      </Field>

      <Field htmlFor="new-app-owner" label={t("createApp.owner")} required help={t("createApp.ownerHelp")}>
        <Select
          id="new-app-owner"
          value={ownerId}
          onValueChange={setOwnerId}
          disabled={busy}
          options={users.map((user) => ({
            value: user.id,
            label: `${user.displayName ?? user.username} · @${user.username}${user.email ? ` · ${user.email}` : ""}`
          }))}
        />
      </Field>

      <Field htmlFor="new-app-admins" label={t("createApp.admins")} help={t("createApp.adminsHelp")}>
        <Input
          id="new-app-admins"
          autoComplete="off"
          placeholder="userId1, userId2"
          value={adminIdsText}
          onChange={(e) => setAdminIdsText(e.target.value)}
          disabled={busy}
        />
      </Field>

      <Field htmlFor="new-app-description" label={t("createApp.description")} help={t("createApp.descriptionHelp")}>
        <Textarea
          id="new-app-description"
          maxLength={500}
          placeholder={t("createApp.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      {error && (
        <div
          className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          <ArrowLeft /> {t("createApp.back")}
        </Button>
        <Button type="submit" loading={busy} loadingText={t("createApp.submitting")} disabled={!canSubmit}>
          <Sparkles /> {t("createApp.submit")}
        </Button>
      </div>
    </form>
  );
}
