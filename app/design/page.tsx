"use client";

import { useState } from "react";
import { Trash2, Save, Plus, Search } from "lucide-react";
import { colors as colorTokens } from "@/ui/tokens";
import {
  Button,
  Input,
  Textarea,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Switch,
  Checkbox,
  Spinner,
  Skeleton,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast
} from "@/ui/primitives";

export default function DesignSystemPage() {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <main className="min-h-screen bg-cream-50 py-12">
        <div className="container-page space-y-12">
          <header className="space-y-2">
            <p className="text-2xs uppercase tracking-wider font-medium text-ink-400">Internal</p>
            <h1 className="text-3xl font-semibold tracking-tight">UniID Design System</h1>
            <p className="text-sm text-ink-500">设计令牌与组件展示（仅开发用）。</p>
          </header>

          <Section title="Color tokens">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {(["cream", "sand", "ink", "accent", "success", "warning", "danger"] as const).map((name) => (
                <Swatch key={name} name={name} />
              ))}
            </div>
          </Section>

          <Section title="Buttons">
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <Button size="xs">XS</Button>
              <Button size="sm">SM</Button>
              <Button size="md">MD</Button>
              <Button size="lg">LG</Button>
              <Button size="icon"><Search /></Button>
              <Button disabled>Disabled</Button>
              <Button><Save /> 保存</Button>
            </div>
          </Section>

          <Section title="Inputs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-1.5">
                <Label htmlFor="ex-username">用户名</Label>
                <Input id="ex-username" placeholder="my-handle" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-pw">密码</Label>
                <Input id="ex-pw" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-bad">无效输入</Label>
                <Input id="ex-bad" invalid defaultValue="invalid@" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="ex-desc">应用描述</Label>
                <Textarea id="ex-desc" placeholder="一句话描述这个应用..." />
              </div>
            </div>
          </Section>

          <Section title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>neutral</Badge>
              <Badge tone="accent">accent</Badge>
              <Badge tone="success">success</Badge>
              <Badge tone="warning">warning</Badge>
              <Badge tone="danger">danger</Badge>
              <Badge tone="solid">solid</Badge>
            </div>
          </Section>

          <Section title="Cards">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <Card>
                <CardHeader>
                  <CardTitle>my-blog-site</CardTitle>
                  <CardDescription>blog.example.com · 12 条记录</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-ink-600">
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
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">设备</span>
                    <span className="font-mono text-xs">Chrome 130 · macOS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">IP</span>
                    <span className="font-mono text-xs">192.168.1.10</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Dialog · Tabs · Switch · Checkbox · Dropdown · Tooltip">
            <div className="flex flex-wrap gap-4 items-center">
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
                    <p className="text-sm text-ink-600">该操作不可撤销，确定继续吗？</p>
                  </DialogBody>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
                    <Button variant="danger" onClick={() => { setOpen(false); toast.success("已撤销"); }}>
                      <Trash2 /> 确认撤销
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-2">
                <Switch defaultChecked /> <span className="text-sm">启用</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox defaultChecked id="ck" /> <Label htmlFor="ck">我同意</Label>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><Plus /> 操作</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>新建</DropdownMenuItem>
                  <DropdownMenuItem>复制</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>删除</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm">悬停我</Button>
                </TooltipTrigger>
                <TooltipContent>这是 tooltip</TooltipContent>
              </Tooltip>

              <Spinner />
              <Skeleton className="h-9 w-32" />

              <Button variant="outline" size="sm" onClick={() => toast.success("Toast! 已保存", { description: "5 秒后消失" })}>
                Toast 成功
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.error("Toast! 失败", { description: "请重试" })}>
                Toast 失败
              </Button>
            </div>

            <div className="mt-6 max-w-md">
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="settings">设置</TabsTrigger>
                  <TabsTrigger value="advanced">高级</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">概览内容</TabsContent>
                <TabsContent value="settings">设置内容</TabsContent>
                <TabsContent value="advanced">高级内容</TabsContent>
              </Tabs>
            </div>
          </Section>
        </div>
      </main>
    </TooltipProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Swatch({ name }: { name: string }) {
  const steps = [50, 100, 200, 300, 500, 700, 900] as const;
  const family = (colorTokens as Record<string, Record<number, string>>)[name];
  if (!family) return null;
  return (
    <div className="space-y-1">
      <p className="text-2xs font-medium text-ink-400 uppercase tracking-wider">{name}</p>
      <div className="rounded-md overflow-hidden border border-ink-100">
        {steps.map((s) => {
          const hex = family[s];
          if (!hex) return null;
          return (
            <div
              key={s}
              className="flex items-center justify-between px-2 py-1.5 text-2xs font-mono"
              style={{ backgroundColor: hex, color: s >= 500 ? "#FBF9F4" : "#13110E" }}
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
