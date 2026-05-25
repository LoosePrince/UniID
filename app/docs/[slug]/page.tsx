import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/ui/primitives";

type RenderState = {
  nodes: React.ReactNode[];
  list: string[];
  code: string[];
  inCode: boolean;
  codeLang: string;
};

const docs = {
  api: { title: "API 概览", file: "api.md" },
  sdk: { title: "SDK 接入", file: "sdk.md" },
  policy: { title: "权限策略", file: "policy.md" },
  functions: { title: "Edge Functions", file: "functions.md" },
  architecture: { title: "架构总览", file: "architecture.md" }
} as const;

function renderMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const state: RenderState = {
    nodes: [],
    list: [],
    code: [],
    inCode: false,
    codeLang: ""
  };

  function flushList(key: string) {
    if (state.list.length === 0) return;
    state.nodes.push(
      <ul key={key} className="list-disc space-y-1 pl-5 text-sm leading-7 text-ink-600">
        {state.list.map((item, index) => <li key={index}>{inline(item)}</li>)}
      </ul>
    );
    state.list = [];
  }

  function flushCode(key: string) {
    state.nodes.push(
      <pre key={key} className="overflow-auto rounded-md border border-ink-100 bg-ink-950 p-4 text-xs leading-6 text-cream-50">
        <code data-language={state.codeLang}>{state.code.join("\n")}</code>
      </pre>
    );
    state.code = [];
    state.codeLang = "";
    state.inCode = false;
  }

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      if (state.inCode) {
        flushCode(`code-${index}`);
      } else {
        flushList(`list-before-code-${index}`);
        state.inCode = true;
        state.codeLang = line.slice(3).trim();
      }
      return;
    }

    if (state.inCode) {
      state.code.push(line);
      return;
    }

    if (line.startsWith("# ")) {
      flushList(`list-${index}`);
      state.nodes.push(<h1 key={index} className="text-3xl font-semibold tracking-tight text-ink-900">{line.slice(2)}</h1>);
      return;
    }
    if (line.startsWith("## ")) {
      flushList(`list-${index}`);
      state.nodes.push(<h2 key={index} className="pt-6 text-xl font-semibold tracking-tight text-ink-900">{line.slice(3)}</h2>);
      return;
    }
    if (line.startsWith("### ")) {
      flushList(`list-${index}`);
      state.nodes.push(<h3 key={index} className="pt-4 text-md font-semibold text-ink-900">{line.slice(4)}</h3>);
      return;
    }
    if (line.startsWith("- ")) {
      state.list.push(line.slice(2));
      return;
    }
    if (line.trim().startsWith("|")) {
      flushList(`list-${index}`);
      state.nodes.push(<pre key={index} className="overflow-auto rounded-md bg-cream-50 px-3 py-2 font-mono text-xs text-ink-600">{line}</pre>);
      return;
    }
    if (line.trim() === "") {
      flushList(`list-${index}`);
      return;
    }

    flushList(`list-${index}`);
    state.nodes.push(<p key={index} className="text-sm leading-7 text-ink-600">{inline(line)}</p>);
  });

  if (state.inCode) flushCode("code-end");
  flushList("list-end");
  return state.nodes;
}

function inline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded-sm bg-cream-100 px-1 py-0.5 font-mono text-xs text-ink-900">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default async function DocDetailPage({ params }: { params: { slug: string } }) {
  const doc = docs[params.slug as keyof typeof docs];
  if (!doc) notFound();

  const markdown = await readFile(path.join(process.cwd(), "docs", doc.file), "utf8").catch(() => null);
  if (!markdown) notFound();

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-100 bg-white/80 backdrop-blur">
        <div className="container-page flex h-14 items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href="/docs"><ArrowLeft /> 返回文档</Link>
          </Button>
          <Badge tone="neutral">docs/{doc.file}</Badge>
        </div>
      </header>
      <section className="container-page max-w-4xl py-10">
        <Card>
          <CardContent className="space-y-5 p-6 md:p-8">
            {renderMarkdown(markdown)}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}