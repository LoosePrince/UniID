/**
 * 系统管理 · 全局配置
 *
 * - 默认配额（rps / 每日 API / 每月存储 / 每日函数调用）
 * - 任意 k/v 配置表单化编辑
 */
import { redirect } from "next/navigation";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { ConfigEntryActions } from "@/ui/console/admin-config-entry-actions";
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
  const entries = Object.entries(all)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="container-page space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">全局配置</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">默认配额、全局开关、文件策略等。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>默认配额</CardTitle>
          <CardDescription>用于新应用的默认资源上限，已创建应用不会自动回写。</CardDescription>
        </CardHeader>
        <CardContent>
          <DefaultQuotaForm initial={defaults} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>配置项</CardTitle>
          <CardDescription>支持新增和编辑任意全局配置；Value 支持 JSON 或普通字符串。</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigEntryActions entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
