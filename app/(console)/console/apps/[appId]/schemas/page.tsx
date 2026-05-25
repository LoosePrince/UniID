import { notFound } from "next/navigation";
import Link from "next/link";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { AppService } from "@/modules/apps";
import { SchemaService } from "@/modules/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/ui/primitives";

export default async function SchemasPage({ params }: { params: { appId: string } }) {
  const auth = await requireConsoleAuth();
  const app = await prisma.app.findUnique({
    where: { id: params.appId },
    include: { admins: true }
  });
  if (!app) notFound();
  if (auth.user.role !== "admin") {
    await AppService.requireOwnerOrAdmin(app.ownerId, app.admins, auth.user.id);
  }
  const schemas = await SchemaService.listForApp(app.id);

  return (
    <div className="container-page py-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Schemas</h1>
        <p className="text-sm text-ink-500 mt-1">JSON Schema 决定 dataType 的写入约束与默认值。</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schemas.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-sm text-ink-500">尚未定义任何 Schema。</CardContent>
          </Card>
        )}
        {schemas.map((s) => {
          const v = s.versions[0];
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-sm">{s.dataType}</CardTitle>
                  {v && <Badge tone={v.isActive ? "success" : "neutral"}>v{v.version} {v.isActive ? "active" : "draft"}</Badge>}
                </div>
                <CardDescription className="line-clamp-2">{s.description ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-ink-500 flex items-center justify-between">
                <span>更新于 {new Date(s.updatedAt * 1000).toLocaleString()}</span>
                <Link href={`/console/apps/${app.id}/data/${s.dataType}`} className="text-accent-600 hover:underline">
                  浏览数据 →
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
