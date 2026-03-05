import Link from "next/link";
import { cookies } from "next/headers";
import { Card } from "@/components/ui/card";
import {
  primaryButtonClasses,
  secondaryButtonClasses
} from "@/components/ui/button";

export default function HomePage() {
  const cookieStore = cookies();
  const hasToken = !!cookieStore.get("uniid_token")?.value;

  return (
    <main className="w-full max-w-xl">
      <Card className="space-y-8">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
            UniID 统一身份与数据服务
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            一套账号，连接所有应用
          </h1>
          <p className="text-sm text-slate-300">
            为自建应用提供统一登录、应用授权和细粒度数据访问控制，让身份与数据安全更简单。
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={primaryButtonClasses + " sm:w-auto"}>
              登录控制台
            </Link>
            <Link
              href="/register"
              className={secondaryButtonClasses + " sm:w-auto"}
            >
              创建新账户
            </Link>
            {hasToken && (
              <Link
                href="/dashboard"
                className="text-xs font-medium text-sky-300 underline-offset-2 hover:underline sm:ml-auto"
              >
                已登录？进入控制台 →
              </Link>
            )}
          </div>
        </section>

        <section className="space-y-2 text-sm text-slate-300">
          <h2 className="text-sm font-semibold text-slate-100">
            为什么选择 UniID？
          </h2>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>· 统一账号体系：一套用户表管理所有应用身份。</li>
            <li>· 灵活授权模型：支持账户级与数据级两种授权模式。</li>
            <li>· 嵌入式接入：通过 iframe / JS SDK 无缝集成到任意站点。</li>
            <li>· 可观测性：会话、授权、数据访问都可在控制台一目了然。</li>
          </ul>
        </section>
      </Card>
    </main>
  );
}

