import { normalizeLocale, createI18n } from "@/shared/i18n";
import { requireConsoleAuth } from "@/shared/iam";
import { AccountNav } from "@/ui/console/account-nav";

export default async function ConsoleAccountLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireConsoleAuth();
  const { t } = createI18n(normalizeLocale(auth.user.locale));

  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-slate-100">{t("accountCenter.title")}</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{t("accountCenter.description")}</p>
        </div>
        <AccountNav />
      </header>
      <main>{children}</main>
    </div>
  );
}
