import { AccountNav } from "@/ui/console/account-nav";

export default function ConsoleAccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-slate-100">账号中心</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">
            管理授权、会话、文件和个人资料；账号系统现在统一在控制台内使用。
          </p>
        </div>
        <AccountNav />
      </header>
      <main>{children}</main>
    </div>
  );
}