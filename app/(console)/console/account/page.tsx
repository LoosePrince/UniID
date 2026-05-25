import { requireConsoleAuth } from "@/shared/iam";
import { AuthService } from "@/modules/auth";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { RevokeAppButton } from "@/ui/console/revoke-app-button";

export default async function ConsoleAccountAuthorizationsPage() {
  const auth = await requireConsoleAuth();
  const authorizations = await AuthService.listAuthorizations(auth.user.id);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">授权应用</h2>
        <p className="mt-1 text-sm text-ink-500">已授予访问你 UniID 账号的外部应用。</p>
      </header>
      {authorizations.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-500">
            暂无授权应用。当外部网站通过 UniID 登录后会出现在这里。
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {authorizations.map((az) => (
            <Card key={az.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="truncate">{az.app.name}</CardTitle>
                  <Badge tone={az.authType === "full" ? "accent" : "neutral"}>
                    {az.authType === "full" ? "完整" : "限制"}
                  </Badge>
                </div>
                <CardDescription className="truncate font-mono">{az.app.primaryDomain}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-ink-500">
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