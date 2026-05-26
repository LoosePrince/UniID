import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { RevokeAppButton } from "@/ui/console/revoke-app-button";

export default async function AccountAuthorizationsPage() {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime } = createI18n(normalizeLocale(auth.user.locale));
  const authorizations = await AuthService.listAuthorizations(auth.user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("authorizations.title")}</h1>
        <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">{t("authorizations.description")}</p>
      </header>
      {authorizations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-500 dark:text-slate-400">
            {t("authorizations.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {authorizations.map((az) => (
            <Card key={az.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="truncate">{az.app.name}</CardTitle>
                  <Badge tone={az.authType === "full" ? "accent" : "neutral"}>
                    {az.authType === "full" ? t("sessions.full") : t("sessions.restricted")}
                  </Badge>
                </div>
                <CardDescription className="font-mono truncate">{az.app.primaryDomain}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-ink-500 dark:text-slate-400">
                <span>{t("authorizations.grantedAt", { time: formatDateTime(az.grantedAt) })}</span>
                <RevokeAppButton userId={auth.user.id} appId={az.appId} appName={az.app.name} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
