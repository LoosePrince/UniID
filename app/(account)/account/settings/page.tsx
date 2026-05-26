import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { AccountProfileForm } from "@/ui/console/account-profile-form";
import { ChangePasswordForm } from "@/ui/console/change-password-form";

export default async function AccountSettingsPage() {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime } = createI18n(normalizeLocale(auth.user.locale));
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      locale: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const roleLabel = user?.role === "admin" ? t("accountSettings.role.admin") : t("accountSettings.role.user");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("accountSettings.title")}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{t("accountSettings.description")}</p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{t("accountSettings.overviewTitle")}</CardTitle>
              <CardDescription>{t("accountSettings.overviewDescription")}</CardDescription>
            </div>
            <Badge tone={user?.role === "admin" ? "accent" : "neutral"}>{roleLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row k={t("accountSettings.userId")} v={user?.id ?? "—"} />
          <Row k={t("accountSettings.username")} v={user?.username ?? "—"} />
          <Row k={t("accountSettings.createdAt")} v={user ? formatDateTime(user.createdAt) : "—"} />
          <Row k={t("accountSettings.updatedAt")} v={user ? formatDateTime(user.updatedAt) : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("accountSettings.profileTitle")}</CardTitle>
          <CardDescription>{t("accountSettings.profileDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountProfileForm
            initial={{
              displayName: user?.displayName ?? user?.username ?? "",
              email: user?.email ?? "",
              locale: user?.locale ?? "zh-CN"
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("accountSettings.passwordTitle")}</CardTitle>
          <CardDescription>{t("accountSettings.passwordDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-ink-100 bg-cream-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/70 dark:bg-slate-900/50">
      <span className="text-ink-500 dark:text-slate-400">{k}</span>
      <span className="break-all font-mono text-xs text-ink-900 dark:text-slate-100">{v}</span>
    </div>
  );
}
