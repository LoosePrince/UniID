import { cookies } from "next/headers";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = cookies();
  let valid = false;
  let user:
    | {
        id: string;
        username: string;
        role: string;
      }
    | null = null;

  const token =
    cookieStore.get("uniid_token")?.value ??
    (typeof process === "undefined" ? null : null);

  // 当 token 存在于 localStorage 时，服务器无法直接读取；
  // 在 iframe/SDK 场景下通常会通过 Header 携带，这里简单通过客户端存储 + 重定向登录处理。

  if (!token) {
    // 简单客户端令牌方案下，服务器无法校验时直接提示
  } else {
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
          user?: { id: string; username: string; role: string };
        };
        valid = data.valid;
        if (data.user) user = data.user;
      }
    } catch {
      // ignore
    }
  }

  return (
    <main className="w-full max-w-xl space-y-6 rounded-xl bg-slate-900/60 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
        UniID 控制台
      </h1>
      {!valid || !user ? (
        <div className="space-y-3 text-sm text-slate-300">
          <p>当前未检测到有效登录状态。</p>
          <p>
            请先在 <span className="font-mono text-sky-300">/login</span>{" "}
            页面完成登录，浏览器会保存访问令牌后再访问此页面。
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <div>
              <p>
                已登录用户：<span className="font-mono">{user.username}</span>
              </p>
              <p>
                角色：<span className="font-mono">{user.role}</span>
              </p>
            </div>
            <LogoutButton />
          </div>
          <p className="text-slate-400">
            后续将在此处展示应用、授权、记录等管理界面。
          </p>
        </div>
      )}
    </main>
  );
}

