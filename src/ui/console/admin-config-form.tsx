"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/ui/primitives";

interface QuotaDefaults {
  rpsLimit: number;
  dailyApiCalls: number;
  monthlyStorageBytes: number;
  fnInvocationsDaily: number;
}

export function DefaultQuotaForm({ initial }: { initial: QuotaDefaults }) {
  const [form, setForm] = useState<QuotaDefaults>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof QuotaDefaults>(k: K, v: string) => {
    const n = Number(v);
    if (Number.isFinite(n)) setForm({ ...form, [k]: n });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await fetch("/api/v1/admin/config/default-quota", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (res.ok) setMsg("已保存");
      else {
        const json = await res.json().catch(() => ({}));
        setMsg(json?.error?.message ?? `保存失败 (${res.status})`);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rps">每秒请求上限 (rps)</Label>
          <Input id="rps" type="number" min={1} value={form.rpsLimit} onChange={(e) => set("rpsLimit", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="daily">每日 API 调用上限</Label>
          <Input id="daily" type="number" min={1} value={form.dailyApiCalls} onChange={(e) => set("dailyApiCalls", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storage">每月存储上限 (bytes)</Label>
          <Input id="storage" type="number" min={1} value={form.monthlyStorageBytes} onChange={(e) => set("monthlyStorageBytes", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fn">每日函数调用上限</Label>
          <Input id="fn" type="number" min={1} value={form.fnInvocationsDaily} onChange={(e) => set("fnInvocationsDaily", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "保存中..." : "保存"}</Button>
        {msg && <span className="text-sm text-ink-500">{msg}</span>}
      </div>
    </form>
  );
}
