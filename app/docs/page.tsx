import Link from "next/link";
import { BookOpen, Code2, Database, FileText, Network, ShieldCheck } from "lucide-react";
import { getServerI18n } from "@/shared/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from "@/ui/primitives";
import { ThemeToggle } from "@/ui/theme";

const docSlugs = ["api", "sdk", "policy", "functions", "architecture"] as const;

const docMeta = {
  api: { source: "docs/api.md", icon: Network },
  sdk: { source: "docs/sdk.md", icon: Code2 },
  policy: { source: "docs/policy.md", icon: ShieldCheck },
  functions: { source: "docs/functions.md", icon: FileText },
  architecture: { source: "docs/architecture.md", icon: Database }
} as const;

export default async function DocsPage() {
  const { t } = await getServerI18n();

  return (
    <main className="min-h-screen bg-cream-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-ink-100 bg-white/80 backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/90 dark:shadow-[0_1px_0_rgba(129,148,163,0.12)]">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900 text-sm text-cream-50 dark:bg-slate-100 dark:text-slate-950">U</span>
            <span className="text-ink-900 dark:text-slate-100">UniID Docs</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Button asChild variant="outline" size="sm">
              <Link href="/design">{t("docs.designSystem")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/console">{t("docs.openConsole")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container-page py-12 space-y-10">
        <div className="max-w-3xl space-y-4">
          <Badge tone="accent">Documentation</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 dark:text-slate-100 md:text-5xl">
            {t("docs.pageTitle")}
          </h1>
          <p className="text-md leading-relaxed text-ink-600 dark:text-slate-300">
            {t("docs.pageDescription")}
          </p>
          <div className="flex flex-wrap gap-2">
            {docSlugs.map((slug) => (
              <Button key={slug} asChild variant="outline" size="sm">
                <Link href={`/docs/${slug}`}>{t(`docs.items.${slug}.title`)}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docSlugs.map((slug) => {
            const meta = docMeta[slug];
            const Icon = meta.icon;
            return (
              <Card key={slug}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="h-4 w-4" /> {t(`docs.items.${slug}.title`)}
                      </CardTitle>
                      <CardDescription>{t(`docs.items.${slug}.description`)}</CardDescription>
                    </div>
                    <Badge tone="neutral">{meta.source}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-ink-600 dark:text-slate-300">
                  <p>
                    {t("docs.sourceHint", { path: meta.source })}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/docs/${slug}`}>
                      <BookOpen /> {t("docs.readDoc")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
