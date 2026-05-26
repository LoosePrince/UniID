"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button, Field, Input, toast } from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface QuotaDefaults {
  rpsLimit: number;
  dailyApiCalls: number;
  monthlyStorageBytes: number;
  fnInvocationsDaily: number;
}

export function DefaultQuotaForm({ initial }: { initial: QuotaDefaults }) {
  const { t } = useI18n();
  const [form, setForm] = useState<QuotaDefaults>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = <K extends keyof QuotaDefaults>(key: K, value: string) => {
    const next = Number(value);
    if (Number.isFinite(next)) {
      setForm((current) => ({ ...current, [key]: next }));
      setError(null);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/config/default-quota", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error?.message ?? t("http.status", { status: res.status }));
        }
        toast.success(t("admin.config.defaultQuotaSaved"));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.saveFailed");
        setError(message);
        toast.error(t("common.saveFailed"), { description: message });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t("admin.config.rpsLabel")} htmlFor="rps" help={t("admin.config.rpsHelp")}>
          <Input id="rps" type="number" min={1} value={form.rpsLimit} onChange={(event) => set("rpsLimit", event.target.value)} disabled={pending} />
        </Field>
        <Field label={t("admin.config.dailyApiLabel")} htmlFor="daily">
          <Input id="daily" type="number" min={1} value={form.dailyApiCalls} onChange={(event) => set("dailyApiCalls", event.target.value)} disabled={pending} />
        </Field>
        <Field label={t("admin.config.storageLabel")} htmlFor="storage">
          <Input id="storage" type="number" min={1} value={form.monthlyStorageBytes} onChange={(event) => set("monthlyStorageBytes", event.target.value)} disabled={pending} />
        </Field>
        <Field label={t("admin.config.fnDailyLabel")} htmlFor="fn">
          <Input id="fn" type="number" min={1} value={form.fnInvocationsDaily} onChange={(event) => set("fnInvocationsDaily", event.target.value)} disabled={pending} />
        </Field>
      </div>
      {error ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-100" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} loadingText={t("common.saving")} disabled={!dirty}>
          <Save /> {t("admin.config.saveDefaultQuota")}
        </Button>
        {!dirty ? <span className="text-xs text-ink-400 dark:text-slate-500">{t("profile.noChanges")}</span> : null}
      </div>
    </form>
  );
}
