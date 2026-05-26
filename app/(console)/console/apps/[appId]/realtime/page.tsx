import { notFound } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/primitives";
import { RealtimeTester } from "@/ui/console/realtime-tester";

export default async function RealtimePage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const { t, formatNumber } = createI18n(normalizeLocale(auth.user.locale));
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }

  const recentRecords = await prisma.record.count({
    where: {
      appId: app.id,
      updatedAt: { gte: Math.floor(Date.now() / 1000) - 24 * 3600 }
    }
  });

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("common.realtime")}</h1>
        <p className="text-sm text-ink-500 mt-1 dark:text-slate-400">{t("appRealtime.description")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("page.realtime.overviewTitle")}</CardTitle>
          <CardDescription>{t("page.realtime.overviewDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            <span className="text-ink-500 dark:text-slate-400">{t("page.realtime.records24h")}</span>
            <span className="font-mono text-ink-900 dark:text-slate-100">{formatNumber(recentRecords)}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("page.realtime.sdkTitle")}</CardTitle>
          <CardDescription>{t("page.realtime.sdkDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl border border-slate-700/80 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200 shadow-[0_18px_42px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] dark:border-slate-600/70 dark:bg-slate-950 dark:text-slate-200">
{`// 订阅 records 频道（自动鉴权 + 自动 reconnect）
const ch = uniid.realtime
  .channel("records:post")
  .on("record.created", (env) => console.log("new post", env.payload))
  .on("record.updated", (env) => console.log("updated", env.payload))
  .subscribe();

// 广播任意消息
uniid.realtime.broadcast("chat:lobby", { from: "alice", text: "Hi!" });
`}
          </pre>
          <p className="mt-3 text-xs text-ink-500 dark:text-slate-400">
            {t("page.realtime.sdkDocs")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
