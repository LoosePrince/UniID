"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/ui/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
  toast
} from "@/ui/primitives";

function RegisterPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const redirectTo = params.get("redirectTo") ?? "/console";

  const [form, setForm] = useState({ username: "", email: "", displayName: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          email: form.email || undefined,
          displayName: form.displayName || undefined
        }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(t("auth.register.failed"), {
          description: data?.error?.message ?? t("http.status", { status: res.status })
        });
        setLoading(false);
        return;
      }
      toast.success(t("auth.register.success"));
      router.replace(redirectTo);
    } catch {
      toast.error(t("auth.register.networkError"));
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px] shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.register.title")}</CardTitle>
        <CardDescription>{t("auth.register.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-username">{t("auth.register.username")}</Label>
            <Input
              id="reg-username"
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
              minLength={3}
              maxLength={32}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">{t("auth.register.email")}</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-displayName">{t("auth.register.displayName")}</Label>
            <Input
              id="reg-displayName"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">{t("auth.register.password")}</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Spinner className="text-cream-50" /> : null}
            {loading ? t("auth.register.submitting") : t("auth.register.submit")}
          </Button>
          <p className="text-xs text-ink-500 text-center pt-2">
            {t("auth.register.hasAccount")} {" "}
            <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent-600 hover:underline">
              {t("auth.register.goLogin")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RegisterPageContent />
    </Suspense>
  );
}
