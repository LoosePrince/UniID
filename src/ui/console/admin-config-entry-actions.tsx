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
              <th className="px-4 py-2 text-right text-xs font-medium text-ink-500 dark:text-slate-300">操作</th>
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
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-ink-400 dark:text-slate-500">暂无配置</td>
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
          throw new Error(data?.error?.message ?? `保存失败 (${res.status})`);
        }
        toast.success(mode === "create" ? "配置已创建" : "配置已保存");
        setOpen(false);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "保存失败";
        setError(message);
        toast.error("保存失败", { description: message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button variant={mode === "create" ? "primary" : "ghost"} size="sm">
          {mode === "create" ? <Plus /> : <Save />} {mode === "create" ? "新增配置" : "编辑"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "新增配置" : "编辑配置"}</DialogTitle>
            <DialogDescription>
              Value 会优先按 JSON 解析；解析失败时保存为普通字符串。
            </DialogDescription>
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
            <Button variant="ghost" onClick={close} disabled={pending}>取消</Button>
            <Button type="submit" loading={pending} loadingText="保存中..." disabled={!key.trim()}>
              <Save /> 保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}