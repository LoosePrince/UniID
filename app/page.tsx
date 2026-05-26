import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Database, Files, Radio, Code2, Clock, User as UserIcon } from "lucide-react";
import { getCurrentUserSession } from "@/shared/iam";
import { getServerI18n } from "@/shared/i18n";
import { Button } from "@/ui/primitives";
import { ThemeToggle } from "@/ui/theme";

export default async function Home() {
  const session = await getCurrentUserSession();
  const { t } = await getServerI18n();

  return (
    <main className="min-h-screen overflow-hidden bg-cream-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_20%_10%,rgba(119,111,218,0.16),transparent_32%),radial-gradient(circle_at_78%_8%,rgba(197,184,145,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(251,249,244,0))] dark:bg-[radial-gradient(circle_at_20%_10%,rgba(99,109,180,0.12),transparent_32%),radial-gradient(circle_at_78%_8%,rgba(89,110,128,0.14),transparent_30%),linear-gradient(180deg,rgba(11,17,23,0.95),rgba(20,29,36,0))]" />

      <header className="sticky top-0 z-40 border-b border-white/50 bg-cream-50/72 backdrop-blur-xl supports-[backdrop-filter]:bg-cream-50/60 dark:border-slate-700/60 dark:bg-slate-950/72 dark:supports-[backdrop-filter]:bg-slate-950/60">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-900 text-sm font-bold text-cream-50 shadow-[0_12px_28px_rgba(19,17,14,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform group-hover:-translate-y-0.5">
              U
            </div>
            <span className="text-md font-semibold tracking-tight">UniID</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-ink-200/70 bg-white/40 p-1 text-sm text-ink-600 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300 md:flex">
            <Link className="rounded-full px-3.5 py-2 hover:bg-white/70 hover:text-ink-900 dark:hover:bg-slate-800/70 dark:hover:text-slate-100" href="/docs">{t("home.docs")}</Link>
            <Link className="rounded-full px-3.5 py-2 hover:bg-white/70 hover:text-ink-900 dark:hover:bg-slate-800/70 dark:hover:text-slate-100" href="/console">{t("home.console")}</Link>
            <Link className="rounded-full px-3.5 py-2 hover:bg-white/70 hover:text-ink-900 dark:hover:bg-slate-800/70 dark:hover:text-slate-100" href="/account">{t("home.myAccount")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle compact className="hidden sm:inline-flex" />
            {session ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-ink-200/70 bg-white/50 px-3 py-1.5 text-sm text-ink-600 shadow-xs sm:flex dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="max-w-28 truncate">@{session.username}</span>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-2xs font-medium text-success-700">{t("home.signedIn")}</span>
                </div>
                <Button asChild variant="hero" size="sm"><Link href="/console">{t("home.enterConsole")} <ArrowUpRight /></Link></Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link href="/login">{t("auth.login.submit")}</Link></Button>
                <Button asChild variant="hero" size="sm"><Link href="/register">{t("home.getStarted")} <ArrowUpRight /></Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="container-page relative py-20 md:py-28">
        <div className="absolute right-8 top-20 hidden h-72 w-72 rounded-full bg-accent-300/18 blur-3xl md:block" />
        <div className="surface-subtle accent-halo relative overflow-hidden rounded-2xl p-8 md:p-12">
          <div className="panel-grid absolute inset-0 opacity-35" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/60 px-3.5 py-1.5 text-2xs font-medium tracking-wide text-ink-600 shadow-xs backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 shadow-[0_0_18px_rgba(91,91,214,0.7)]" />
              {t("home.heroBadge")}
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-ink-900 text-balance dark:text-slate-100 md:text-6xl">
              {t("home.heroTitle1")}<br />{t("home.heroTitle2")}
            </h1>
            <p className="mt-6 max-w-2xl text-md leading-relaxed text-ink-600 dark:text-slate-300 md:text-lg">
              {t("home.heroDescription")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="hero"><Link href="/register">{t("home.freeStart")} <ArrowUpRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/docs">{t("home.readDocs")}</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={ShieldCheck} title="Auth" desc={t("home.feature.auth")} />
          <Feature icon={Database} title="Data" desc={t("home.feature.data")} />
          <Feature icon={Files} title="Files" desc={t("home.feature.files")} />
          <Feature icon={Radio} title="Realtime" desc={t("home.feature.realtime")} />
          <Feature icon={Code2} title="Functions" desc={t("home.feature.functions")} />
          <Feature icon={Clock} title="Cron & Webhooks" desc={t("home.feature.cronWebhooks")} />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  desc
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="surface-elevated group rounded-2xl p-6 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-ink-900 shadow-xs transition-colors group-hover:text-accent-700 dark:bg-slate-800/70 dark:text-slate-100 dark:group-hover:text-accent-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-md font-semibold text-ink-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-slate-400">{desc}</p>
    </div>
  );
}
