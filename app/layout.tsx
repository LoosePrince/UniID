import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "UniID",
  description: "Unified authentication and data service"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center">
          {children}
        </div>
      </body>
    </html>
  );
}

