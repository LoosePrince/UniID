"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/ui/i18n";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Spinner, toast } from "@/ui/primitives";

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const redirectTo = params.get("redirectTo") ?? "/console";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, ...(needsMfa ? { totpCode } : {}) }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.error?.code === "AUTH_MFA_REQUIRED") {
          setNeedsMfa(true);
          toast.info(data?.error?.message ?? "请输入两步验证码");
          setLoading(false);
          return;
        }
        toast.error(t("auth.login.failed"), {
          description: data?.error?.message ?? t("http.status", { status: res.status })
        });
        setLoading(false);
        return;
      }
      toast.success(t("auth.login.success"));
      router.replace(redirectTo);
    } catch {
      toast.error(t("auth.login.networkError"));
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[420px] shadow-md">
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.login.title")}</CardTitle>
        <CardDescription>{t("auth.login.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-username">{t("auth.login.username")}</Label>
            <Input
              id="login-username"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">{t("auth.login.password")}</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {needsMfa ? (
            <div className="space-y-1.5">
              <Label htmlFor="login-totp">两步验证码</Label>
              <Input
                id="login-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
                minLength={6}
                maxLength={6}
              />
            </div>
          ) : null}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Spinner className="text-cream-50" /> : null}
            {loading ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
          <p className="text-xs text-ink-500 text-center pt-2">
            {t("auth.login.noAccount")} {" "}
            <Link href={`/register?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent-600 hover:underline">
              {t("auth.login.createAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginPageContent />
    </Suspense>
  );
}
