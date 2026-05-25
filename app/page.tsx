import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Database, Files, Radio, Code2, Clock } from "lucide-react";
import { Button } from "@/ui/primitives";

export default function Home() {
  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-100/60 bg-cream-50/80 backdrop-blur supports-[backdrop-filter]:bg-cream-50/60 sticky top-0 z-40">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-ink-900 text-cream-50 flex items-center justify-center font-bold text-sm">U</div>
            <span className="text-md font-semibold tracking-tight">UniID</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-ink-600">
            <Link className="px-3 py-1.5 rounded-sm hover:bg-cream-100 hover:text-ink-900" href="/docs">文档</Link>
            <Link className="px-3 py-1.5 rounded-sm hover:bg-cream-100 hover:text-ink-900" href="/console">控制台</Link>
            <Link className="px-3 py-1.5 rounded-sm hover:bg-cream-100 hover:text-ink-900" href="/account">我的账号</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/login">登录</Link></Button>
            <Button asChild size="sm"><Link href="/register">开始使用 <ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </header>

      <section className="container-page py-20 md:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-cream-100 px-3 py-1 text-2xs font-medium tracking-wide text-ink-600 border border-ink-100">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500"></span>
            v2.0 · 认证 · 数据 · 文件 · 实时 · 函数
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-ink-900 leading-[1.05] text-balance">
            把后端能力，<br />嵌入静态站点。
          </h1>
          <p className="mt-6 text-md md:text-lg text-ink-600 max-w-2xl leading-relaxed">
            UniID 通过 iframe + SDK 给纯静态站点提供统一身份、数据库、文件存储、实时订阅和云函数。
            只要域名匹配 + 用户授权，所有能力即可在浏览器侧直接使用——无需任何后端。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg"><Link href="/register">免费开始</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/docs">阅读文档</Link></Button>
          </div>
        </div>
      </section>

      <section className="container-page pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink-100 border border-ink-100 rounded-lg overflow-hidden">
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
    <div className="bg-cream-50 p-6 hover:bg-cream-100 transition-colors">
      <Icon className="h-5 w-5 text-ink-900" />
      <h3 className="mt-4 text-md font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-500 leading-relaxed">{desc}</p>
    </div>
  );
}
