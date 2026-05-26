import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { RevokeOtherSessionsButton } from "@/ui/console/revoke-other-sessions-button";
import { RevokeSessionButton } from "@/ui/console/revoke-session-button";

export default async function AccountSessionsPage() {
  const auth = await requireConsoleAuth();
  const { t, formatDateTime, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
  const [consoleSessions, appSessions] = await Promise.all([
    AuthService.listConsoleSessions(auth.user.id),
    AuthService.listAppSessions(auth.user.id)
  ]);

  const otherSessions = [
    ...consoleSessions
      .filter((session) => session.id !== auth.session.sessionId)
      .map((session) => ({ id: session.id, kind: "user" as const })),
    ...appSessions.map((session) => ({ id: session.id, kind: "app" as const }))
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("sessions.title")}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{t("sessions.description")}</p>
        </div>
        <RevokeOtherSessionsButton sessions={otherSessions} />
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label={t("sessions.consoleCount")} value={formatNumber(consoleSessions.length)} />
        <Metric label={t("sessions.appCount")} value={formatNumber(appSessions.length)} />
        <Metric label={t("sessions.revokableCount")} value={formatNumber(otherSessions.length)} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-900 dark:text-slate-100">{t("sessions.consoleSection")}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {consoleSessions.length === 0 ? <Empty label={t("sessions.emptyConsole")} /> : null}
          {consoleSessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm">
                    {s.id === auth.session.sessionId
                      ? t("sessions.currentDevice")
                      : t("sessions.sessionShort", { id: s.id.slice(0, 6) })}
                  </CardTitle>
                  {s.id === auth.session.sessionId ? <Badge tone="success">{t("sessions.current")}</Badge> : null}
                </div>
                <CardDescription className="truncate font-mono text-2xs">
                  {s.userAgent ?? t("sessions.unknownUa")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-ink-500 dark:text-slate-400">
                <div className="grid grid-cols-2 gap-2">
                  <span>{t("sessions.lastSeen")}</span>
                  <span className="text-right font-mono">{formatDateTime(s.lastSeenAt)}</span>
                  <span>{t("sessions.expiresAt")}</span>
                  <span className="text-right font-mono">{formatDateTime(s.expiresAt)}</span>
                </div>
                {s.id !== auth.session.sessionId ? (
                  <div className="flex justify-end">
                    <RevokeSessionButton sessionId={s.id} kind="user" />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-900 dark:text-slate-100">{t("sessions.appSection")}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {appSessions.length === 0 ? <Empty label={t("sessions.emptyApp")} /> : null}
          {appSessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="truncate text-sm">{s.app.name}</CardTitle>
                  <Badge tone={s.authType === "full" ? "accent" : "neutral"}>
                    {s.authType === "full" ? t("sessions.full") : t("sessions.restricted")}
                  </Badge>
                </div>
                <CardDescription className="truncate font-mono text-2xs">{s.app.primaryDomain}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-ink-500 dark:text-slate-400">
                <div className="grid grid-cols-2 gap-2">
                  <span>{t("sessions.lastSeen")}</span>
                  <span className="text-right font-mono">{formatDateTime(s.lastSeenAt)}</span>
                  <span>{t("sessions.createdAt")}</span>
                  <span className="text-right font-mono">{formatDateTime(s.createdAt)}</span>
                </div>
                <div className="flex justify-end">
                  <RevokeSessionButton sessionId={s.id} kind="app" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-ink-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 dark:text-slate-100">{value}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Card className="md:col-span-2">
      <CardContent className="py-10 text-center text-sm text-ink-400 dark:text-slate-500">{label}</CardContent>
    </Card>
  );
}