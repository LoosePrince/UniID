import Link from "next/link";
import { ThemeToggle } from "@/ui/theme";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50 text-ink-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-ink-900 dark:text-slate-100">
          <span className="h-6 w-6 rounded-md bg-ink-900 text-cream-50 flex items-center justify-center font-bold text-xs">
            U
          </span>
          <span className="text-sm font-semibold">UniID</span>
        </Link>
        <ThemeToggle compact />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">{children}</main>
      <footer className="flex h-12 items-center justify-center px-6 text-2xs text-ink-400 dark:text-slate-500">
        UniID · 统一认证、数据与文件服务
      </footer>
    </div>
  );
}
