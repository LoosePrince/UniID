import Link from "next/link";
import { Plus } from "lucide-react";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { AppService } from "@/modules/apps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from "@/ui/primitives";

export default async function AppsListPage() {
  const auth = await requireConsoleAuth();
  const { t } = createI18n(normalizeLocale(auth.user.locale));
  const apps = await AppService.listOwnedOrAdmin(auth.user.id);

  return (
    <div className="container-page py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("apps.title")}</h1>
          <p className="text-sm text-ink-500 mt-1">{t("apps.description")}</p>
        </div>
        <Button asChild>
          <Link href="/console/apps/new">
            <Plus /> {t("common.createApp")}
          </Link>
        </Button>
      </header>

      {apps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-ink-600">{t("apps.empty")}</p>
            <Button asChild className="mt-4">
              <Link href="/console/apps/new">
                <Plus /> {t("apps.createFirst")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {apps.map((a) => (
            <Link key={a.id} href={`/console/apps/${a.id}`}>
              <Card className="h-full hover:border-ink-300 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate">{a.name}</CardTitle>
                    <Badge tone={a.status === "active" ? "success" : "warning"}>{a.status}</Badge>
                  </div>
                  <CardDescription className="font-mono truncate">{a.primaryDomain}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-ink-500 line-clamp-2">
                  {a.description ?? t("apps.noDescription")}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
