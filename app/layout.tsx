import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { getServerI18n, resolveCurrentLocale } from "@/shared/i18n";
import { I18nProvider } from "@/ui/i18n";
import { Toaster } from "@/ui/primitives";
import { ThemeProvider, ThemeScript } from "@/ui/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: {
      default: "UniID — Auth, Data, Files for static sites",
      template: "%s · UniID"
    },
    description: t("meta.description"),
    applicationName: "UniID",
    authors: [{ name: "UniID" }]
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FBF9F4"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveCurrentLocale();

  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeScript />
        <I18nProvider locale={locale}>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
