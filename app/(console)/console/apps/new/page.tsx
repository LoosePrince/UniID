import { ArrowLeft, BadgeCheck, Globe2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@/ui/primitives";
import { CreateAppForm } from "@/ui/console/create-app-form";

export default async function NewAppPage() {
  const auth = await requireConsoleAuth();
  const { t } = createI18n(normalizeLocale(auth.user.locale));
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { username: "asc" },
    select: { id: true, username: true, displayName: true, email: true }
  });
  const canCreate = auth.user.role === "admin";

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/console/apps">
            <ArrowLeft /> {t("apps.new.back")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("apps.new.title")}</CardTitle>
            <CardDescription>{t("apps.new.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {canCreate ? (
              <CreateAppForm users={users} currentUserId={auth.user.id} />
            ) : (
              <div className="rounded-xl border border-sand-200 bg-cream-50 px-4 py-3 text-sm text-ink-600">
                {t("apps.new.noPermission")}
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-3">
          <InfoCard icon={Globe2} title={t("apps.new.info.domain.title")} text={t("apps.new.info.domain.text")} />
          <InfoCard icon={ShieldCheck} title={t("apps.new.info.permission.title")} text={t("apps.new.info.permission.text")} />
          <InfoCard icon={BadgeCheck} title={t("apps.new.info.quota.title")} text={t("apps.new.info.quota.text")} />
        </aside>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <Card className="bg-white/70">
      <CardContent className="flex gap-3 p-4">
        <div className="mt-0.5 rounded-md bg-accent-50 p-2 text-accent-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-medium text-ink-900">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-ink-500">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}
