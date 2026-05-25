import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/shared/iam";
import { prisma } from "@/shared/prisma";
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/ui/primitives";
import { User as UserIcon } from "lucide-react";
import { AccountNav } from "@/ui/console/account-nav";
import { LogoutButton } from "@/ui/console/logout-button";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserSession();
  if (!session) redirect("/login?redirectTo=/account");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, role: true, displayName: true, email: true }
  });
  if (!user) redirect("/login?redirectTo=/account");

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-100 bg-cream-50 sticky top-0 z-30">
        <div className="container-page h-14 flex items-center justify-between">
          <Link href="/account" className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-ink-900 text-cream-50 flex items-center justify-center font-bold text-xs">U</span>
            <span className="text-sm font-semibold tracking-tight">我的账号</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <UserIcon className="h-3.5 w-3.5" />
                {user.displayName || user.username}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/console">前往控制台</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <LogoutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="container-page">
          <AccountNav />
        </div>
      </header>
      <main className="container-page py-8">{children}</main>
    </div>
  );
}
