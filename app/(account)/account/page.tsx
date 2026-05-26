import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { RevokeAppButton } from "@/ui/console/revoke-app-button";

export default async function AccountAuthorizationsPage() {
  const auth = await requireConsoleAuth();
  const authorizations = await AuthService.listAuthorizations(auth.user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">授权应用</h1>
        <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">已授予访问你 UniID 账号的外部应用。</p>
      </header>
      {authorizations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-500 dark:text-slate-400">
            暂无授权应用。当外部网站通过 UniID 登录后会出现在这里。
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
                    {az.authType === "full" ? "完整" : "限制"}
                  </Badge>
                </div>
                <CardDescription className="font-mono truncate">{az.app.primaryDomain}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-ink-500 dark:text-slate-400">
                <span>授权于 {new Date(az.grantedAt * 1000).toLocaleString()}</span>
                <RevokeAppButton userId={auth.user.id} appId={az.appId} appName={az.app.name} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
