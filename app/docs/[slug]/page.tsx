import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/ui/primitives";

type ListItem = {
  content: string;
  ordered: boolean;
};

type TableAlign = "left" | "center" | "right";

type RenderState = {
  nodes: React.ReactNode[];
  list: ListItem[];
  paragraph: string[];
  quote: string[];
  tableRows: string[][];
  tableAligns: TableAlign[] | null;
  code: string[];
  inCode: boolean;
  codeLang: string;
};

const tableCellAlignClass: Record<TableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right"
};

const tableCellAlignStyle: Record<TableAlign, React.CSSProperties["textAlign"]> = {
  left: "left",
  center: "center",
  right: "right"
};

const orderedListRe = /^(\d+)\.\s+(.+)$/;
const bulletListRe = /^[-*]\s+(.+)$/;
const indentedCodeRe = /^( {4}|\t)/;

const docs = {
  api: { title: "API 概览", file: "api.md" },
  sdk: { title: "SDK 接入", file: "sdk.md" },
  policy: { title: "权限策略", file: "policy.md" },
  functions: { title: "Edge Functions", file: "functions.md" },
  architecture: { title: "架构总览", file: "architecture.md" }
} as const;

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|");
}

function isTableSeparator(line: string) {
  if (!isTableLine(line)) return false;
  return parseTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function parseTableAligns(line: string): TableAlign[] {
  return parseTableRow(line).map((cell) => {
    const normalized = cell.replace(/\s+/g, "");
    if (normalized.startsWith(":") && normalized.endsWith(":")) return "center";
    if (normalized.endsWith(":")) return "right";
    return "left";
  });
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const state: RenderState = {
    nodes: [],
    list: [],
    paragraph: [],
    quote: [],
    tableRows: [],
    tableAligns: null,
    code: [],
    inCode: false,
    codeLang: ""
  };

  function flushParagraph(key: string) {
    if (state.paragraph.length === 0) return;
    state.nodes.push(
      <p key={key} className="text-sm leading-7 text-ink-600">
        {inline(state.paragraph.join(" "))}
      </p>
    );
    state.paragraph = [];
  }

  function flushQuote(key: string) {
    if (state.quote.length === 0) return;
    state.nodes.push(
      <blockquote key={key} className="rounded-xl border-l-4 border-accent-200 bg-accent-50/45 px-4 py-3 text-sm leading-7 text-ink-600">
        {state.quote.map((line, index) => (
          <p key={index}>{inline(line)}</p>
        ))}
      </blockquote>
    );
    state.quote = [];
  }

  function flushList(key: string) {
    if (state.list.length === 0) return;
    const ordered = state.list.every((item) => item.ordered);
    const Tag = ordered ? "ol" : "ul";
    state.nodes.push(
      <Tag key={key} className={ordered ? "list-decimal space-y-1 pl-5 text-sm leading-7 text-ink-600" : "list-disc space-y-1 pl-5 text-sm leading-7 text-ink-600"}>
        {state.list.map((item, index) => (
          <li key={index}>{inline(item.content)}</li>
        ))}
      </Tag>
    );
    state.list = [];
  }

  function flushTable(key: string) {
    if (state.tableRows.length === 0) return;
    const header = state.tableRows[0];
    if (!header) return;
    const body = state.tableRows.slice(1);
    const aligns = state.tableAligns ?? header.map(() => "left" as const);
    state.nodes.push(
      <div key={key} className="overflow-x-auto rounded-xl border border-ink-100 bg-white/48">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-cream-100/70 text-ink-700">
            <tr>
              {header.map((cell, index) => {
                const align = aligns[index] ?? "left";
                return (
                  <th
                    key={index}
                    className={`border-b border-ink-100 px-4 py-2.5 font-medium ${tableCellAlignClass[align]}`}
                    style={{ textAlign: tableCellAlignStyle[align] }}
                  >
                    {inline(cell)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-ink-100/70 last:border-0">
                {row.map((cell, cellIndex) => {
                  const align = aligns[cellIndex] ?? "left";
                  return (
                    <td
                      key={cellIndex}
                      className={`px-4 py-2.5 align-top text-ink-600 ${tableCellAlignClass[align]}`}
                      style={{ textAlign: tableCellAlignStyle[align] }}
                    >
                      {inline(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    state.tableRows = [];
    state.tableAligns = null;
  }

  function flushCode(key: string) {
    if (state.code.length === 0) return;
    state.nodes.push(
      <pre key={key} className="overflow-auto rounded-xl border border-ink-100 bg-ink-950 p-4 text-xs leading-6 text-cream-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <code data-language={state.codeLang}>{state.code.join("\n")}</code>
      </pre>
    );
    state.code = [];
    state.codeLang = "";
    state.inCode = false;
  }

  function flushFlow(key: string) {
    flushParagraph(`${key}-paragraph`);
    flushQuote(`${key}-quote`);
    flushList(`${key}-list`);
    flushTable(`${key}-table`);
  }

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      if (state.inCode) {
        flushCode(`code-${index}`);
      } else {
        flushFlow(`before-code-${index}`);
        state.inCode = true;
        state.codeLang = line.slice(3).trim();
      }
      return;
    }

    if (state.inCode) {
      state.code.push(line);
      return;
    }

    if (indentedCodeRe.test(line)) {
      flushFlow(`before-indented-code-${index}`);
      state.code.push(line.replace(indentedCodeRe, ""));
      return;
    }

    if (state.code.length > 0) {
      flushCode(`indented-code-${index}`);
    }

    const trimmed = line.trim();

    if (trimmed === "") {
      flushFlow(`blank-${index}`);
      return;
    }

    if (isTableLine(line)) {
      flushParagraph(`paragraph-before-table-${index}`);
      flushQuote(`quote-before-table-${index}`);
      flushList(`list-before-table-${index}`);
      if (state.tableRows.length === 1 && isTableSeparator(line)) {
        state.tableAligns = parseTableAligns(line);
      } else if (!isTableSeparator(line)) {
        state.tableRows.push(parseTableRow(line));
      }
      return;
    }

    if (line.startsWith("# ")) {
      flushFlow(`before-h1-${index}`);
      state.nodes.push(<h1 key={index} className="text-3xl font-semibold tracking-tight text-ink-900">{inline(line.slice(2))}</h1>);
      return;
    }
    if (line.startsWith("## ")) {
      flushFlow(`before-h2-${index}`);
      state.nodes.push(<h2 key={index} className="pt-6 text-xl font-semibold tracking-tight text-ink-900">{inline(line.slice(3))}</h2>);
      return;
    }
    if (line.startsWith("### ")) {
      flushFlow(`before-h3-${index}`);
      state.nodes.push(<h3 key={index} className="pt-4 text-md font-semibold text-ink-900">{inline(line.slice(4))}</h3>);
      return;
    }
    if (line.startsWith(">")) {
      flushParagraph(`paragraph-before-quote-${index}`);
      flushList(`list-before-quote-${index}`);
      flushTable(`table-before-quote-${index}`);
      state.quote.push(line.replace(/^>\s?/, ""));
      return;
    }

    const orderedMatch = orderedListRe.exec(trimmed);
    if (orderedMatch) {
      flushParagraph(`paragraph-before-ordered-list-${index}`);
      flushQuote(`quote-before-ordered-list-${index}`);
      flushTable(`table-before-ordered-list-${index}`);
      if (state.list.length > 0 && state.list.some((item) => !item.ordered)) {
        flushList(`mixed-list-${index}`);
      }
      state.list.push({ ordered: true, content: orderedMatch[2] ?? "" });
      return;
    }

    const bulletMatch = bulletListRe.exec(trimmed);
    if (bulletMatch) {
      flushParagraph(`paragraph-before-list-${index}`);
      flushQuote(`quote-before-list-${index}`);
      flushTable(`table-before-list-${index}`);
      if (state.list.length > 0 && state.list.some((item) => item.ordered)) {
        flushList(`mixed-list-${index}`);
      }
      state.list.push({ ordered: false, content: bulletMatch[1] ?? "" });
      return;
    }

    flushQuote(`quote-before-paragraph-${index}`);
    flushList(`list-before-paragraph-${index}`);
    flushTable(`table-before-paragraph-${index}`);
    state.paragraph.push(line);
  });

  if (state.inCode || state.code.length > 0) flushCode("code-end");
  flushFlow("end");
  return state.nodes;
}

function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded-sm bg-cream-100 px-1 py-0.5 font-mono text-xs text-ink-900">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-ink-900">{inline(part.slice(2, -2))}</strong>;
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