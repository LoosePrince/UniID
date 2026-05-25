/**
 * 系统管理 · 全局配置
 *
 * - 默认配额（rps / 每日 API / 每月存储 / 每日函数调用）
 * - 任意 k/v 文本配置（控制台显示当前快照）
 */
import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/primitives";
import { DefaultQuotaForm } from "@/ui/console/admin-config-form";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  try {
    await requireSystemAdmin();
  } catch {
    redirect("/console");
  }

  const [defaults, all] = await Promise.all([
    AdminService.getDefaultQuota(),
    AdminService.listConfig()
  ]);

  return (
    <div className="container-page py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">全局配置</h1>
        <p className="mt-1 text-sm text-ink-500">默认配额、全局开关、文件策略等</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>默认配额</CardTitle>
        </CardHeader>
        <CardContent>
          <DefaultQuotaForm initial={defaults} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前配置快照</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-cream-50 border border-sand-200 rounded-md p-4 overflow-auto max-h-96">
            {JSON.stringify(all, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
