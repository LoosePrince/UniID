"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
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

interface RegistrationConfig {
  registrationEnabled: boolean;
  registrationEmailVerificationRequired: boolean;
}

function RegisterPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const redirectTo = params.get("redirectTo") ?? "/console";

  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    password: "",
    emailVerificationCode: ""
  });
  const [registrationConfig, setRegistrationConfig] = useState<RegistrationConfig>({
    registrationEnabled: true,
    registrationEmailVerificationRequired: false
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [emailVerificationChallenge, setEmailVerificationChallenge] = useState<string | null>(null);

  const emailVerificationRequired = registrationConfig.registrationEmailVerificationRequired;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/auth/register/config", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setRegistrationConfig({
            registrationEnabled: Boolean(data.registrationEnabled),
            registrationEmailVerificationRequired: Boolean(data.registrationEmailVerificationRequired)
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendEmailCode() {
    if (!form.email) {
      toast.error(t("auth.register.codeSendFailed"), {
        description: t("auth.register.emailRequiredForVerification")
      });
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch("/api/v1/auth/register/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: form.email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("auth.register.codeSendFailed"), {
          description: data?.error?.message ?? t("http.status", { status: res.status })
        });
        return;
      }
      if (typeof data.challenge === "string") {
        setEmailVerificationChallenge(data.challenge);
      }
      if (data.sent || data.code) {
        toast.success(t("auth.register.codeSent"), {
          description: typeof data.code === "string" ? t("auth.register.codeDebug", { code: data.code }) : undefined
        });
      } else {
        setEmailVerificationChallenge(null);
        toast.error(t("auth.register.codeSendFailed"));
      }
    } catch {
      toast.error(t("auth.register.networkError"));
    } finally {
      setSendingCode(false);
    }
  }

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
          displayName: form.displayName || undefined,
          emailVerificationCode: emailVerificationRequired ? form.emailVerificationCode || undefined : undefined,
          emailVerificationChallenge: emailVerificationRequired ? emailVerificationChallenge ?? undefined : undefined
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
        {!registrationConfig.registrationEnabled ? (
          <div className="space-y-4">
            <p className="rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700 dark:border-warning-500/40 dark:bg-warning-700 dark:text-warning-50">
              {t("auth.register.disabled")}
            </p>
            <p className="text-center text-xs text-ink-500">
              {t("auth.register.hasAccount")}{" "}
              <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="text-accent-600 hover:underline">
                {t("auth.register.goLogin")}
              </Link>
            </p>
          </div>
        ) : (
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
            <Label htmlFor="reg-email">{emailVerificationRequired ? t("auth.register.emailRequired") : t("auth.register.email")}</Label>
            <div className={emailVerificationRequired ? "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" : undefined}>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value, emailVerificationCode: "" }));
                  setEmailVerificationChallenge(null);
                }}
                required={emailVerificationRequired}
              />
              {emailVerificationRequired ? (
                <Button type="button" variant="secondary" onClick={sendEmailCode} loading={sendingCode} loadingText={t("auth.register.sendingCode")} disabled={configLoading || loading}>
                  <MailCheck /> {t("auth.register.sendCode")}
                </Button>
              ) : null}
            </div>
          </div>
          {emailVerificationRequired ? (
            <div className="space-y-1.5">
              <Label htmlFor="reg-email-code">{t("auth.register.emailCode")}</Label>
              <Input
                id="reg-email-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={form.emailVerificationCode}
                onChange={(e) => setForm((f) => ({ ...f, emailVerificationCode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                required
              />
            </div>
          ) : null}
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
          <Button type="submit" className="w-full" size="lg" disabled={loading || configLoading}>
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
        )}
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
