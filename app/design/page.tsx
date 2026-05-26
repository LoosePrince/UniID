"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Copy,
  Database,
  Layers3,
  Moon,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sun,
  Trash2
} from "lucide-react";
import { colors as colorTokens } from "@/ui/tokens";
import { useTheme, type ThemeMode } from "@/ui/theme";
import {
  Badge,
  Button,
  Callout,
  CalloutDescription,
  CalloutTitle,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast
} from "@/ui/primitives";

const themeModes: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "自动" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" }
] as const;

const lightColorGroups = ["cream", "sand", "ink", "accent", "success", "warning", "danger"] as const;
const darkColorGroups = ["slate", "accent", "success", "warning", "danger"] as const;

const codeSample = JSON.stringify(
  {
    type: "object",
    required: ["title", "status"],
    properties: {
      title: { type: "string", minLength: 2 },
      status: { type: "string", enum: ["draft", "published"] },
      createdAt: { type: "integer" }
    },
    additionalProperties: false
  },
  null,
  2
);

export default function DesignSystemPage() {
  const [open, setOpen] = useState(false);
  const [compactMenu, setCompactMenu] = useState(true);
  const [menuDensity, setMenuDensity] = useState("comfortable");
  const [schemaPreset, setSchemaPreset] = useState("posts");
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <TooltipProvider>
      <main className="relative min-h-screen overflow-hidden bg-cream-50 py-8 text-ink-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
          <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_8%,rgba(119,111,218,0.11),transparent_32%),radial-gradient(circle_at_84%_16%,rgba(197,184,145,0.13),transparent_28%),linear-gradient(180deg,#fbf9f4_0%,#f6f2e9_54%,#efe9d9_100%)] dark:bg-[radial-gradient(circle_at_18%_8%,rgba(99,109,180,0.12),transparent_30%),radial-gradient(circle_at_80%_14%,rgba(89,110,128,0.14),transparent_28%),linear-gradient(180deg,#0b1117_0%,#111a21_52%,#141d24_100%)]" />

          <div className="container-page relative z-10 space-y-10">
          <div className="surface-glass sticky top-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-slate-200">
              {isDark ? <Moon className="h-4 w-4 text-slate-300" /> : <Sun className="h-4 w-4 text-accent-600" />}
              <span>主题</span>
              <span className="font-mono text-2xs uppercase tracking-[0.14em] text-ink-400 dark:text-slate-500">
                {isDark ? "dark" : "light"}
              </span>
            </div>
            <div className="flex rounded-xl border border-ink-200/70 bg-cream-50/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-slate-600/60 dark:bg-slate-900/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
              {themeModes.map((mode) => {
                const active = themeMode === mode.value;

                return (
                  <button
                    key={mode.value}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-[background,border,color,box-shadow] ${
                      active
                        ? "border border-ink-200/80 bg-white/80 text-ink-900 shadow-[0_6px_16px_rgba(19,17,14,0.065),inset_0_0_0_1px_rgba(213,210,200,0.65),inset_0_1px_0_rgba(255,255,255,0.62)] dark:border-slate-500/70 dark:bg-slate-800/75 dark:text-slate-100 dark:shadow-[0_8px_20px_rgba(0,0,0,0.14),inset_0_0_0_1px_rgba(129,148,163,0.22),inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "border border-transparent text-ink-500 hover:bg-ink-100/50 hover:text-ink-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
                    }`}
                    aria-pressed={active}
                    onClick={() => setThemeMode(mode.value)}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <header className="surface-subtle rounded-2xl p-8 md:p-10">
            <div className="max-w-3xl space-y-4">
              <Badge tone="accent" className="rounded-full px-3 py-1">
                Internal · UI Kit
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">UniID Design System</h1>
                <p className="max-w-2xl text-md leading-7 text-ink-600 dark:text-slate-300">
                  用于验收 primitives、视觉 surface、表单状态、浮层、数据展示和反馈组件。页面本身也作为 UI 质感基线。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="hero" size="lg">
                  主要行动 <ArrowRight />
                </Button>
                <Button variant="outline" size="lg">
                  查看规范
                </Button>
              </div>
            </div>
          </header>

          <Section
            eyebrow="Foundation"
            title="Color tokens"
            description="浅色使用暖中性色，深色使用低对比冷中性色；accent 只作为轻量强调。"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-400 dark:text-slate-500">Light · warm neutrals</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                  {lightColorGroups.map((name) => (
                    <Swatch key={name} name={name} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-400 dark:text-slate-500">Dark · low contrast cool neutrals</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                  {darkColorGroups.map((name) => (
                    <Swatch key={name} name={name} dark />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section
            eyebrow="Surface"
            title="Surface utilities"
            description="新增的语义表层，给页面、卡片、浮层和 CTA 提供一致质感。"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <SurfaceCard className="surface-subtle" title="surface-subtle" description="低对比暖色渐变，适合 hero 和大块说明区域。" />
              <SurfaceCard className="surface-elevated" title="surface-elevated" description="实底、轻光影、细边框，适合控制台卡片。" />
              <SurfaceCard className="surface-glass" title="surface-glass" description="半透明毛玻璃，适合顶栏、浮层和轻量面板。" />
            </div>
          </Section>

          <Section
            eyebrow="Actions"
            title="Buttons"
            description="按钮需要明确高度、内边距、hover/focus 和 disabled 状态，不再出现贴边文字按钮。"
          >
            <PreviewPanel>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="hero">Hero</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="link">Link</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Button size="xs">XS</Button>
                <Button size="sm">SM</Button>
                <Button size="md">MD</Button>
                <Button size="lg">LG</Button>
                <Button size="icon" aria-label="搜索">
                  <Search />
                </Button>
                <Button loading loadingText="Saving">
                  Saving
                </Button>
                <Button disabled>Disabled</Button>
                <Button>
                  <Save /> 保存
                </Button>
              </div>
            </PreviewPanel>
          </Section>

          <Section
            eyebrow="Forms"
            title="Inputs"
            description="输入类组件统一使用毛玻璃实底、清晰 focus ring、错误态和禁用态。"
          >
            <PreviewPanel>
              <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="用户名" htmlFor="ex-username" help="Field 统一 label、help 和错误提示。">
                  <Input id="ex-username" placeholder="my-handle" />
                </Field>
                <Field label="密码" htmlFor="ex-pw" required>
                  <Input id="ex-pw" type="password" placeholder="••••••••" />
                </Field>
                <Field label="状态" htmlFor="ex-status">
                  <Select
                    id="ex-status"
                    defaultValue="active"
                    options={[
                      { value: "active", label: "active" },
                      { value: "suspended", label: "suspended" },
                      { value: "archived", label: "archived" }
                    ]}
                  />
                </Field>
                <Field label="无效选择" htmlFor="ex-select-bad" error="请选择可用状态。">
                  <Select
                    id="ex-select-bad"
                    invalid
                    defaultValue="archived"
                    options={[
                      { value: "active", label: "active" },
                      { value: "archived", label: "archived" }
                    ]}
                  />
                </Field>
                <Field label="禁用选择" htmlFor="ex-select-disabled" help="Select disabled 态保持一致表层。">
                  <Select id="ex-select-disabled" disabled defaultValue="readonly" options={[{ value: "readonly", label: "readonly" }]} />
                </Field>
                <Field label="无效输入" htmlFor="ex-bad" error="该字段格式不正确。">
                  <Input id="ex-bad" invalid defaultValue="invalid@" />
                </Field>
                <Field className="md:col-span-2" label="应用描述" htmlFor="ex-desc" help="Textarea 继承相同 focus、disabled 和 invalid 状态。">
                  <Textarea id="ex-desc" placeholder="一句话描述这个应用..." />
                </Field>
                <Field label="禁用态" htmlFor="ex-disabled" help="disabled 态不可聚焦提交。">
                  <Input id="ex-disabled" disabled defaultValue="只读内容" />
                </Field>
              </div>
            </PreviewPanel>
          </Section>

          <Section
            eyebrow="Select"
            title="Select menus"
            description="下拉列表同时支持快速 options 模型和 Root/Trigger/Content/Item 组合模型，hover、focus、图标和文字尺寸与菜单组件统一。"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <PreviewPanel>
                <div className="space-y-4">
                  <Field label="组合式 Select" htmlFor="select-composed" help="适合需要分组、分隔线、禁用项的复杂选择。">
                    <SelectRoot value={schemaPreset} onValueChange={setSchemaPreset}>
                      <SelectTrigger id="select-composed">
                        <SelectValue placeholder="选择模板" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>常用模板</SelectLabel>
                          <SelectItem value="posts">posts</SelectItem>
                          <SelectItem value="profile">profile</SelectItem>
                          <SelectItem value="settings">settings</SelectItem>
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>系统模板</SelectLabel>
                          <SelectItem value="audit" disabled>audit logs</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </SelectRoot>
                  </Field>
                  <div className="rounded-xl border border-ink-200/70 bg-cream-50/60 px-3 py-2 text-sm text-ink-600 dark:border-slate-600/60 dark:bg-slate-900/50 dark:text-slate-300">
                    当前选择：<span className="font-mono text-ink-900 dark:text-slate-100">{schemaPreset}</span>
                  </div>
                </div>
              </PreviewPanel>
              <PreviewPanel>
                <div className="space-y-4">
                  <Field label="options 模型" help="适合表单筛选和简单设置项。">
                    <Select
                      defaultValue="published"
                      options={[
                        {
                          label: "内容状态",
                          options: [
                            { value: "draft", label: "draft" },
                            { value: "published", label: "published" },
                            { value: "archived", label: "archived", disabled: true }
                          ]
                        },
                        {
                          label: "系统状态",
                          options: [
                            { value: "locked", label: "locked" },
                            { value: "readonly", label: "readonly" }
                          ]
                        }
                      ]}
                    />
                  </Field>
                  <p className="text-sm leading-6 text-ink-500 dark:text-slate-400">
                    菜单项使用统一的 <span className="font-mono">min-h-9</span>、<span className="font-mono">text-sm</span> 和 <span className="font-mono">size-4</span> 图标规范。
                  </p>
                </div>
              </PreviewPanel>
            </div>
          </Section>

          <Section eyebrow="Status" title="Badges & Callouts" description="轻量状态标签和信息块用于后台页面的提示、风险和保存反馈。">
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <PreviewPanel>
                <div className="flex flex-wrap gap-2">
                  <Badge>neutral</Badge>
                  <Badge tone="accent">accent</Badge>
                  <Badge tone="success">success</Badge>
                  <Badge tone="warning">warning</Badge>
                  <Badge tone="danger">danger</Badge>
                  <Badge tone="solid">solid</Badge>
                </div>
              </PreviewPanel>
              <div className="grid gap-3 md:grid-cols-2">
                <Callout tone="info">
                  <CalloutTitle>结构化提示</CalloutTitle>
                  <CalloutDescription>适合说明规则、版本策略和编辑边界。</CalloutDescription>
                </Callout>
                <Callout tone="success">
                  <CalloutTitle>操作成功</CalloutTitle>
                  <CalloutDescription>用于保存、激活、同步等成功反馈。</CalloutDescription>
                </Callout>
                <Callout tone="warning">
                  <CalloutTitle>需要确认</CalloutTitle>
                  <CalloutDescription>用于草稿切换 active 前的风险提示。</CalloutDescription>
                </Callout>
                <Callout tone="danger">
                  <CalloutTitle>危险操作</CalloutTitle>
                  <CalloutDescription>用于删除、撤销、禁用等不可逆操作。</CalloutDescription>
                </Callout>
              </div>
            </div>
          </Section>

          <Section eyebrow="Layout" title="Cards" description="卡片已经接入 elevated surface，保持清晰层级和稳定的内容密度。">
            <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>my-blog-site</CardTitle>
                      <CardDescription>blog.example.com · 12 条记录</CardDescription>
                    </div>
                    <Badge tone="success">active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-ink-600 dark:text-slate-300">
                  这是一个示例应用卡片，包含名称、域名和描述信息。
                </CardContent>
                <CardFooter>
                  <Button variant="ghost" size="sm">查看</Button>
                  <Button size="sm">管理</Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>session</CardTitle>
                  <CardDescription>当前会话</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="设备" value="Chrome 130 · macOS" />
                  <InfoRow label="IP" value="192.168.1.10" />
                  <InfoRow label="状态" value="已验证" />
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section eyebrow="Overlay" title="Dialog · Dropdown · Tooltip" description="浮层统一使用 rounded-2xl、轻毛玻璃和柔和阴影。">
            <PreviewPanel>
              <div className="flex flex-wrap items-center gap-4">
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>打开对话框</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>撤销授权</DialogTitle>
                      <DialogDescription>撤销后该应用立即失去对你账号数据的访问。</DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <Callout tone="warning">
                        <CalloutTitle>该操作不可撤销</CalloutTitle>
                        <CalloutDescription>如果只是临时限制访问，建议先禁用应用。</CalloutDescription>
                      </Callout>
                    </DialogBody>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
                      <Button variant="danger" onClick={() => { setOpen(false); toast.success("已撤销"); }}>
                        <Trash2 /> 确认撤销
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><Plus /> 操作</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-56">
                    <DropdownMenuLabel>快捷操作</DropdownMenuLabel>
                    <DropdownMenuItem><Plus /> 新建<DropdownMenuShortcut>⌘N</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem><Copy /> 复制<DropdownMenuShortcut>⌘D</DropdownMenuShortcut></DropdownMenuItem>
                    <DropdownMenuItem disabled><Save /> 正在同步</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked={compactMenu} onCheckedChange={(checked) => setCompactMenu(Boolean(checked))}>
                      紧凑菜单
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>显示密度</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={menuDensity} onValueChange={setMenuDensity}>
                          <DropdownMenuRadioItem value="comfortable">comfortable</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="compact">compact</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem tone="danger"><Trash2 /> 删除</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm">悬停我</Button>
                  </TooltipTrigger>
                  <TooltipContent>这是 tooltip</TooltipContent>
                </Tooltip>

                <Button variant="outline" size="sm" onClick={() => toast.success("Toast! 已保存", { description: "5 秒后消失" })}>
                  Toast 成功
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast.error("Toast! 失败", { description: "请重试" })}>
                  Toast 失败
                </Button>
              </div>
            </PreviewPanel>
          </Section>

          <Section eyebrow="Controls" title="Tabs · Switch · Checkbox · Loading" description="小控件也需要拥有完整尺寸和状态，不依赖浏览器默认外观。">
            <PreviewPanel>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2 rounded-xl border border-ink-200/70 bg-cream-50/60 px-3 py-2 dark:border-slate-600/60 dark:bg-slate-900/50">
                  <Switch defaultChecked id="switch-demo" />
                  <Label htmlFor="switch-demo">启用</Label>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200/70 bg-cream-50/60 px-3 py-2 dark:border-slate-600/60 dark:bg-slate-900/50">
                  <Switch disabled id="switch-disabled" />
                  <Label htmlFor="switch-disabled">禁用</Label>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200/70 bg-cream-50/60 px-3 py-2 dark:border-slate-600/60 dark:bg-slate-900/50">
                  <Checkbox defaultChecked id="ck" />
                  <Label htmlFor="ck">我同意</Label>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-ink-200/70 bg-cream-50/60 px-3 py-2 dark:border-slate-600/60 dark:bg-slate-900/50">
                  <Checkbox disabled id="ck-disabled" />
                  <Label htmlFor="ck-disabled">不可选</Label>
                </div>
                <Spinner />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-44 rounded-xl" />
                  <Skeleton className="h-3 w-32 rounded-full" />
                </div>
              </div>
              <div className="mt-6 max-w-md">
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">概览</TabsTrigger>
                    <TabsTrigger value="settings">设置</TabsTrigger>
                    <TabsTrigger value="advanced">高级</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="text-sm leading-6 text-ink-600 dark:text-slate-300">概览内容展示在统一 spacing 下。</TabsContent>
                  <TabsContent value="settings" className="text-sm leading-6 text-ink-600 dark:text-slate-300">设置内容可直接放表单或卡片。</TabsContent>
                  <TabsContent value="advanced" className="text-sm leading-6 text-ink-600 dark:text-slate-300">高级内容建议配合 Callout 降低风险。</TabsContent>
                </Tabs>
              </div>
            </PreviewPanel>
          </Section>

          <Section eyebrow="Data" title="Table & CodeBlock" description="后台列表和 Schema JSON 预览用统一展示组件承载。">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <TableShell>
                <Table>
                  <TableCaption>Table caption 用于补充列表来源或刷新状态。</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>资源</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>更新时间</TableHead>
                      <TableHead className="text-right">记录数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-ink-900 dark:text-slate-100"><Database className="mr-2 inline h-4 w-4" />posts</TableCell>
                      <TableCell><Badge tone="success">active</Badge></TableCell>
                      <TableCell className="text-xs text-ink-500 dark:text-slate-400">2026/05/25 18:20</TableCell>
                      <TableCell className="text-right font-mono text-xs">128</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-ink-900 dark:text-slate-100"><ShieldCheck className="mr-2 inline h-4 w-4" />profiles</TableCell>
                      <TableCell><Badge tone="warning">draft</Badge></TableCell>
                      <TableCell className="text-xs text-ink-500 dark:text-slate-400">2026/05/25 17:04</TableCell>
                      <TableCell className="text-right font-mono text-xs">42</TableCell>
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3}>合计</TableCell>
                      <TableCell className="text-right font-mono text-xs">170</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableShell>
              <CodeBlock title="JSON Schema" language="json" value={codeSample} maxHeight="20rem" />
            </div>
          </Section>
          </div>
        </main>
    </TooltipProvider>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-2xs font-medium uppercase tracking-[0.16em] text-accent-600">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-slate-100">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-ink-500 dark:text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function PreviewPanel({ children }: { children: ReactNode }) {
  return <div className="surface-subtle rounded-2xl p-5 md:p-6">{children}</div>;
}

function SurfaceCard({ className, title, description }: { className: string; title: string; description: string }) {
  return (
    <div className={`${className} rounded-2xl p-5`}>
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200/70 bg-cream-50/60 text-accent-700 shadow-xs dark:border-slate-600/60 dark:bg-slate-900/50 dark:text-accent-200">
        <Layers3 className="h-4 w-4" />
      </div>
      <h3 className="font-mono text-sm font-semibold text-ink-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-500 dark:text-slate-400">{label}</span>
      <span className="font-mono text-xs text-ink-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

function Swatch({ name, dark = false }: { name: string; dark?: boolean }) {
  const steps = [50, 100, 200, 300, 500, 700, 900, 950] as const;
  const family = (colorTokens as Record<string, Record<number, string>>)[name];
  if (!family) return null;
  return (
    <div className="surface-elevated overflow-hidden rounded-xl p-2">
      <p className="mb-2 px-1 text-2xs font-medium uppercase tracking-wider text-ink-400 dark:text-slate-500">{name}</p>
      <div className="overflow-hidden rounded-lg border border-ink-100/70 dark:border-slate-700/70">
        {steps.map((s) => {
          const hex = family[s];
          if (!hex) return null;
          const textColor = dark ? (s >= 500 ? "#F4F7F8" : "#0B1117") : s >= 500 ? "#FBF9F4" : "#13110E";

          return (
            <div
              key={s}
              className="flex items-center justify-between px-2 py-1.5 font-mono text-2xs"
              style={{ backgroundColor: hex, color: textColor }}
            >
              <span>{s}</span>
              <span>{hex}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}