/**
 * 系统管理 · 全局配置
 *
 * - 系统运行时配置和功能开关
 * - 任意 k/v 配置表单化编辑
 */
import { redirect } from "next/navigation";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireSystemAdmin } from "@/shared/iam";
import { AdminService } from "@/modules/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/primitives";
import { ConfigEntryActions } from "@/ui/console/admin-config-entry-actions";
import { SystemConfigForm } from "@/ui/console/admin-config-form";
import { SYSTEM_CONFIG_KEY } from "@/shared/system-config";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  let t: ReturnType<typeof createI18n>["t"];
  try {
    const auth = await requireSystemAdmin();
    t = createI18n(normalizeLocale(auth.user.locale)).t;
  } catch {
    redirect("/console");
  }

  const [systemConfig, all] = await Promise.all([
    AdminService.getSystemConfig(),
    AdminService.listConfig()
  ]);
  const entries = Object.entries(all)
    .filter(([key]) => key !== SYSTEM_CONFIG_KEY && key !== "auth_security" && key !== "default_quota")
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="container-page space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("common.globalConfig")}</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{t("admin.config.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.config.systemTitle")}</CardTitle>
          <CardDescription>{t("admin.config.systemDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SystemConfigForm initial={systemConfig} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.config.entriesTitle")}</CardTitle>
          <CardDescription>{t("admin.config.entriesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigEntryActions entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
