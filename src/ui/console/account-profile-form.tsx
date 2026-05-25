"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button, Field, Input, Select, toast } from "@/ui/primitives";

interface AccountProfileFormProps {
  initial: {
    displayName: string;
    email: string;
    locale: string;
  };
}

export function AccountProfileForm({ initial }: AccountProfileFormProps) {
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
          throw new Error(data?.error?.message ?? `保存失败 (${res.status})`);
        }
        toast.success("资料已保存");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "保存失败";
        setError(message);
        toast.error("保存失败", { description: message });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <Field
        label="显示名"
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

      <Field label="邮箱" htmlFor="account-email" help="用于展示与后续通知；留空表示不绑定邮箱。">
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

      <Field label="语言" htmlFor="account-locale">
        <Select
          id="account-locale"
          value={form.locale}
          onValueChange={(value) => update("locale", value)}
          disabled={pending}
          options={[
            { value: "zh-CN", label: "简体中文" },
            { value: "en-US", label: "English" }
          ]}
        />
      </Field>

      {error && form.displayName.trim().length > 0 ? (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" loading={pending} loadingText="保存中..." disabled={!dirty || form.displayName.trim().length === 0}>
          <Save /> 保存资料
        </Button>
        {!dirty ? <span className="text-xs text-ink-400">没有未保存改动</span> : null}
      </div>
    </form>
  );
}