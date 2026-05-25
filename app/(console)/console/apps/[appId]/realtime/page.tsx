import { notFound } from "next/navigation";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/primitives";
import { RealtimeTester } from "@/ui/console/realtime-tester";

export default async function RealtimePage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
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
        <h1 className="text-xl font-semibold tracking-tight">实时 (Realtime)</h1>
        <p className="text-sm text-ink-500 mt-1">
          基于 SSE。所有数据/文件/广播事件按订阅推送到客户端。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">概览</CardTitle>
          <CardDescription>最近 24 小时的写入活动。</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            <span className="text-ink-500">24h 内更新记录数：</span>
            <span className="font-mono">{recentRecords.toLocaleString()}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SDK 用法</CardTitle>
          <CardDescription>无需任何控制台配置，前端订阅即可。</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-cream-50 border border-cream-300 rounded-sm p-3 overflow-auto">
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
          <p className="mt-3 text-xs text-ink-500">
            完整 API 见 <code className="font-mono">docs/sdk.md</code> 的 Realtime 章节。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
