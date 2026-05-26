import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { RevokeOtherSessionsButton } from "@/ui/console/revoke-other-sessions-button";
import { RevokeSessionButton } from "@/ui/console/revoke-session-button";

export default async function ConsoleAccountSessionsPage() {
  const auth = await requireConsoleAuth();
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
          <h2 className="text-xl font-semibold tracking-tight">会话</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">管理所有登录设备与 SDK 会话。</p>
        </div>
        <RevokeOtherSessionsButton sessions={otherSessions} />
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label="控制台会话" value={consoleSessions.length} />
        <Metric label="SDK / 应用会话" value={appSessions.length} />
        <Metric label="可撤销会话" value={otherSessions.length} />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-900 dark:text-slate-100">UniID 控制台会话</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {consoleSessions.length === 0 ? <Empty label="暂无控制台会话" /> : null}
          {consoleSessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm">
                    {s.id === auth.session.sessionId ? "当前设备" : `会话 ${s.id.slice(0, 6)}`}
                  </CardTitle>
                  {s.id === auth.session.sessionId ? <Badge tone="success">当前</Badge> : null}
                </div>
                <CardDescription className="truncate font-mono text-2xs">
                  {s.userAgent ?? "unknown UA"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-ink-500 dark:text-slate-400">
                <div className="grid grid-cols-2 gap-2">
                  <span>最近活跃</span>
                  <span className="text-right font-mono">{new Date(s.lastSeenAt * 1000).toLocaleString()}</span>
                  <span>过期时间</span>
                  <span className="text-right font-mono">{new Date(s.expiresAt * 1000).toLocaleString()}</span>
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
        <h3 className="mb-3 text-sm font-semibold text-ink-900 dark:text-slate-100">SDK / 应用会话</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {appSessions.length === 0 ? <Empty label="暂无 SDK / 应用会话" /> : null}
          {appSessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="truncate text-sm">{s.app.name}</CardTitle>
                  <Badge tone={s.authType === "full" ? "accent" : "neutral"}>
                    {s.authType === "full" ? "完整" : "限制"}
                  </Badge>
                </div>
                <CardDescription className="truncate font-mono text-2xs">{s.app.primaryDomain}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-ink-500 dark:text-slate-400">
                <div className="grid grid-cols-2 gap-2">
                  <span>最近活跃</span>
                  <span className="text-right font-mono">{new Date(s.lastSeenAt * 1000).toLocaleString()}</span>
                  <span>创建时间</span>
                  <span className="text-right font-mono">{new Date(s.createdAt * 1000).toLocaleString()}</span>
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

function Metric({ label, value }: { label: string; value: number }) {
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