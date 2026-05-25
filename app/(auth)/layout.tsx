import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      <header className="h-14 px-6 flex items-center">
        <Link href="/" className="flex items-center gap-2 text-ink-900">
          <span className="h-6 w-6 rounded-md bg-ink-900 text-cream-50 flex items-center justify-center font-bold text-xs">
            U
          </span>
          <span className="text-sm font-semibold">UniID</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">{children}</main>
      <footer className="h-12 px-6 flex items-center justify-center text-2xs text-ink-400">
        UniID · 统一认证、数据与文件服务
      </footer>
    </div>
  );
}
