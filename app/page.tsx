import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Database, Files, Radio, Code2, Clock, User as UserIcon } from "lucide-react";
import { getCurrentUserSession } from "@/shared/iam";
import { Button } from "@/ui/primitives";

export default async function Home() {
  const session = await getCurrentUserSession();

  return (
    <main className="min-h-screen overflow-hidden bg-cream-50 text-ink-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(circle_at_20%_10%,rgba(119,111,218,0.16),transparent_32%),radial-gradient(circle_at_78%_8%,rgba(197,184,145,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(251,249,244,0))]" />

      <header className="sticky top-0 z-40 border-b border-white/50 bg-cream-50/72 backdrop-blur-xl supports-[backdrop-filter]:bg-cream-50/56">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-900 text-sm font-bold text-cream-50 shadow-[0_12px_28px_rgba(19,17,14,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform group-hover:-translate-y-0.5">
              U
            </div>
            <span className="text-md font-semibold tracking-tight">UniID</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-white/60 bg-white/42 p-1 text-sm text-ink-600 shadow-xs backdrop-blur-sm md:flex">
            <Link className="rounded-full px-3.5 py-2 hover:bg-white/76 hover:text-ink-900" href="/docs">文档</Link>
            <Link className="rounded-full px-3.5 py-2 hover:bg-white/76 hover:text-ink-900" href="/console">控制台</Link>
            <Link className="rounded-full px-3.5 py-2 hover:bg-white/76 hover:text-ink-900" href="/account">我的账号</Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/52 px-3 py-1.5 text-sm text-ink-600 shadow-xs sm:flex">
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="max-w-28 truncate">@{session.username}</span>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-2xs font-medium text-success-700">已登录</span>
                </div>
                <Button asChild variant="hero" size="sm"><Link href="/console">进入控制台 <ArrowUpRight /></Link></Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link href="/login">登录</Link></Button>
                <Button asChild variant="hero" size="sm"><Link href="/register">开始使用 <ArrowUpRight /></Link></Button>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/66 px-3.5 py-1.5 text-2xs font-medium tracking-wide text-ink-600 shadow-xs backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500 shadow-[0_0_18px_rgba(91,91,214,0.7)]" />
              v2.0 · 认证 · 数据 · 文件 · 实时 · 函数
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-ink-900 text-balance md:text-6xl">
              把后端能力，<br />嵌入静态站点。
            </h1>
            <p className="mt-6 max-w-2xl text-md leading-relaxed text-ink-600 md:text-lg">
              UniID 通过 iframe + SDK 给纯静态站点提供统一身份、数据库、文件存储、实时订阅和云函数。
              只要域名匹配 + 用户授权，所有能力即可在浏览器侧直接使用——无需任何后端。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="hero"><Link href="/register">免费开始 <ArrowUpRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/docs">阅读文档</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={ShieldCheck} title="Auth" desc="iframe + postMessage 信任链，浏览器 Origin 是唯一可信身份。" />
          <Feature icon={Database} title="Data" desc="JSON Schema 强制校验，字段级权限，原子增量与追加。" />
          <Feature icon={Files} title="Files" desc="S3 预签名直链下载，分片上传，分享 token。" />
          <Feature icon={Radio} title="Realtime" desc="SSE 通道：records / query / broadcast / presence。" />
          <Feature icon={Code2} title="Functions" desc="QuickJS 沙箱执行用户代码，HTTP / Cron / Event 触发。" />
          <Feature icon={Clock} title="Cron & Webhooks" desc="定时调度与可观测的 webhook 投递重试。" />
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
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-ink-900 shadow-xs transition-colors group-hover:text-accent-700">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-md font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">{desc}</p>
    </div>
  );
}
