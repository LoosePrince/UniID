import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { RevokeSessionButton } from "@/ui/console/revoke-session-button";

export default async function AccountSessionsPage() {
  const auth = await requireConsoleAuth();
  const [consoleSessions, appSessions] = await Promise.all([
    AuthService.listConsoleSessions(auth.user.id),
    AuthService.listAppSessions(auth.user.id)
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">会话</h1>
        <p className="text-sm text-ink-500 mt-1">管理所有登录设备与 SDK 会话。</p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-ink-900 mb-3">UniID 控制台会话</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {consoleSessions.length === 0 && (
            <p className="text-sm text-ink-500">无</p>
          )}
          {consoleSessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">
                    {s.id === auth.session.sessionId ? "当前设备" : `会话 ${s.id.slice(0, 6)}`}
                  </CardTitle>
                  {s.id === auth.session.sessionId && <Badge tone="success">当前</Badge>}
                </div>
                <CardDescription className="font-mono text-2xs truncate">
                  {s.userAgent ?? "unknown UA"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-ink-500">
                <span>{new Date(s.lastSeenAt * 1000).toLocaleString()}</span>
                {s.id !== auth.session.sessionId && (
                  <RevokeSessionButton sessionId={s.id} kind="user" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink-900 mb-3">SDK / 应用会话</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {appSessions.length === 0 && <p className="text-sm text-ink-500">无</p>}
          {appSessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm truncate">{s.app.name}</CardTitle>
                  <Badge tone={s.authType === "full" ? "accent" : "neutral"}>
                    {s.authType === "full" ? "完整" : "限制"}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-2xs truncate">{s.app.primaryDomain}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-ink-500">
                <span>{new Date(s.lastSeenAt * 1000).toLocaleString()}</span>
                <RevokeSessionButton sessionId={s.id} kind="app" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
