import Link from "next/link";
import { BookOpen, Code2, Database, FileText, Network, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from "@/ui/primitives";

const docs = [
  {
    slug: "api",
    title: "API 概览",
    source: "docs/api.md",
    icon: Network,
    description: "统一 envelope、Auth、Data、Files、Realtime、Functions、Schemas 和错误码。"
  },
  {
    slug: "sdk",
    title: "SDK 接入",
    source: "docs/sdk.md",
    icon: Code2,
    description: "Core / React / Vue 的初始化、认证、数据、文件、实时和函数调用。"
  },
  {
    slug: "policy",
    title: "权限策略",
    source: "docs/policy.md",
    icon: ShieldCheck,
    description: "PolicyDocument、变量、动态规则、多动作和 explain 模式。"
  },
  {
    slug: "functions",
    title: "Edge Functions",
    source: "docs/functions.md",
    icon: FileText,
    description: "QuickJS 沙箱、触发方式、Host API、限额和安全清单。"
  },
  {
    slug: "architecture",
    title: "架构总览",
    source: "docs/architecture.md",
    icon: Database,
    description: "模块分层、请求生命周期、数据流和关键模块关系。"
  }
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-100 bg-white/80 backdrop-blur">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-900 text-sm text-cream-50">U</span>
            UniID Docs
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/design">设计系统</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/console">打开控制台</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container-page py-12 space-y-10">
        <div className="max-w-3xl space-y-4">
          <Badge tone="accent">Documentation</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900 md:text-5xl">
            UniID 文档
          </h1>
          <p className="text-md leading-relaxed text-ink-600">
            这里汇总现有文档主题和接入路径。首页 CTA 现在会进入这个可浏览文档入口。
          </p>
          <div className="flex flex-wrap gap-2">
            {docs.map((doc) => (
              <Button key={doc.slug} asChild variant="outline" size="sm">
                <Link href={`/docs/${doc.slug}`}>{doc.title}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map((doc) => {
            const Icon = doc.icon;
            return (
              <Card key={doc.slug}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="h-4 w-4" /> {doc.title}
                      </CardTitle>
                      <CardDescription>{doc.description}</CardDescription>
                    </div>
                    <Badge tone="neutral">{doc.source}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-ink-600">
                  <p>
                    源文件位于 <span className="font-mono text-xs text-ink-900">{doc.source}</span>，页面会直接渲染当前仓库内容。
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/docs/${doc.slug}`}>
                      <BookOpen /> 阅读文档
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