import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/ui/primitives";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "UniID — Auth, Data, Files for static sites",
    template: "%s · UniID"
  },
  description:
    "UniID 把认证、数据库和文件存储打包成可嵌入的服务，让纯静态网站无需后端也能拥有现代化能力。",
  applicationName: "UniID",
  authors: [{ name: "UniID" }]
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FBF9F4"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
