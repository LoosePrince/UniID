"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
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
  Textarea,
  toast
} from "@/ui/primitives";
import { useI18n } from "@/ui/i18n";

interface ConfigEntry {
  key: string;
  value: unknown;
}

function formatValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function parseValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function ConfigEntryActions({ entries }: { entries: ConfigEntry[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ConfigEntryDialog mode="create" />
      </div>
      <div className="overflow-hidden rounded-md border border-ink-100 dark:border-slate-700/70 dark:bg-slate-950/10">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-cream-50 dark:border-slate-700/70 dark:bg-slate-900/70">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-ink-500 dark:text-slate-300">Key</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-ink-500 dark:text-slate-300">Value</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-ink-500 dark:text-slate-300">{t("schema.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.key} className="border-b border-ink-100 transition-colors last:border-b-0 hover:bg-cream-50 dark:border-slate-700/70 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 align-top font-mono text-xs text-ink-900 dark:text-slate-100">{entry.key}</td>
                <td className="px-4 py-3 align-top">
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded-sm border border-ink-100 bg-cream-50 p-2 text-xs text-ink-600 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-300">
                    {formatValue(entry.value)}
                  </pre>
                </td>
                <td className="px-4 py-3 align-top text-right">
                  <ConfigEntryDialog mode="edit" entry={entry} />
                </td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-ink-400 dark:text-slate-500">
                  {t("admin.config.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigEntryDialog({
  mode,
  entry
}: {
  mode: "create" | "edit";
  entry?: ConfigEntry;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(entry?.key ?? "");
  const [value, setValue] = useState(entry ? formatValue(entry.value) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
    if (!entry) {
      setKey("");
      setValue("");
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/config/entry", {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ key, value: parseValue(value) })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? t("http.status", { status: res.status }));
        }
        toast.success(mode === "create" ? t("admin.config.created") : t("admin.config.saved"));
        setOpen(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t("common.saveFailed");
        setError(message);
        toast.error(t("common.saveFailed"), { description: message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant={mode === "create" ? "primary" : "ghost"} size="sm">
          {mode === "create" ? <Plus /> : <Save />} {mode === "create" ? t("admin.config.create") : t("common.edit")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? t("admin.config.createTitle") : t("admin.config.editTitle")}</DialogTitle>
            <DialogDescription>{t("admin.config.valueHelp")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Key" htmlFor="config-key" required>
              <Input
                id="config-key"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                disabled={pending || mode === "edit"}
                required
                pattern="[A-Za-z0-9_.:-]+"
                placeholder="feature.example"
              />
            </Field>
            <Field label="Value" htmlFor="config-value" required>
              <Textarea
                id="config-value"
                className="min-h-56 font-mono text-xs"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={pending}
                required
              />
            </Field>
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
            <Button type="submit" loading={pending} loadingText={t("common.saving")} disabled={!key.trim()}>
              <Save /> {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
