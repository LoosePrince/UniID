import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { LogoutButton } from "@/components/LogoutButton";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
export const dynamic = "force-dynamic";

type DashboardUser = {
  id: string;
  username: string;
  role: string;
};

type DashboardStats = {
  appCount: number;
  authorizationCount: number;
  activeSessionCount: number;
  lastLoginAt: number | null;
};

export default async function DashboardPage() {
  const cookieStore = cookies();
  let valid = false;
  let user: DashboardUser | null = null;
  let stats: DashboardStats | null = null;

  const token =
    cookieStore.get("uniid_token")?.value ??
    (typeof process === "undefined" ? null : null);

  if (token) {
    try {
      const res = await fetch(
        `${process.env.NEXTAUTH_URL ?? ""}/api/auth/check`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        }
      );

      if (res.ok) {
        const data = (await res.json()) as {
          valid: boolean;
          user?: DashboardUser;
        };
        valid = data.valid;
        if (data.user) user = data.user;
      }
    } catch {
      // ignore
    }
  }

  if (valid && user) {
    const now = Math.floor(Date.now() / 1000);

    const [appCount, authorizationCount, activeSessionCount, lastSession] =
      await Promise.all([
        prisma.app.count({
          where: { ownerId: user.id }
        }),
        prisma.authorization.count({
          where: {
            userId: user.id,
            revoked: 0
          }
        }),
        prisma.session.count({
          where: {
            userId: user.id,
            expiresAt: {
              gt: now
            }
          }
        }),
        prisma.session.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" }
        })
      ]);

    stats = {
      appCount,
      authorizationCount,
      activeSessionCount,
      lastLoginAt: lastSession?.createdAt ?? null
    };
  }

  return (
    <main className="w-full max-w-4xl">
      <Card className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              控制台
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              UniID 控制台
            </h1>
            <p className="text-sm text-slate-300">
              管理你的账户、应用授权与数据访问，会话与安全设置将在此统一呈现。
            </p>
          </div>
          {valid && user && (
            <div className="flex items-start gap-4 text-sm text-slate-300">
              <div className="space-y-1">
                <p>
                  已登录用户：
                  <span className="font-mono">{user.username}</span>
                </p>
                <p>
                  角色：<span className="font-mono">{user.role}</span>
                </p>
                {stats?.lastLoginAt && (
                  <p className="text-xs text-slate-500">
                    最近登录：
                    {new Date(stats.lastLoginAt * 1000).toLocaleString("zh-CN")}
                  </p>
                )}
              </div>
              <LogoutButton />
            </div>
          )}
        </header>

        {!valid || !user ? (
          <section className="space-y-3 text-sm text-slate-300">
            <p>当前未检测到有效登录状态。</p>
            <p>
              请先在<Link href="/login" className="text-sky-300"> 登录页面 </Link>
              完成登录，浏览器会保存访问令牌后再访问此页面。
            </p>
          </section>
        ) : (
          <>
            {stats && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  数据总览
                </h2>
                <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-slate-400">管理的应用</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-50">
                      {stats.appCount}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      作为所有者创建的应用数量。
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-slate-400">有效授权</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-50">
                      {stats.authorizationCount}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      当前仍然生效的应用授权记录。
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-slate-400">活跃会话</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-50">
                      {stats.activeSessionCount}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      仍在有效期内的登录会话数量。
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-slate-400">账户安全</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-50">
                      {stats.activeSessionCount > 0 ? "正常" : "待登录"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      后续将在此展示密码与风控状态。
                    </p>
                  </div>
                </div>
              </section>
            )}

            <DashboardTabs />

          </>
        )}
      </Card>
    </main>
  );
}

