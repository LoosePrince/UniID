"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button, Field, Input, Select, toast } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface AccountProfileFormProps {
  initial: {
    displayName: string;
    email: string;
    locale: string;
  };
}

export function AccountProfileForm({ initial }: AccountProfileFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    form.displayName !== initial.displayName ||
    form.email !== initial.email ||
    form.locale !== initial.locale;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/account/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `${t("profile.saveFailed")} (${res.status})`);
        }
        toast.success(t("profile.saved"));
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("profile.saveFailed");
        setError(message);
        toast.error(t("profile.saveFailed"), { description: message });
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <Field
        label={t("profile.displayName")}
        htmlFor="account-display-name"
        required
        error={error && form.displayName.trim().length === 0 ? error : undefined}
      >
        <Input
          id="account-display-name"
          value={form.displayName}
          onChange={(event) => update("displayName", event.target.value)}
          disabled={pending}
          invalid={form.displayName.trim().length === 0}
          autoComplete="name"
          required
        />
      </Field>

      <Field label={t("profile.email")} htmlFor="account-email" help={t("profile.emailHelp")}>
        <Input
          id="account-email"
          type="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          disabled={pending}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>

      <Field label={t("profile.locale")} htmlFor="account-locale">
        <Select
          id="account-locale"
          value={form.locale}
          onValueChange={(value) => update("locale", value)}
          disabled={pending}
          options={[
            { value: "zh-CN", label: t("profile.locale.zhCN") },
            { value: "en-US", label: t("profile.locale.enUS") }
          ]}
        />
      </Field>

      {error && form.displayName.trim().length > 0 ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" loading={pending} loadingText={t("profile.saving")} disabled={!dirty || form.displayName.trim().length === 0}>
          <Save /> {t("profile.save")}
        </Button>
        {!dirty ? <span className="text-xs text-ink-400 dark:text-slate-500">{t("profile.noChanges")}</span> : null}
      </div>
    </form>
  );
}